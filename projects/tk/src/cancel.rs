use std::cell::RefCell;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::error::{ErrorCategory, Result, TkError};

static SIGNAL_REQUESTED: AtomicBool = AtomicBool::new(false);

#[derive(Default)]
struct Invocation {
    request: Option<Arc<AtomicBool>>,
    write_started: bool,
}

thread_local! {
    static INVOCATION: RefCell<Invocation> = RefCell::new(Invocation::default());
}

pub fn install() -> std::result::Result<(), ctrlc::Error> {
    ctrlc::set_handler(|| {
        SIGNAL_REQUESTED.store(true, Ordering::SeqCst);
    })
}

pub fn requested() -> bool {
    SIGNAL_REQUESTED.load(Ordering::SeqCst)
}

pub fn with_request<T>(request: Arc<AtomicBool>, operation: impl FnOnce() -> T) -> T {
    struct Reset;

    impl Drop for Reset {
        fn drop(&mut self) {
            INVOCATION.with(|state| *state.borrow_mut() = Invocation::default());
        }
    }

    INVOCATION.with(|state| {
        *state.borrow_mut() = Invocation {
            request: Some(request),
            write_started: false,
        };
    });
    let _reset = Reset;
    operation()
}

pub fn check() -> Result<()> {
    let cancelled = INVOCATION.with(|state| {
        let state = state.borrow();
        !state.write_started && request_is_cancelled(&state)
    });
    if cancelled {
        Err(cancelled_error())
    } else {
        Ok(())
    }
}

pub fn checkpoint() -> Result<()> {
    let cancelled = INVOCATION.with(|state| request_is_cancelled(&state.borrow()));
    if cancelled {
        Err(TkError::new(
            "cancelled",
            ErrorCategory::Cancelled,
            "Operation cancelled between persistent writes",
        ))
    } else {
        Ok(())
    }
}

pub fn begin_write() -> Result<()> {
    INVOCATION.with(|state| {
        let mut state = state.borrow_mut();
        if state.write_started {
            return Ok(());
        }
        if request_is_cancelled(&state) {
            return Err(cancelled_error());
        }
        state.write_started = true;
        Ok(())
    })
}

fn request_is_cancelled(invocation: &Invocation) -> bool {
    requested()
        || invocation
            .request
            .as_ref()
            .is_some_and(|request| request.load(Ordering::SeqCst))
}

fn cancelled_error() -> TkError {
    TkError::new(
        "cancelled",
        ErrorCategory::Cancelled,
        "Operation cancelled before its first persistent write",
    )
}
