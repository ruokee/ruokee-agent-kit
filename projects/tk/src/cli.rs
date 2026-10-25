use std::collections::BTreeSet;
use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Args, CommandFactory, Parser, Subcommand, ValueEnum};
use serde::de::{DeserializeOwned, Error as _, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Number, Value, json};

use crate::app::{
    self, CreateRequest, CreateTaskInput, LifecycleOptions, ReadView, SearchRequest, SubtaskInput,
    UpdateRequest,
};
use crate::component;
use crate::domain::Status;
use crate::error::{ErrorCategory, Result, TkError};
use crate::gc;
use crate::maintenance;
use crate::metadata;
use crate::migrate;
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
    /// Find Task candidates.
    Search(SearchArgs),
    /// Read one exact Task.
    Read(ReadArgs),
    /// Create a top-level Task or one batch of subtasks.
    Create {
        #[command(subcommand)]
        command: CreateCommands,
    },
    /// Update relations, extra metadata, or lifecycle.
    Update(UpdateArgs),
    /// Append one durable Task event.
    Log(LogArgs),
    /// Diagnose project and managed Task integrity without writing.
    Check,
    /// Rename one Task and its directory.
    Rename(RenameArgs),
    /// Classify and conservatively remove tk temporary operations.
    Gc(GcArgs),
    /// Maintain Task metadata versions and representations.
    Metadata {
        #[command(subcommand)]
        command: MetadataCommands,
    },
    /// Install or update a CLI Skill.
    Install(ComponentArgs),
    /// Remove CLI Skills from the selected root.
    Uninstall(UninstallArgs),
    /// Initialize project-local Task storage.
    Init(InitArgs),
}

#[derive(Debug, Args)]
struct SearchArgs {
    query: String,
    #[arg(long)]
    regex: bool,
    #[arg(long)]
    search_body: bool,
    #[arg(long, value_enum)]
    status: Vec<CliStatus>,
    #[arg(long)]
    extra: Option<String>,
    #[arg(long, default_value_t = 20)]
    limit: usize,
}

#[derive(Debug, Args)]
struct ReadArgs {
    task_ref: String,
    #[arg(long, value_enum, default_value_t = CliReadView::Summary)]
    view: CliReadView,
    #[arg(long, help = format!("Maximum recent WAL entries. {}", app::wal_budget_defaults().0))]
    wal_max_entries: Option<usize>,
    #[arg(long, help = format!("Maximum recent WAL bytes. {}", app::wal_budget_defaults().1))]
    wal_max_length: Option<usize>,
}

#[derive(Debug, Subcommand)]
enum CreateCommands {
    /// Create one top-level Task.
    Task(CreateTaskArgs),
    /// Create one atomic domain batch under a parent Task.
    Subtask(CreateSubtaskArgs),
}

#[derive(Debug, Subcommand)]
enum MetadataCommands {
    /// Migrate selected metadata carriers forward.
    Migrate(MetadataMigrateArgs),
    /// Switch the whole project between split and embed.
    Switch(MetadataSwitchArgs),
}

#[derive(Debug, Args)]
struct CreateTaskArgs {
    name: String,
    #[arg(long, value_enum, default_value_t = CliCreationStatus::Open)]
    status: CliCreationStatus,
    #[arg(long)]
    created_at: Option<String>,
    #[arg(long)]
    depends_on: Vec<String>,
    #[arg(long)]
    related_to: Vec<String>,
    #[arg(long)]
    extra: Option<String>,
    #[arg(long)]
    user_confirmed: Option<bool>,
}

#[derive(Debug, Args)]
struct CreateSubtaskArgs {
    parent_ref: String,
    #[arg(long = "item", required = true, num_args = 1..=50)]
    items: Vec<String>,
    #[arg(long)]
    user_confirmed: Option<bool>,
}

