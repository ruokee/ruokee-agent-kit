use serde::Serialize;
use serde_json::Value;
use thiserror::Error;

pub type Result<T, E = TkError> = std::result::Result<T, E>;

#[derive(Debug, Error, Serialize)]
#[error("{message}")]
pub struct TkError {
    pub code: String,
    pub category: ErrorCategory,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCategory {
    Cancelled,
    Request,
    Context,
    Environment,
    Configuration,
    Policy,
    Resolution,
    ManagedFile,
    Invariant,
    Conflict,
    Storage,
    Compatibility,
    Internal,
}

impl TkError {
    pub fn request(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(code, ErrorCategory::Request, message)
    }

    pub fn invariant(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(code, ErrorCategory::Invariant, message)
    }

    pub fn configuration(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(code, ErrorCategory::Configuration, message)
    }

    pub fn new(
        code: impl Into<String>,
        category: ErrorCategory,
        message: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            category,
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(mut self, details: Value) -> Self {
        self.details = Some(details);
        self
    }

    pub fn partial_commit(
        message: impl Into<String>,
        completed: Value,
        uncompleted: Value,
        original_error: Self,
    ) -> Self {
        Self::new("partial_commit", ErrorCategory::Storage, message).with_details(
            serde_json::json!({
                "completed": completed,
                "uncompleted": uncompleted,
                "original_error": original_error,
            }),
        )
    }

    pub fn operation_cleanup_failed(
        cleanup_path: &std::path::Path,
        operation_error: Self,
        cleanup_error: Self,
    ) -> Self {
        let completed = operation_error
            .details
            .as_ref()
            .and_then(|details| details.get("completed"))
            .cloned()
            .unwrap_or_else(|| serde_json::json!([]));
        let mut uncompleted = operation_error
            .details
            .as_ref()
            .and_then(|details| details.get("uncompleted"))
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        uncompleted.push(serde_json::json!(cleanup_path));
        Self::new(
            "partial_commit",
            ErrorCategory::Storage,
            "The operation failed and its activity marker could not be removed",
        )
        .with_details(serde_json::json!({
            "completed": completed,
            "uncompleted": uncompleted,
            "original_error": operation_error,
            "cleanup_error": cleanup_error,
        }))
    }
}
