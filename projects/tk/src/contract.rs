use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;

use serde::de::{DeserializeOwned, Error as _, MapAccess, SeqAccess, Visitor};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Number, Value, json};

use crate::domain::Status;
use crate::error::{Result, TkError};

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

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum SchemaType {
    Mcp,
    Native,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NativeHarness {
    Pi,
    Omp,
}

#[derive(Debug, Serialize)]
pub struct ToolContract {
    pub contract_version: u32,
    pub runtime_version: &'static str,
    pub runtime_compat: Vec<&'static str>,
    pub schema_type: SchemaType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub harness: Option<NativeHarness>,
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolDefinition {
    pub name: String,
    pub description: &'static str,
    #[serde(rename = "inputSchema")]
    pub input_schema: Value,
    #[serde(rename = "loadMode", skip_serializing_if = "Option::is_none")]
    pub load_mode: Option<&'static str>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SearchParams {
    pub query: String,
    #[serde(default)]
    pub regex: bool,
    #[serde(default)]
    pub search_body: bool,
    #[serde(default)]
    pub status: Vec<Status>,
    #[serde(default)]
    pub extra: BTreeMap<String, Value>,
    #[serde(default = "default_limit")]
    pub limit: usize,
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReadParams {
    pub task_ref: String,
    #[serde(default)]
    pub view: ToolReadView,
    #[serde(default = "default_wal_max_entries")]
    pub wal_max_entries: usize,
    #[serde(default = "default_wal_max_length")]
    pub wal_max_length: usize,
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolReadView {
    Metadata,
    #[default]
    Summary,
    Detailed,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase", deny_unknown_fields)]
pub enum CreateParams {
    Task {
        name: String,
        body: Option<String>,
        status: Option<Status>,
        created_at: Option<String>,
        #[serde(default)]
        depends_on: Vec<String>,
        #[serde(default)]
        related_to: Vec<String>,
        #[serde(default)]
        extra: BTreeMap<String, Value>,
        #[serde(default)]
        user_confirmed: bool,
        cwd: Option<PathBuf>,
    },
    Subtasks {
        parent_ref: String,
        subtasks: Vec<TaskPayload>,
        #[serde(default)]
        user_confirmed: bool,
        cwd: Option<PathBuf>,
    },
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct TaskPayload {
    pub name: String,
    pub body: Option<String>,
    pub status: Option<Status>,
    pub created_at: Option<String>,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub related_to: Vec<String>,
    #[serde(default)]
    pub extra: BTreeMap<String, Value>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct UpdateParams {
    pub task_ref: String,
    #[serde(default)]
    pub depends_on_add: Vec<String>,
    #[serde(default)]
    pub depends_on_remove: Vec<String>,
    #[serde(default)]
    pub related_to_add: Vec<String>,
    #[serde(default)]
    pub related_to_remove: Vec<String>,
    #[serde(default)]
    pub extra_set: BTreeMap<String, Value>,
    #[serde(default)]
    pub extra_remove: Vec<String>,
    #[serde(default)]
    pub start: bool,
    pub close: Option<String>,
    pub reopen: Option<String>,
    #[serde(default)]
    pub force: bool,
    #[serde(default)]
    pub user_confirmed: bool,
    pub actor: Option<String>,
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LogParams {
    pub task_ref: String,
    pub message: String,
    pub body: Option<String>,
    pub actor: Option<String>,
    pub cwd: Option<PathBuf>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExecParams {
    pub argv: Vec<String>,
    pub actor: Option<String>,
    pub cwd: Option<PathBuf>,
}

pub fn tool_contract(schema_type: SchemaType, harness: Option<NativeHarness>) -> ToolContract {
    let names = match schema_type {
        SchemaType::Mcp => ["search", "read", "create", "update", "log", "exec"],
        SchemaType::Native => [
            "tk_search",
            "tk_read",
            "tk_create",
            "tk_update",
            "tk_log",
            "tk_exec",
        ],
    };
    let descriptions = [
        "Find Task candidates by exact reference, path, keyword, or regex.",
        "Read one exact Task with a bounded view of its durable log.",
        "Create one top-level Task or 1 to 50 subtasks.",
        "Update Task relations, extra metadata, or one lifecycle action.",
        "Append one durable event to an open Task.",
        "Run one supported tk management command without a shell.",
    ];
    let schemas = [
        search_schema(),
        read_schema(),
        create_schema(),
        update_schema(),
        log_schema(),
        exec_schema(),
    ];
    ToolContract {
        contract_version: crate::version::CLI_CONTRACT_VERSION,
        runtime_version: crate::version::RUNTIME_VERSION,
        runtime_compat: vec![crate::version::RUNTIME_COMPAT],
        schema_type,
        harness,
        tools: names
            .into_iter()
            .zip(descriptions)
            .zip(schemas)
            .map(|((name, description), input_schema)| ToolDefinition {
                name: name.into(),
                description,
                input_schema,
                load_mode: match harness {
                    Some(NativeHarness::Omp) if matches!(name, "tk_search" | "tk_exec") => {
                        Some("discoverable")
                    }
                    Some(NativeHarness::Omp) => Some("essential"),
                    _ => None,
                },
            })
            .collect(),
    }
}

fn search_schema() -> Value {
    object_schema(
        json!({
            "query": {"type": "string", "minLength": 1},
            "regex": {"type": "boolean", "default": false},
            "search_body": {"type": "boolean", "default": false},
            "status": {"type": "array", "items": status_schema(), "uniqueItems": true},
            "extra": extra_schema(),
            "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
            "cwd": {"type": "string"}
        }),
        &["query"],
    )
}

fn read_schema() -> Value {
    object_schema(
        json!({
            "task_ref": {"type": "string", "minLength": 1},
            "view": {"type": "string", "enum": ["metadata", "summary", "detailed"], "default": "summary"},
            "wal_max_entries": {"type": "integer", "minimum": 0, "maximum": 1000, "default": 20},
            "wal_max_length": {"type": "integer", "minimum": 0, "maximum": 1048576, "default": 16384},
            "cwd": {"type": "string"}
        }),
        &["task_ref"],
    )
}

fn create_schema() -> Value {
    let task = task_payload_schema();
    json!({
        "oneOf": [
            object_schema(
                json!({
                    "type": {"const": "task"},
                    "name": {"type": "string", "minLength": 1},
                    "body": {"type": "string"},
                    "status": {"type": "string", "enum": ["planning", "open"], "default": "open"},
                    "created_at": {"type": "string", "format": "date-time"},
                    "depends_on": ref_array_schema(),
                    "related_to": ref_array_schema(),
                    "extra": extra_schema(),
                    "user_confirmed": {"type": "boolean", "default": false},
                    "cwd": {"type": "string"}
                }),
                &["type", "name"]
            ),
            object_schema(
                json!({
                    "type": {"const": "subtasks"},
                    "parent_ref": {"type": "string", "minLength": 1},
                    "subtasks": {"type": "array", "items": task, "minItems": 1, "maxItems": 50},
                    "user_confirmed": {"type": "boolean", "default": false},
                    "cwd": {"type": "string"}
                }),
                &["type", "parent_ref", "subtasks"]
            )
        ]
    })
}

fn task_payload_schema() -> Value {
    object_schema(
        json!({
            "name": {"type": "string", "minLength": 1},
            "body": {"type": "string"},
            "status": {"type": "string", "enum": ["planning", "open"]},
            "created_at": {"type": "string", "format": "date-time"},
            "depends_on": ref_array_schema(),
            "related_to": ref_array_schema(),
            "extra": extra_schema()
        }),
        &["name"],
    )
}

fn update_schema() -> Value {
    object_schema(
        json!({
            "task_ref": {"type": "string", "minLength": 1},
            "depends_on_add": ref_array_schema(),
            "depends_on_remove": ref_array_schema(),
            "related_to_add": ref_array_schema(),
            "related_to_remove": ref_array_schema(),
            "extra_set": extra_schema(),
            "extra_remove": ref_array_schema(),
            "start": {"type": "boolean", "default": false},
            "close": {"type": "string", "minLength": 1},
            "reopen": {"type": "string", "minLength": 1},
            "force": {"type": "boolean", "default": false},
            "user_confirmed": {"type": "boolean", "default": false},
            "actor": {"type": "string", "minLength": 1},
            "cwd": {"type": "string"}
        }),
        &["task_ref"],
    )
}

fn log_schema() -> Value {
    object_schema(
        json!({
            "task_ref": {"type": "string", "minLength": 1},
            "message": {"type": "string", "minLength": 1},
            "body": {"type": "string"},
            "actor": {"type": "string", "minLength": 1},
            "cwd": {"type": "string"}
        }),
        &["task_ref", "message"],
    )
}

fn exec_schema() -> Value {
    object_schema(
        json!({
            "argv": {"type": "array", "items": {"type": "string", "minLength": 1}, "minItems": 1},
            "actor": {"type": "string", "minLength": 1},
            "cwd": {"type": "string"}
        }),
        &["argv"],
    )
}

fn object_schema(properties: Value, required: &[&str]) -> Value {
    let mut schema = json!({
        "type": "object",
        "properties": properties,
        "additionalProperties": false
    });
    if !required.is_empty() {
        schema["required"] = json!(required);
    }
    schema
}

fn status_schema() -> Value {
    json!({"type": "string", "enum": ["planning", "open", "closed"]})
}

fn ref_array_schema() -> Value {
    json!({"type": "array", "items": {"type": "string", "minLength": 1}, "uniqueItems": true})
}

fn extra_schema() -> Value {
    json!({"type": "object"})
}

fn default_limit() -> usize {
    20
}

fn default_wal_max_entries() -> usize {
    20
}

fn default_wal_max_length() -> usize {
    16384
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use serde_json::Value;

    use super::*;

    #[test]
    fn rejects_duplicate_keys_at_any_depth() {
        assert!(parse_json_object::<BTreeMap<String, Value>>(r#"{"a":{"x":1,"x":2}}"#).is_err());
    }

    #[test]
    fn rejects_non_object_input() {
        assert!(parse_json_object::<BTreeMap<String, Value>>("[]").is_err());
    }

    #[test]
    fn actor_is_limited_to_wal_writers() {
        let contract = tool_contract(SchemaType::Native, Some(NativeHarness::Pi));
        for tool in contract.tools {
            let properties = if tool.name == "tk_create" {
                for branch in tool.input_schema["oneOf"].as_array().unwrap() {
                    assert!(branch["properties"].get("actor").is_none());
                }
                continue;
            } else {
                tool.input_schema["properties"].as_object().unwrap()
            };
            assert_eq!(
                properties.contains_key("actor"),
                matches!(tool.name.as_str(), "tk_update" | "tk_log" | "tk_exec")
            );
        }
    }

    #[test]
    fn only_omp_contract_has_load_modes() {
        let pi = tool_contract(SchemaType::Native, Some(NativeHarness::Pi));
        assert!(pi.tools.iter().all(|tool| tool.load_mode.is_none()));
        let omp = tool_contract(SchemaType::Native, Some(NativeHarness::Omp));
        assert_eq!(
            omp.tools
                .iter()
                .find(|tool| tool.name == "tk_search")
                .unwrap()
                .load_mode,
            Some("discoverable")
        );
    }
}