#[derive(Debug, Args)]
struct UpdateArgs {
    task_ref: String,
    #[arg(long = "depends-on-add")]
    depends_on_add: Vec<String>,
    #[arg(long = "depends-on-remove")]
    depends_on_remove: Vec<String>,
    #[arg(long = "related-to-add")]
    related_to_add: Vec<String>,
    #[arg(long = "related-to-remove")]
    related_to_remove: Vec<String>,
    #[arg(long = "extra-set")]
    extra_set: Option<String>,
    #[arg(long = "extra-remove")]
    extra_remove: Vec<String>,
    #[arg(long)]
    start: bool,
    #[arg(long)]
    close: Option<String>,
    #[arg(long)]
    reopen: Option<String>,
    #[arg(long)]
    force: bool,
    #[arg(long)]
    user_confirmed: Option<bool>,
    #[arg(long)]
    actor: Option<String>,
}

#[derive(Debug, Args)]
struct LogArgs {
    task_ref: String,
    #[arg(long)]
    message: String,
    #[arg(long)]
    body: Option<String>,
    #[arg(long)]
    actor: Option<String>,
}

#[derive(Debug, Args)]
struct RenameArgs {
    task_ref: String,
    name: String,
    #[arg(long)]
    dry_run: bool,
    #[arg(long = "ignore-brokenlinks")]
    ignore_brokenlinks: bool,
    #[arg(long)]
    actor: Option<String>,
}

#[derive(Debug, Args)]
struct MetadataMigrateArgs {
    #[arg(long, default_value = "1")]
    to: String,
    #[arg(long = "file")]
    files: Vec<PathBuf>,
    #[arg(long)]
    dry_run: bool,
}

#[derive(Debug, Args)]
struct MetadataSwitchArgs {
    #[arg(long, value_enum)]
    to: CliMetadataMode,
    #[arg(long)]
    dry_run: bool,
}

#[derive(Debug, Args)]
struct GcArgs {
    #[arg(long)]
    dry_run: bool,
}

#[derive(Debug, Args)]
struct ComponentArgs {
    #[command(flatten)]
    target: TargetArgs,
    #[arg(long, value_enum, default_value_t = CliLanguage::En)]
    language: CliLanguage,
    #[arg(long)]
    dry_run: bool,
}

#[derive(Debug, Args)]
#[group(required = true, multiple = false)]
struct TargetArgs {
    #[arg(long, value_enum)]
    harness: Option<CliHarness>,
    #[arg(long)]
    skill_root: Option<PathBuf>,
}

