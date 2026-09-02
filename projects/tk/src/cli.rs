use std::path::PathBuf;
use std::process::ExitCode;

use clap::{Args, CommandFactory, Parser, Subcommand, ValueEnum};
use serde_json::{Value, json};

use crate::error::{ErrorCategory, Result, TkError};
use crate::gc;
use crate::project::{self, CreationPolicy, GitPolicy, InitOptions, MetadataMode};
use crate::version::{CLI_CONTRACT_VERSION, COMPONENT_FORMAT_VERSION, TASK_SCHEMA_VERSION};

#[derive(Debug, Clone, Copy, ValueEnum)]
enum Output {
    Text,
    Json,
}

#[derive(Debug, Parser)]
#[command(name = "tk", about = "Persistent local Task runtime")]
struct Cli {
    /// Print runtime and contract versions.
    #[arg(long)]
    version: bool,

    /// Select human-readable or structured output.
    #[arg(long, value_enum, default_value_t = Output::Text, global = true)]
    output: Output,

    /// Resolve the project from this directory.
    #[arg(long, global = true)]
    cwd: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Debug, Subcommand)]
enum Commands {
    /// Classify and conservatively remove tk temporary operations.
    Gc(GcArgs),
    /// Initialize project-local Task storage.
    Init(InitArgs),
}

#[derive(Debug, Args)]
struct GcArgs {
    #[arg(long)]
    dry_run: bool,
}

#[derive(Debug, Args)]
struct InitArgs {
    #[arg(long)]
    task_root: Option<String>,
    #[arg(long)]
    subtasks_dir: Option<String>,
    #[arg(long, value_enum)]
    git_policy: Option<CliGitPolicy>,
    #[arg(long, value_enum)]
    creation_policy: Option<CliCreationPolicy>,
    #[arg(long, value_enum)]
    metadata_mode: Option<CliMetadataMode>,
    #[arg(long)]
    force: bool,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliGitPolicy {
    Track,
    Ignore,
    None,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliCreationPolicy {
    Strict,
    Permissive,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliMetadataMode {
    Split,
    Embed,
}

struct CommandOutput {
    data: Value,
    text: String,
}

pub fn run() -> ExitCode {
    let cli = Cli::parse();
    if cli.version && cli.command.is_some() {
        let error = TkError::request(
            "invalid_request",
            "--version cannot be combined with a command",
        );
        print_error(cli.output, &error);
        return ExitCode::from(2);
    }
    if cli.version {
        print_version(cli.output);
        return ExitCode::SUCCESS;
    }

    let Some(command) = cli.command else {
        Cli::command().print_help().expect("writing help to stdout");
        println!();
        return ExitCode::SUCCESS;
    };
    let cwd = match cli.cwd {
        Some(path) => path,
        None => match std::env::current_dir() {
            Ok(path) => path,
            Err(error) => {
                let error = TkError::new(
                    "read_current_directory_failed",
                    ErrorCategory::Context,
                    error.to_string(),
                );
                print_error(cli.output, &error);
                return ExitCode::from(2);
            }
        },
    };

    match crate::cancel::check()
        .and_then(|()| execute(command, cwd))
        .and_then(|result| {
            crate::cancel::check()?;
            Ok(result)
        }) {
        Ok(result) => {
            print_success(cli.output, result);
            ExitCode::SUCCESS
        }
        Err(error) => {
            let code = match error.category {
                ErrorCategory::Cancelled => 130,
                ErrorCategory::Request => 2,
                ErrorCategory::Environment => 5,
                ErrorCategory::Storage | ErrorCategory::Internal => 4,
                _ => 3,
            };
            print_error(cli.output, &error);
            ExitCode::from(code)
        }
    }
}

fn execute(command: Commands, cwd: PathBuf) -> Result<CommandOutput> {
    match command {
        Commands::Gc(args) => {
            let result = gc::run(Some(&cwd), args.dry_run)?;
            Ok(CommandOutput {
                text: serde_json::to_string_pretty(&result).expect("serializing gc result"),
                data: serde_json::to_value(result).expect("serializing gc result"),
            })
        }
        Commands::Init(args) => {
            let result = project::init(
                &cwd,
                InitOptions {
                    task_root: args.task_root,
                    subtasks_dir: args.subtasks_dir,
                    git_policy: args.git_policy.map(Into::into),
                    creation_policy: args.creation_policy.map(Into::into),
                    metadata_mode: args.metadata_mode.map(Into::into),
                    force: args.force,
                },
            )?;
            Ok(CommandOutput {
                data: json!({
                    "changed": true,
                    "project_root": result.project.root,
                    "task_root": result.project.task_root,
                    "metadata_mode": result.project.config.metadata_mode,
                }),
                text: format!(
                    "Initialized tk project at {}",
                    result.project.root.display()
                ),
            })
        }
    }
}

fn print_success(output: Output, result: CommandOutput) {
    match output {
        Output::Text => println!("{}", result.text),
        Output::Json => println!(
            "{}",
            json!({
                "ok": true,
                "data": result.data,
            })
        ),
    }
}

fn print_error(output: Output, error: &TkError) {
    match output {
        Output::Text => eprintln!("error[{}]: {}", error.code, error.message),
        Output::Json => println!(
            "{}",
            json!({
                "ok": false,
                "error": error,
            })
        ),
    }
}

fn print_version(output: Output) {
    match output {
        Output::Text => println!("tk {}", env!("CARGO_PKG_VERSION")),
        Output::Json => println!(
            "{}",
            json!({
                "runtime_version": env!("CARGO_PKG_VERSION"),
                "cli_contract_version": CLI_CONTRACT_VERSION,
                "task_schema_version": TASK_SCHEMA_VERSION,
                "component_format_version": COMPONENT_FORMAT_VERSION,
            })
        ),
    }
}

impl From<CliGitPolicy> for GitPolicy {
    fn from(value: CliGitPolicy) -> Self {
        match value {
            CliGitPolicy::Track => Self::Track,
            CliGitPolicy::Ignore => Self::Ignore,
            CliGitPolicy::None => Self::None,
        }
    }
}

impl From<CliCreationPolicy> for CreationPolicy {
    fn from(value: CliCreationPolicy) -> Self {
        match value {
            CliCreationPolicy::Strict => Self::Strict,
            CliCreationPolicy::Permissive => Self::Permissive,
        }
    }
}

impl From<CliMetadataMode> for MetadataMode {
    fn from(value: CliMetadataMode) -> Self {
        match value {
            CliMetadataMode::Split => Self::Split,
            CliMetadataMode::Embed => Self::Embed,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_version_with_json_output() {
        let cli = Cli::try_parse_from(["tk", "--version", "--output", "json"]).unwrap();
        assert!(cli.version);
        assert!(matches!(cli.output, Output::Json));
    }

    #[test]
    fn parses_init_configuration() {
        let cli = Cli::try_parse_from([
            "tk",
            "init",
            "--metadata-mode",
            "embed",
            "--git-policy",
            "track",
        ])
        .unwrap();
        let Some(Commands::Init(args)) = cli.command else {
            panic!("expected init command");
        };
        assert!(matches!(args.metadata_mode, Some(CliMetadataMode::Embed)));
        assert!(matches!(args.git_policy, Some(CliGitPolicy::Track)));
    }
}
