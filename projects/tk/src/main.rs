mod cancel;
mod cli;
mod domain;
mod error;
mod gc;
mod git;
mod path;
mod process;
mod project;
mod task_store;
mod version;

use std::process::ExitCode;

fn main() -> ExitCode {
    if let Err(error) = cancel::install() {
        eprintln!("Could not install the cancellation handler: {error}");
        return ExitCode::from(4);
    }
    cli::run()
}
