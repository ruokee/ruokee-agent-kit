use std::io::Read;
use std::process::{Command, Output, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crate::error::{ErrorCategory, Result, TkError};

pub const MAX_PROCESS_OUTPUT_BYTES: usize = 1024 * 1024;

pub fn output(command: &mut Command, label: &str) -> Result<Output> {
    output_with_limit(command, label, MAX_PROCESS_OUTPUT_BYTES)
}

fn output_with_limit(command: &mut Command, label: &str, limit: usize) -> Result<Output> {
    let mut child = command
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            TkError::new(
                "process_start_failed",
                ErrorCategory::Environment,
                format!("Could not start {label}: {error}"),
            )
        })?;
    let overflow = Arc::new(AtomicBool::new(false));
    let capture_failed = Arc::new(AtomicBool::new(false));
    let stdout_reader = capture(
        child.stdout.take().expect("piped stdout"),
        limit,
        overflow.clone(),
        capture_failed.clone(),
    );
    let stderr_reader = capture(
        child.stderr.take().expect("piped stderr"),
        limit,
        overflow.clone(),
        capture_failed.clone(),
    );

    let status = loop {
        if overflow.load(Ordering::Acquire) || capture_failed.load(Ordering::Acquire) {
            let _ = child.kill();
            break child.wait().map_err(|error| {
                TkError::new(
                    "process_wait_failed",
                    ErrorCategory::Environment,
                    format!("Could not stop {label} after output capture stopped: {error}"),
                )
            })?;
        }
        match child.try_wait().map_err(|error| {
            TkError::new(
                "process_wait_failed",
                ErrorCategory::Environment,
                format!("Could not wait for {label}: {error}"),
            )
        })? {
            Some(status) => break status,
            None => std::thread::sleep(Duration::from_millis(5)),
        }
    };

    let stdout = join_capture(stdout_reader, label)?;
    let stderr = join_capture(stderr_reader, label)?;
    if overflow.load(Ordering::Acquire) {
        return Err(TkError::new(
            "process_output_too_large",
            ErrorCategory::Environment,
            format!("{label} output exceeded the 1 MiB limit"),
        ));
    }
    Ok(Output {
        status,
        stdout,
        stderr,
    })
}

fn capture(
    stream: impl Read + Send + 'static,
    limit: usize,
    overflow: Arc<AtomicBool>,
    failed: Arc<AtomicBool>,
) -> std::thread::JoinHandle<std::io::Result<Vec<u8>>> {
    std::thread::spawn(move || {
        let mut bytes = Vec::new();
        if let Err(error) = stream.take((limit + 1) as u64).read_to_end(&mut bytes) {
            failed.store(true, Ordering::Release);
            return Err(error);
        }
        if bytes.len() > limit {
            overflow.store(true, Ordering::Release);
        }
        Ok(bytes)
    })
}

fn join_capture(
    reader: std::thread::JoinHandle<std::io::Result<Vec<u8>>>,
    label: &str,
) -> Result<Vec<u8>> {
    reader
        .join()
        .map_err(|_| {
            TkError::new(
                "process_output_reader_failed",
                ErrorCategory::Internal,
                format!("{label} output reader panicked"),
            )
        })?
        .map_err(|error| {
            TkError::new(
                "process_output_read_failed",
                ErrorCategory::Environment,
                format!("Could not read {label} output: {error}"),
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kills_a_process_when_stdout_exceeds_the_limit() {
        let mut command = Command::new("sh");
        command.args(["-c", "while :; do printf xxxxxxxxxxxxxxxx; done"]);
        let error = output_with_limit(&mut command, "test command", 1024).unwrap_err();
        assert_eq!(error.code, "process_output_too_large");
    }

    #[test]
    fn kills_a_process_when_stderr_exceeds_the_limit() {
        let mut command = Command::new("sh");
        command.args(["-c", "while :; do printf xxxxxxxxxxxxxxxx >&2; done"]);
        let error = output_with_limit(&mut command, "test command", 1024).unwrap_err();
        assert_eq!(error.code, "process_output_too_large");
    }
}
