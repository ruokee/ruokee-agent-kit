mod app;
mod cancel;
mod cli;
mod component;
mod contract;
mod domain;
mod error;
mod gc;
mod git;
mod maintenance;
mod mcp;
mod metadata;
mod migrate;
mod path;
mod process;
mod project;
mod task_store;
mod version;
mod wal;

use std::process::ExitCode;

fn main() -> ExitCode {
    if let Err(error) = cancel::install() {
        eprintln!("Could not install the cancellation handler: {error}");
        return ExitCode::from(4);
    }
    cli::run()
}
