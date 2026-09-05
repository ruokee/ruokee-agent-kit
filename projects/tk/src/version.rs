use crate::error::{ErrorCategory, Result, TkError};

pub const RUNTIME_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const RUNTIME_COMPAT: &str = ">=0.1,<0.2";
pub const CLI_CONTRACT_VERSION: u32 = 2;
pub const TASK_SCHEMA_VERSION: u32 = 1;
pub const COMPONENT_FORMAT_VERSION: u32 = 3;

pub fn require_compatible(requirement: &str) -> Result<()> {
    let runtime = Version::parse(RUNTIME_VERSION)?;
    if !requirement.is_empty()
        && requirement
            .split(',')
            .all(|clause| matches_clause(runtime, clause))
    {
        return Ok(());
    }
    Err(TkError::new(
        "runtime_incompatible",
        ErrorCategory::Compatibility,
        format!("Runtime {RUNTIME_VERSION} does not satisfy {requirement}"),
    ))
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
struct Version(u64, u64, u64);

impl Version {
    fn parse(value: &str) -> Result<Self> {
        let core = value.split_once('-').map_or(value, |(core, _)| core);
        let mut parts = core.split('.');
        let major = parse_part(parts.next(), value)?;
        let minor = parse_part(parts.next(), value)?;
        let patch = parse_part(parts.next(), value)?;
        if parts.next().is_some() {
            return Err(invalid_range(value));
        }
        Ok(Self(major, minor, patch))
    }

    fn parse_partial(value: &str) -> Result<(Self, u8)> {
        let mut parts = value.trim().split('.');
        let major = parse_part(parts.next(), value)?;
        let minor_part = parts.next();
        let minor = minor_part
            .map(|part| part.parse().map_err(|_| invalid_range(value)))
            .transpose()?
            .unwrap_or(0);
        let patch_part = parts.next();
        let patch = patch_part
            .map(|part| part.parse().map_err(|_| invalid_range(value)))
            .transpose()?
            .unwrap_or(0);
        if parts.next().is_some() {
            return Err(invalid_range(value));
        }
        let precision = if patch_part.is_some() {
            3
        } else if minor_part.is_some() {
            2
        } else {
            1
        };
        Ok((Self(major, minor, patch), precision))
    }
}

fn matches_clause(runtime: Version, clause: &str) -> bool {
    parse_clause(clause).is_ok_and(|(operator, required, precision)| match operator {
        ">=" => runtime >= required,
        "<=" if precision < 3 => prefix_upper(required, precision).is_none_or(|end| runtime < end),
        "<=" => runtime <= required,
        ">" if precision < 3 => prefix_upper(required, precision).is_some_and(|end| runtime >= end),
        ">" => runtime > required,
        "<" => runtime < required,
        "=" | "==" if precision < 3 => {
            runtime >= required && prefix_upper(required, precision).is_none_or(|end| runtime < end)
        }
        "=" | "==" => runtime == required,
        _ => false,
    })
}

fn parse_clause(value: &str) -> Result<(&str, Version, u8)> {
    let value = value.trim();
    let operator = [">=", "<=", "==", ">", "<", "="]
        .into_iter()
        .find(|operator| value.starts_with(operator))
        .unwrap_or("=");
    let version = value.strip_prefix(operator).unwrap_or(value);
    let (version, precision) = Version::parse_partial(version)?;
    Ok((operator, version, precision))
}

fn prefix_upper(version: Version, precision: u8) -> Option<Version> {
    match precision {
        1 => version.0.checked_add(1).map(|major| Version(major, 0, 0)),
        2 => version
            .1
            .checked_add(1)
            .map(|minor| Version(version.0, minor, 0)),
        _ => None,
    }
}

fn parse_part(value: Option<&str>, source: &str) -> Result<u64> {
    value
        .ok_or_else(|| invalid_range(source))?
        .parse()
        .map_err(|_| invalid_range(source))
}

fn invalid_range(value: &str) -> TkError {
    TkError::request(
        "invalid_runtime_compatibility_range",
        format!("Invalid runtime compatibility version: {value}"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_comma_joined_range() {
        assert!(require_compatible(">=0.1,<0.2").is_ok());
        assert!(require_compatible(">=1").is_err());
    }

    #[test]
    fn treats_partial_versions_as_prefixes() {
        assert!(require_compatible("==0").is_ok());
        assert!(require_compatible("==0.1").is_ok());
        assert!(require_compatible("<=0").is_ok());
        assert!(require_compatible(">0").is_err());
        assert!(require_compatible(">0.0").is_ok());
        assert!(require_compatible("<=0.0").is_err());
    }
}
