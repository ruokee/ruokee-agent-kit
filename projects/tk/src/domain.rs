use std::collections::BTreeMap;

use chrono::{DateTime, FixedOffset};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use unicode_normalization::UnicodeNormalization;
use unicode_width::UnicodeWidthChar;
use uuid::{Uuid, Version};

use crate::error::{Result, TkError};
use crate::version::TASK_SCHEMA_VERSION;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Planning,
    Open,
    Closed,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Metadata {
    pub schema_version: u32,
    pub id: Uuid,
    pub name: String,
    pub status: Status,
    pub created_at: DateTime<FixedOffset>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub depends_on: Vec<Uuid>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub related_to: Vec<Uuid>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub extra: BTreeMap<String, Value>,
}

impl Metadata {
    pub fn validate(&self) -> Result<()> {
        if self.schema_version != TASK_SCHEMA_VERSION {
            return Err(TkError::request(
                "unsupported_schema_version",
                format!(
                    "Task schema version {} is unsupported; expected {}",
                    self.schema_version, TASK_SCHEMA_VERSION
                ),
            ));
        }
        if self.id.get_version() != Some(Version::SortRand) {
            return Err(TkError::request(
                "invalid_task_id",
                "Task ID must be a UUIDv7",
            ));
        }
        if normalize_name(&self.name)? != self.name {
            return Err(TkError::request(
                "invalid_task_name",
                "Task name is not in canonical form",
            ));
        }
        if self.depends_on.contains(&self.id) || self.related_to.contains(&self.id) {
            return Err(TkError::invariant(
                "self_relation",
                "A Task cannot relate to itself",
            ));
        }
        validate_extra(&Value::Object(self.extra.clone().into_iter().collect()))
    }

    pub fn transition(self, target: Status) -> Result<Self> {
        let allowed = matches!(
            (self.status, target),
            (Status::Planning, Status::Open)
                | (Status::Planning, Status::Closed)
                | (Status::Open, Status::Closed)
                | (Status::Closed, Status::Open)
        );
        if !allowed {
            return Err(TkError::invariant(
                "invalid_status_transition",
                format!("Cannot transition from {:?} to {:?}", self.status, target),
            ));
        }
        Ok(Self {
            status: target,
            ..self
        })
    }
}

pub fn normalize_name(input: &str) -> Result<String> {
    let mut normalized = String::new();
    let mut separator_pending = false;

    for ch in input.nfkc() {
        if ch.is_whitespace() || ch == '_' || ch == '-' {
            separator_pending = !normalized.is_empty();
            continue;
        }
        if !ch.is_alphanumeric() {
            separator_pending = !normalized.is_empty();
            continue;
        }
        if separator_pending {
            normalized.push('-');
            separator_pending = false;
        }
        normalized.push(ch);
    }

    if normalized.is_empty() {
        return Err(TkError::request(
            "invalid_task_name",
            "Task name is empty after normalization",
        ));
    }

    let width: usize = normalized.chars().map(|ch| ch.width().unwrap_or(0)).sum();
    if width > 32 {
        return Err(TkError::request(
            "task_name_too_wide",
            format!("Task name occupies {width} terminal columns; maximum is 32"),
        ));
    }
    Ok(normalized)
}

pub fn validate_extra(value: &Value) -> Result<()> {
    match value {
        Value::Null => Err(TkError::request(
            "invalid_extra_value",
            "extra values cannot contain null",
        )),
        Value::Array(values) => values.iter().try_for_each(validate_extra),
        Value::Object(values) => values.values().try_for_each(validate_extra),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_task_names() {
        assert_eq!(normalize_name("tk 架构设计").unwrap(), "tk-架构设计");
        assert_eq!(
            normalize_name("Task_Model：设计").unwrap(),
            "Task-Model-设计"
        );
        assert_eq!(
            normalize_name("  glossary (project)  ").unwrap(),
            "glossary-project"
        );
    }

    #[test]
    fn enforces_display_width() {
        assert!(normalize_name(&"a".repeat(32)).is_ok());
        assert!(normalize_name(&"a".repeat(33)).is_err());
        assert!(normalize_name(&"中".repeat(16)).is_ok());
        assert!(normalize_name(&"中".repeat(17)).is_err());
    }

    #[test]
    fn rejects_null_in_nested_extra() {
        assert!(validate_extra(&serde_json::json!({"a": [1, null]})).is_err());
    }

    #[test]
    fn allows_only_defined_status_transitions() {
        let metadata = Metadata {
            schema_version: TASK_SCHEMA_VERSION,
            id: Uuid::now_v7(),
            name: "design-tk".into(),
            status: Status::Planning,
            created_at: DateTime::parse_from_rfc3339("2026-08-28T10:00:00+08:00").unwrap(),
            depends_on: vec![],
            related_to: vec![],
            extra: BTreeMap::new(),
        };
        assert_eq!(
            metadata.clone().transition(Status::Open).unwrap().status,
            Status::Open
        );
        assert!(metadata.transition(Status::Planning).is_err());
    }
}