#[derive(Debug, Args)]
struct UninstallArgs {
    #[command(flatten)]
    target: TargetArgs,
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
enum CliStatus {
    Planning,
    Open,
    Closed,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliCreationStatus {
    Planning,
    Open,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliReadView {
    Minimal,
    Summary,
    Detailed,
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

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliHarness {
    Codex,
    Claude,
    Pi,
    Omp,
}

#[derive(Debug, Clone, Copy, ValueEnum)]
enum CliLanguage {
    En,
    Zh,
}

struct CommandOutput {
    data: Value,
    text: String,
    warnings: Vec<Warning>,
}

#[derive(Serialize)]
struct Warning {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<Value>,
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
    if let Some(option) = invalid_explicit_option(&cli) {
        let error = TkError::request(
            "invalid_request",
            format!("{option} is not accepted by this command"),
        );
        print_error(Output::Text, &error);
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

fn invalid_explicit_option(cli: &Cli) -> Option<&'static str> {
    let present = |name: &str| {
        std::env::args_os().skip(1).any(|argument| {
            let argument = argument.to_string_lossy();
            argument == name || argument.starts_with(&format!("{name}="))
        })
    };
    let cwd = present("--cwd");
    let output = present("--output");

    if cli.version {
        return cwd.then_some("--cwd");
    }
    match cli.command.as_ref() {
        Some(Commands::Install(_) | Commands::Uninstall(_)) => cwd.then_some("--cwd"),
        None => cwd.then_some("--cwd").or(output.then_some("--output")),
        Some(_) => None,
    }
}

fn discover_for_search(cwd: &std::path::Path, query: &str) -> Result<project::Project> {
    discover_for_existing_absolute_path(cwd, query)
}

fn discover_for_task_ref(cwd: &std::path::Path, task_ref: &str) -> Result<project::Project> {
    discover_for_existing_absolute_path(cwd, task_ref)
}

fn discover_for_rename_ref(cwd: &std::path::Path, task_ref: &str) -> Result<project::Project> {
    let path = std::path::Path::new(task_ref);
    if path.is_absolute() && path.exists() {
        project::discover_from_exact_path_for_rename(path)
    } else {
        project::discover(cwd)
    }
}

fn discover_for_existing_absolute_path(
    cwd: &std::path::Path,
    value: &str,
) -> Result<project::Project> {
    let path = std::path::Path::new(value);
    if path.is_absolute() && path.exists() {
        project::discover_from_exact_path(path)
    } else {
        project::discover(cwd)
    }
}

fn resolve_skill_root(cwd: &std::path::Path, path: PathBuf) -> PathBuf {
    if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    }
}

fn execute(command: Commands, cwd: PathBuf) -> Result<CommandOutput> {
    let cwd = cwd.as_path();
    match command {
        Commands::Search(args) => execute_search(args, cwd),
        Commands::Read(args) => execute_read(args, cwd),
        Commands::Create { command } => execute_create(command, cwd),
        Commands::Update(args) => execute_update(args, cwd),
        Commands::Log(args) => execute_log(args, cwd),
        Commands::Check => execute_check(cwd),
        Commands::Rename(args) => execute_rename(args, cwd),
        Commands::Metadata { command } => execute_metadata(command, cwd),
        Commands::Gc(args) => execute_gc(args, cwd),
        Commands::Install(args) => execute_install(args, cwd),
        Commands::Uninstall(args) => execute_uninstall(args, cwd),
        Commands::Init(args) => execute_init(args, cwd),
    }
}

fn execute_search(args: SearchArgs, cwd: &Path) -> Result<CommandOutput> {
    let project = discover_for_search(cwd, &args.query)?;
    let extra = args
        .extra
        .as_deref()
        .map(parse_json_object)
        .transpose()?
        .unwrap_or_default();
    let mut result = app::search(
        &project,
        SearchRequest {
            query: args.query,
            regex: args.regex,
            search_body: args.search_body,
            statuses: args.status.into_iter().map(Into::into).collect(),
            extra,
            limit: args.limit,
        },
    )?;
    let warnings = convert_warnings(std::mem::take(&mut result.warnings));
    let text = result
        .items
        .iter()
        .map(|item| {
            format!(
                "{}\t{}\t{}\t{}",
                item.id,
                item.status,
                item.name,
                item.task_dir.display()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    Ok(CommandOutput {
        data: serde_json::to_value(result).expect("serializing search result"),
        text,
        warnings,
    })
}

fn execute_read(args: ReadArgs, cwd: &Path) -> Result<CommandOutput> {
    let project = discover_for_task_ref(cwd, &args.task_ref)?;
    let view = ReadView::from(args.view);
    let (default_entries, default_length) = view.default_wal_limits();
    let mut result = app::read(
        &project,
        &args.task_ref,
        view,
        args.wal_max_entries.unwrap_or(default_entries),
        args.wal_max_length.unwrap_or(default_length),
    )?;
    let warnings = convert_warnings(std::mem::take(&mut result.warnings));
    let text = serde_json::to_string_pretty(&result).expect("serializing read result");
    Ok(CommandOutput {
        data: serde_json::to_value(result).expect("serializing read result"),
        text,
        warnings,
    })
}

fn execute_create(command: CreateCommands, cwd: &Path) -> Result<CommandOutput> {
    let project = match &command {
        CreateCommands::Task(_) => project::discover(cwd)?,
        CreateCommands::Subtask(args) => discover_for_task_ref(cwd, &args.parent_ref)?,
    };
    let request = match command {
        CreateCommands::Task(args) => CreateRequest::Task {
            input: CreateTaskInput {
                name: args.name,
                status: args.status.into(),
                created_at: args.created_at,
                depends_on: args.depends_on,
                related_to: args.related_to,
                extra: args
                    .extra
                    .as_deref()
                    .map(parse_json_object)
                    .transpose()?
                    .unwrap_or_default(),
            },
            user_confirmed: args.user_confirmed.unwrap_or(true),
        },
        CreateCommands::Subtask(args) => CreateRequest::Subtasks {
            parent_ref: args.parent_ref,
            subtasks: args
                .items
                .iter()
                .map(|item| {
                    serde_json::from_str::<SubtaskInput>(item).map_err(|error| {
                        TkError::request(
                            "invalid_subtask_item",
                            format!("Invalid --item JSON: {error}"),
                        )
                    })
                })
                .collect::<Result<Vec<_>>>()?,
            user_confirmed: args.user_confirmed.unwrap_or(true),
        },
    };
    let result = app::create(&project, request)?;
    let text = result
        .created
        .iter()
        .map(|task| format!("Created {} at {}", task.name, task.task_dir.display()))
        .collect::<Vec<_>>()
        .join("\n");
    Ok(CommandOutput {
        data: serde_json::to_value(result).expect("serializing create result"),
        text,
        warnings: vec![],
    })
}

fn execute_update(args: UpdateArgs, cwd: &Path) -> Result<CommandOutput> {
    let project = discover_for_task_ref(cwd, &args.task_ref)?;
    let lifecycle = LifecycleOptions {
        start: args.start,
        close: args.close,
        reopen: args.reopen,
        force: args.force,
        user_confirmed: args.user_confirmed.unwrap_or(true),
    }
    .into_action("--")?;
    let mut result = app::update(
        &project,
        &args.task_ref,
        UpdateRequest {
            add_depends_on: args.depends_on_add,
            remove_depends_on: args.depends_on_remove,
            add_related_to: args.related_to_add,
            remove_related_to: args.related_to_remove,
            set_extra: args
                .extra_set
                .as_deref()
                .map(parse_json_object)
                .transpose()?
                .unwrap_or_default(),
            unset_extra: args.extra_remove,
            lifecycle,
        },
        args.actor.as_deref().unwrap_or("cli"),
    )?;
    let warnings = convert_warnings(std::mem::take(&mut result.warnings));
    let text = if result.changed {
        format!("Updated {}", result.task.task_dir.display())
    } else {
        "No changes".into()
    };
    Ok(CommandOutput {
        data: serde_json::to_value(result).expect("serializing update result"),
        text,
        warnings,
    })
}

fn execute_log(args: LogArgs, cwd: &Path) -> Result<CommandOutput> {
    let project = discover_for_task_ref(cwd, &args.task_ref)?;
    let mut result = app::log(
        &project,
        &args.task_ref,
        &args.message,
        args.body.as_deref(),
        args.actor.as_deref().unwrap_or("cli"),
    )?;
    let warnings = convert_warnings(std::mem::take(&mut result.warnings));
    let text = format!("Logged event for {}", result.task.task_dir.display());
    Ok(CommandOutput {
        data: serde_json::to_value(result).expect("serializing log result"),
        text,
        warnings,
    })
}

fn execute_check(cwd: &Path) -> Result<CommandOutput> {
    let result = maintenance::check(cwd);
    if !result.complete {
        return Err(TkError::new(
            "check_incomplete",
            ErrorCategory::Storage,
            "Project check could not complete its scan",
        )
        .with_details(serde_json::to_value(result).expect("serializing check result")));
    }
    if !result.ok {
        return Err(TkError::new(
            "check_failed",
            ErrorCategory::ManagedFile,
            "Project check found blocking diagnostics",
        )
        .with_details(serde_json::to_value(result).expect("serializing check result")));
    }
    Ok(CommandOutput {
        data: serde_json::to_value(result).expect("serializing check result"),
        text: "No integrity problems found".into(),
        warnings: vec![],
    })
}

fn execute_rename(args: RenameArgs, cwd: &Path) -> Result<CommandOutput> {
    let project = discover_for_rename_ref(cwd, &args.task_ref)?;
    let mut result = maintenance::rename(
        &project,
        &args.task_ref,
        &args.name,
        args.dry_run,
        args.ignore_brokenlinks,
        args.actor.as_deref().unwrap_or("cli"),
    )?;
    let warnings = convert_warnings(std::mem::take(&mut result.warnings));
    Ok(CommandOutput {
        data: serde_json::to_value(&result).expect("serializing rename result"),
        text: rename_text(args.dry_run, &result),
        warnings,
    })
}

fn execute_metadata(command: MetadataCommands, cwd: &Path) -> Result<CommandOutput> {
    let project = project::discover_unchecked(cwd)?;
    let (data, text) = match command {
        MetadataCommands::Migrate(args) => {
            let result = migrate::schema(&project, &args.to, &args.files, args.dry_run)?;
            let text = if result.changed {
                format!(
                    "schema migration: {} -> {} ({} Tasks)",
                    result.source, result.target, result.affected_tasks
                )
            } else {
                "No migration needed".into()
            };
            (
                serde_json::to_value(result).expect("serializing schema migration result"),
                text,
            )
        }
        MetadataCommands::Switch(args) => {
            let result = metadata::switch(&project, args.to.into(), args.dry_run)?;
            let text = if result.changed {
                format!(
                    "{}: {} -> {} ({} Tasks)",
                    result.kind, result.source, result.target, result.affected_tasks
                )
            } else {
                "No migration needed".into()
            };
            (
                serde_json::to_value(result).expect("serializing metadata switch result"),
                text,
            )
        }
    };
    Ok(CommandOutput {
        data,
        text,
        warnings: vec![],
    })
}

fn execute_gc(args: GcArgs, cwd: &Path) -> Result<CommandOutput> {
    let result = gc::run(Some(cwd), args.dry_run)?;
    Ok(CommandOutput {
        text: serde_json::to_string_pretty(&result).expect("serializing gc result"),
        data: serde_json::to_value(result).expect("serializing gc result"),
        warnings: vec![],
    })
}

impl TargetArgs {
    fn resolve(self, cwd: &Path) -> component::Target {
        match (self.harness, self.skill_root) {
            (Some(harness), None) => component::Target::Harness(harness.into()),
            (None, Some(root)) => component::Target::SkillRoot(resolve_skill_root(cwd, root)),
            _ => unreachable!("clap requires exactly one installation target"),
        }
    }
}

fn execute_install(args: ComponentArgs, cwd: &Path) -> Result<CommandOutput> {
    let result = component::install(args.target.resolve(cwd), args.language.into(), args.dry_run)?;
    Ok(CommandOutput {
        text: serde_json::to_string_pretty(&result).expect("serializing install result"),
        data: serde_json::to_value(result).expect("serializing install result"),
        warnings: vec![],
    })
}

fn execute_uninstall(args: UninstallArgs, cwd: &Path) -> Result<CommandOutput> {
    let result = component::uninstall(args.target.resolve(cwd), args.dry_run)?;
    Ok(CommandOutput {
        text: serde_json::to_string_pretty(&result).expect("serializing uninstall result"),
        data: serde_json::to_value(result).expect("serializing uninstall result"),
        warnings: vec![],
    })
}

fn execute_init(args: InitArgs, cwd: &Path) -> Result<CommandOutput> {
    let result = project::init(
        cwd,
        InitOptions {
            task_root: args.task_root,
            subtasks_dir: args.subtasks_dir,
            git_policy: args.git_policy.map(Into::into),
            creation_policy: args.creation_policy.map(Into::into),
            metadata_mode: args.metadata_mode.map(Into::into),
            force: args.force,
        },
    )?;
    let warnings = Vec::new();
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
        warnings,
    })
}

fn convert_warnings(warnings: Vec<app::AppWarning>) -> Vec<Warning> {
    warnings
        .into_iter()
        .map(|warning| Warning {
            code: warning.code,
            message: warning.message,
            details: warning.details,
        })
        .collect()
}

fn print_success(output: Output, result: CommandOutput) {
    match output {
        Output::Text => {
            println!("{}", result.text);
            for warning in result.warnings {
                eprintln!("warning[{}]: {}", warning.code, warning.message);
            }
        }
        Output::Json => {
            let mut envelope = serde_json::Map::from_iter([
                ("ok".into(), Value::Bool(true)),
                ("data".into(), result.data),
            ]);
            if !result.warnings.is_empty() {
                envelope.insert(
                    "warnings".into(),
                    serde_json::to_value(result.warnings).expect("serializing warnings"),
                );
            }
            println!("{}", Value::Object(envelope));
        }
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

fn rename_references_section(plan: &maintenance::RenamePlan) -> String {
    if plan.references.is_empty() {
        return String::new();
    }
    let mut section = String::from("\nReferences to the old path:\n");
    for reference in &plan.references {
        let _ = writeln!(section, "{}:{}", reference.path.display(), reference.line);
    }
    section.pop();
    section
}

fn rename_text(dry_run: bool, result: &maintenance::RenameResult) -> String {
    let reference_section = rename_references_section(&result.plan);
    if dry_run {
        format!(
            "Old path: {}\nNew name: {}\nTarget path: {}{reference_section}",
            result.plan.old_path.display(),
            result.plan.new_name,
            result.plan.target_path.display(),
        )
    } else if result.changed {
        format!(
            "Renamed to {}{reference_section}",
            result.task.task_dir.display()
        )
    } else {
        format!(
            "No changes\nTarget path: {}{reference_section}",
            result.plan.target_path.display()
        )
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

pub fn parse_json_object<T: DeserializeOwned>(input: &str) -> Result<T> {
    let value = parse_json_value(input)?;
    if !matches!(value, Value::Object(_)) {
        return Err(TkError::request(
            "invalid_json_object",
            "Expected a JSON object",
        ));
    }
    serde_json::from_value(value)
        .map_err(|error| TkError::request("invalid_json_object", error.to_string()))
}

pub fn parse_json_value(input: &str) -> Result<Value> {
    let value: StrictValue = serde_json::from_str(input)
        .map_err(|error| TkError::request("invalid_json", error.to_string()))?;
    Ok(value.0)
}

struct StrictValue(Value);

impl<'de> Deserialize<'de> for StrictValue {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(StrictValueVisitor)
    }
}

struct StrictValueVisitor;

impl<'de> Visitor<'de> for StrictValueVisitor {
    type Value = StrictValue;

    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("a JSON value without duplicate object keys")
    }

    fn visit_bool<E>(self, value: bool) -> std::result::Result<Self::Value, E> {
        Ok(StrictValue(Value::Bool(value)))
    }

    fn visit_i64<E>(self, value: i64) -> std::result::Result<Self::Value, E> {
        Ok(StrictValue(Value::Number(Number::from(value))))
    }

    fn visit_u64<E>(self, value: u64) -> std::result::Result<Self::Value, E> {
        Ok(StrictValue(Value::Number(Number::from(value))))
    }

    fn visit_f64<E>(self, value: f64) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Number::from_f64(value)
            .map(Value::Number)
            .map(StrictValue)
            .ok_or_else(|| E::custom("non-finite JSON number"))
    }

    fn visit_str<E>(self, value: &str) -> std::result::Result<Self::Value, E>
    where
        E: serde::de::Error,
    {
        Ok(StrictValue(Value::String(value.to_owned())))
    }

    fn visit_string<E>(self, value: String) -> std::result::Result<Self::Value, E> {
        Ok(StrictValue(Value::String(value)))
    }

    fn visit_none<E>(self) -> std::result::Result<Self::Value, E> {
        Ok(StrictValue(Value::Null))
    }

    fn visit_unit<E>(self) -> std::result::Result<Self::Value, E> {
        Ok(StrictValue(Value::Null))
    }

    fn visit_seq<A>(self, mut sequence: A) -> std::result::Result<Self::Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut values = Vec::new();
        while let Some(value) = sequence.next_element::<StrictValue>()? {
            values.push(value.0);
        }
        Ok(StrictValue(Value::Array(values)))
    }

    fn visit_map<A>(self, mut mapping: A) -> std::result::Result<Self::Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut keys = BTreeSet::new();
        let mut values = Map::new();
        while let Some(key) = mapping.next_key::<String>()? {
            if !keys.insert(key.clone()) {
                return Err(A::Error::custom(format!("duplicate object key: {key}")));
            }
            values.insert(key, mapping.next_value::<StrictValue>()?.0);
        }
        Ok(StrictValue(Value::Object(values)))
    }
}

impl From<CliHarness> for component::Harness {
    fn from(value: CliHarness) -> Self {
        match value {
            CliHarness::Codex => Self::Codex,
            CliHarness::Claude => Self::Claude,
            CliHarness::Pi => Self::Pi,
            CliHarness::Omp => Self::Omp,
        }
    }
}

impl From<CliLanguage> for component::Language {
    fn from(value: CliLanguage) -> Self {
        match value {
            CliLanguage::En => Self::En,
            CliLanguage::Zh => Self::Zh,
        }
    }
}

impl From<CliStatus> for Status {
    fn from(value: CliStatus) -> Self {
        match value {
            CliStatus::Planning => Self::Planning,
            CliStatus::Open => Self::Open,
            CliStatus::Closed => Self::Closed,
        }
    }
}

impl From<CliCreationStatus> for Status {
    fn from(value: CliCreationStatus) -> Self {
        match value {
            CliCreationStatus::Planning => Self::Planning,
            CliCreationStatus::Open => Self::Open,
        }
    }
}

impl From<CliReadView> for ReadView {
    fn from(value: CliReadView) -> Self {
        match value {
            CliReadView::Minimal => Self::Minimal,
            CliReadView::Summary => Self::Summary,
            CliReadView::Detailed => Self::Detailed,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use clap::error::ErrorKind;
    use std::collections::BTreeMap;
    use uuid::Uuid;

    #[test]
    fn rejects_duplicate_keys_at_any_depth() {
        assert!(parse_json_object::<BTreeMap<String, Value>>(r#"{"a":{"x":1,"x":2}}"#).is_err());
    }

    #[test]
    fn rejects_non_object_input() {
        assert!(parse_json_object::<BTreeMap<String, Value>>("[]").is_err());
    }
    #[test]
    fn accepts_version_with_json_output() {
        let cli = Cli::try_parse_from(["tk", "--version", "--output", "json"]).unwrap();
        assert!(cli.version);
        assert!(matches!(cli.output, Output::Json));
    }

    #[test]
    fn actor_belongs_to_wal_writing_commands() {
        let cli = Cli::try_parse_from([
            "tk",
            "log",
            "task-ref",
            "--message",
            "done",
            "--actor",
            "test-agent",
        ])
        .unwrap();
        let Some(Commands::Log(args)) = cli.command else {
            panic!("expected log command");
        };
        assert_eq!(args.actor.as_deref(), Some("test-agent"));
        assert!(Cli::try_parse_from(["tk", "search", "task", "--actor", "agent"]).is_err());
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

    #[test]
    fn read_uses_view_specific_budget_defaults() {
        let cli = Cli::try_parse_from(["tk", "read", "task-ref"]).unwrap();
        let Some(Commands::Read(args)) = cli.command else {
            panic!("expected read command");
        };
        assert!(matches!(args.view, CliReadView::Summary));
        assert_eq!(args.wal_max_entries, None);
        assert_eq!(args.wal_max_length, None);
        assert_eq!(ReadView::from(args.view).default_wal_limits(), (5, 4_000));

        let cli = Cli::try_parse_from(["tk", "read", "task-ref", "--view", "detailed"]).unwrap();
        let Some(Commands::Read(args)) = cli.command else {
            panic!("expected read command");
        };
        assert_eq!(ReadView::from(args.view).default_wal_limits(), (50, 16_000));
        assert!(Cli::try_parse_from(["tk", "read", "task-ref", "--view", "minimal"]).is_ok());
        let error =
            Cli::try_parse_from(["tk", "read", "task-ref", "--view", "metadata"]).unwrap_err();
        assert_eq!(error.kind(), ErrorKind::InvalidValue);
    }

    #[test]
    fn requires_explicit_create_level() {
        assert!(Cli::try_parse_from(["tk", "create", "name"]).is_err());
        assert!(Cli::try_parse_from(["tk", "create", "task", "name"]).is_ok());
    }

    #[test]
    fn rejects_subtasks_alias() {
        assert!(Cli::try_parse_from(["tk", "create", "subtasks"]).is_err());
    }

    #[test]
    fn create_task_rejects_body_option() {
        let error =
            Cli::try_parse_from(["tk", "create", "task", "name", "--body", "x"]).unwrap_err();
        assert_eq!(error.kind(), ErrorKind::UnknownArgument);
    }

    #[test]
    fn parses_subtask_confirmation_state() {
        let cli = Cli::try_parse_from([
            "tk",
            "create",
            "subtask",
            "parent",
            "--item",
            r#"{"name":"child","status":"planning"}"#,
            "--user-confirmed",
            "false",
        ])
        .unwrap();
        let Some(Commands::Create {
            command: CreateCommands::Subtask(args),
        }) = cli.command
        else {
            panic!("expected create subtask command");
        };
        assert_eq!(args.user_confirmed, Some(false));
    }

    #[test]
    fn install_and_uninstall_require_exactly_one_target() {
        assert!(Cli::try_parse_from(["tk", "install"]).is_err());
        assert!(
            Cli::try_parse_from([
                "tk",
                "install",
                "--harness",
                "codex",
                "--skill-root",
                "skills",
            ])
            .is_err()
        );
        assert!(Cli::try_parse_from(["tk", "uninstall"]).is_err());
        assert!(
            Cli::try_parse_from([
                "tk",
                "uninstall",
                "--harness",
                "codex",
                "--skill-root",
                "skills",
            ])
            .is_err()
        );
    }

    fn rename_result_fixture(
        changed: bool,
        committed: bool,
        references: Vec<(usize, &str)>,
    ) -> maintenance::RenameResult {
        let id = Uuid::now_v7();
        let references = references
            .into_iter()
            .map(|(line, path)| maintenance::MarkdownReference {
                path: PathBuf::from(path),
                line,
            })
            .collect();
        maintenance::RenameResult {
            changed,
            committed,
            partial: false,
            task: app::TaskReference {
                id,
                name: "target".into(),
                status: crate::domain::Status::Open,
                task_dir: PathBuf::from("/tmp/project/.tk/2026/09/05-01--target"),
            },
            plan: maintenance::RenamePlan {
                task_id: id,
                old_name: "source".into(),
                new_name: "target".into(),
                old_path: PathBuf::from("/tmp/project/.tk/2026/09/05-01--source"),
                target_path: PathBuf::from("/tmp/project/.tk/2026/09/05-01--target"),
                parent_task: None,
                references,
                expected_wal: String::new(),
            },
            warnings: Vec::new(),
        }
    }

    #[test]
    fn rename_text_covers_dry_run_changed_noop_and_references() {
        let with_refs = rename_result_fixture(
            true,
            false,
            vec![
                (2, "/tmp/project/notes/a.md"),
                (7, "/tmp/project/notes/b.md"),
            ],
        );
        assert_eq!(
            rename_text(true, &with_refs),
            "Old path: /tmp/project/.tk/2026/09/05-01--source\n\
             New name: target\n\
             Target path: /tmp/project/.tk/2026/09/05-01--target\n\
             References to the old path:\n\
             /tmp/project/notes/a.md:2\n\
             /tmp/project/notes/b.md:7"
        );
        let no_op = rename_result_fixture(
            false,
            false,
            vec![
                (2, "/tmp/project/notes/a.md"),
                (7, "/tmp/project/notes/b.md"),
            ],
        );
        assert_eq!(
            rename_text(false, &no_op),
            "No changes\nTarget path: /tmp/project/.tk/2026/09/05-01--target\n\
             References to the old path:\n\
             /tmp/project/notes/a.md:2\n\
             /tmp/project/notes/b.md:7"
        );

        let changed = rename_result_fixture(
            true,
            true,
            vec![
                (2, "/tmp/project/notes/a.md"),
                (7, "/tmp/project/notes/b.md"),
            ],
        );
        assert_eq!(
            rename_text(false, &changed),
            "Renamed to /tmp/project/.tk/2026/09/05-01--target\n\
             References to the old path:\n\
             /tmp/project/notes/a.md:2\n\
             /tmp/project/notes/b.md:7"
        );

        let without_refs = rename_result_fixture(true, false, Vec::new());
        assert_eq!(
            rename_text(true, &without_refs),
            "Old path: /tmp/project/.tk/2026/09/05-01--source\n\
             New name: target\n\
             Target path: /tmp/project/.tk/2026/09/05-01--target"
        );
    }

    #[test]
    fn rename_accepts_exact_ignore_brokenlinks_spelling() {
        let cli = Cli::try_parse_from([
            "tk",
            "rename",
            ".tk/2026/09/05-01--source",
            "target",
            "--ignore-brokenlinks",
        ])
        .unwrap();
        assert!(matches!(
            &cli.command,
            Some(Commands::Rename(args)) if args.ignore_brokenlinks
        ));

        let misspelled = Cli::try_parse_from([
            "tk",
            "rename",
            ".tk/2026/09/05-01--source",
            "target",
            "--ignore-broken-links",
        ]);
        assert!(misspelled.is_err());
    }
}
