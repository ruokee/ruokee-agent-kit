#!/bin/sh
#
# Manage the ordinary Skills in this repository.
#
#   sh scripts/skills.sh check [SKILL...] --target DIR [--language en|zh]
#   sh scripts/skills.sh install SKILL --target DIR [--language en|zh] [--replace]
#   sh scripts/skills.sh uninstall SKILL --target DIR [--yes]
#
# The repository is the directory above this script. An English source is
# skills/<name>; a Chinese source is variants/zh/skills/<name>. Both install at
# <target>/<name>. The script never uses the network and never edits a Harness
# configuration.
#
# Every location a write operation would use is resolved and checked before the
# first write, and both source trees are protected whatever --language selects.
#
# Exit status:
#   0  complete, or nothing needed to change
#   1  nothing changed: a decision is required, or a named Skill is not installed
#   2  failed: usage, name, path, read, comparison, or file operation failure

set -u

EXIT_OK=0
EXIT_DECIDE=1
EXIT_FAIL=2

PROG=skills.sh
NL='
'
NAME_PATTERN='^[A-Za-z0-9][A-Za-z0-9._-]*$'
SKILL_FILE=SKILL.md
LIST_LIMIT=20

command_name=
target_root=
language=en
replace=no
assume_yes=no
names=

staging_dir=
old_dir=

fail() {
  printf '%s: error: %s\n' "$PROG" "$*" >&2
  exit "$EXIT_FAIL"
}

usage() {
  cat <<'EOF'
Manage the ordinary Skills in this repository.

Usage:
  skills.sh check [SKILL...] --target DIR [--language en|zh]
  skills.sh install SKILL --target DIR [--language en|zh] [--replace]
  skills.sh uninstall SKILL --target DIR [--yes]
  skills.sh --help

Commands:
  check      Compare the Skills installed under DIR with this repository. With no
             SKILL, compare every installed Skill of the language and report the
             rest as a count. Read only: it creates no target, backup, or state file.
  install    Copy one Skill into DIR. Identical content reports no change; different
             content stops unless --replace authorizes replacing that exact target
             after its current content is backed up.
  uninstall  Remove one Skill from DIR. Stops unless --yes confirms the exact target.
             A plain directory is backed up before it is removed; a top-level symlink
             is only unlinked.

Options:
  --target DIR   Parent Skill root. Required; the script never guesses it. A Skill is
                 managed as DIR/<name>. Use the root your Harness loads, for example
                 "$HOME/.omp/agent/skills" for user-level OMP Skills.
  --language L   en (default) or zh. en reads skills/<name>, zh reads
                 variants/zh/skills/<name>. Both install at DIR/<name>.
  --replace      install only: authorize replacing the exact target.
  --yes          uninstall only: confirm removing the exact target.
  -h, --help     Print this text.

Sources:
  The script reads the checkout that contains it and never uses the network. A
  comparison reads the files as they are on disk: in a Git checkout the report prints
  HEAD and the uncommitted changes under the compared sources, and does not present
  working-tree content as that commit.

Backups:
  An operation without authorization changes nothing. An authorized replacement or
  removal first copies the previous target into
  ${XDG_STATE_HOME:-$HOME/.local/state}/ruokee-agent-kit/skill-backups/ and prints the
  exact path. The location is checked before anything is created; it is refused when it
  would fall inside a source tree or inside the target Skill root.

Exit status:
  0  comparison consistent, installed, no change, or removed
  1  nothing changed: --replace or --yes is required, the installed target differs
     from the source, or a named Skill is absent
  2  usage, name, path, read, comparison, refusal, or file operation failure

Notes:
  A comparison covers the whole directory: file content, added files, and removed files
  plus the version declared in SKILL.md; diff(1) reports the differences. A tree that
  cannot be read is a failure, not a difference and not a match. Without an earlier
  baseline a comparison cannot tell whether a difference came from the repository or from
  local edits, so it is not an authorization to overwrite. An identical target is not
  proof that a running Harness has loaded that version. A write is refused before
  anything is created when it would reach the repository Skill sources or place a backup
  inside them. Restore steps for a backup are documented in docs/installation.md.
EOF
}

# ---------------------------------------------------------------- file helpers

# Print the entries below a directory that are neither a regular file nor a
# directory: symlinks, FIFOs, sockets, and devices. Such an entry is refused
# instead of followed or read. Returns 1 when the tree cannot be read in full,
# after printing the reason to stderr.
list_unsupported() {
  unsupported_out=$(
    CDPATH= cd -P -- "$1" || exit 1
    find . \( ! -type f ! -type d \) -print 2>&1
  ) || {
    if [ -n "$unsupported_out" ]; then
      printf '%s\n' "$unsupported_out" >&2
    fi
    return 1
  }
  printf '%s\n' "$unsupported_out" | LC_ALL=C sed -e '/^$/d'
  return 0
}

# Count the regular files below a directory. Used for the install summary only.
count_files() {
  find -- "$1" -type f -print 2>/dev/null | LC_ALL=C wc -l | LC_ALL=C tr -d ' '
}

count_lines() {
  if [ -z "$1" ]; then
    printf '0\n'
  else
    printf '%s\n' "$1" | LC_ALL=C grep -c '[^[:space:]]' || true
  fi
}

add_name() {
  if [ -z "$names" ]; then
    names=$1
  else
    names=$names$NL$1
  fi
}

# Print each non-empty line of a newline-separated list, capped with a count of
# the remaining entries.
print_list() {
  print_total=$(count_lines "$2")
  if [ "$print_total" -eq 0 ]; then
    return 0
  fi
  print_rest=$2
  print_shown=0
  while [ -n "$print_rest" ]; do
    print_line=${print_rest%%"$NL"*}
    case $print_rest in
      *"$NL"*) print_rest=${print_rest#*"$NL"} ;;
      *) print_rest= ;;
    esac
    [ -n "$print_line" ] || continue
    print_shown=$((print_shown + 1))
    if [ "$print_shown" -gt "$LIST_LIMIT" ]; then
      printf '%s... %s more\n' "$1" "$((print_total - LIST_LIMIT))"
      return 0
    fi
    printf '%s%s\n' "$1" "$print_line"
  done
}

# Print each non-empty line of a newline-separated list without a cap.
print_indented() {
  print_rest=$2
  while [ -n "$print_rest" ]; do
    print_line=${print_rest%%"$NL"*}
    case $print_rest in
      *"$NL"*) print_rest=${print_rest#*"$NL"} ;;
      *) print_rest= ;;
    esac
    [ -n "$print_line" ] || continue
    printf '%s%s\n' "$1" "$print_line"
  done
}

# Resolve a path to an absolute physical path without creating anything. The
# deepest existing prefix is resolved through its symbolic links and the
# remaining components are appended, so a path with several missing components
# below a link still resolves to the location a write would reach.
#
# A missing component of "." or ".." is refused: a path that does not exist yet
# cannot be resolved physically, because the later mkdir follows the original
# spelling (symbolic links included) instead of a lexically folded one. Sets
# RESOLVED on success and RESOLVE_REASON when the path is refused.
resolve_path() {
  resolve_in=$1
  RESOLVED=
  RESOLVE_REASON=
  case $resolve_in in
    /*) resolve_walk=$resolve_in ;;
    *) resolve_walk=$PWD/$resolve_in ;;
  esac
  resolve_tail=
  while :; do
    if [ -e "$resolve_walk" ] || [ -L "$resolve_walk" ]; then
      break
    fi
    case $resolve_walk in
      ''|/) break ;;
    esac
    resolve_component=$(basename -- "$resolve_walk")
    case $resolve_component in
      '.'|'..')
        RESOLVE_REASON="a missing path component is '$resolve_component'"
        return 1
        ;;
    esac
    resolve_tail=$resolve_component${resolve_tail:+/$resolve_tail}
    resolve_walk=$(dirname -- "$resolve_walk")
  done

  if [ -d "$resolve_walk" ]; then
    resolve_head=$(CDPATH= cd -P -- "$resolve_walk" && pwd -P) || return 1
  elif [ -n "$resolve_walk" ] && [ "$resolve_walk" != / ]; then
    resolve_parent=$(dirname -- "$resolve_walk")
    resolve_component=$(basename -- "$resolve_walk")
    resolve_head=$(CDPATH= cd -P -- "$resolve_parent" && pwd -P) || return 1
    resolve_head=$resolve_head/$resolve_component
  else
    resolve_head=/
  fi

  case $resolve_tail in
    '') RESOLVED=$resolve_head ;;
    *) RESOLVED=$resolve_head/$resolve_tail ;;
  esac
  normalize_path "$RESOLVED" || return 1
  RESOLVED=$NORMALIZED
  return 0
}

# Normalize a path lexically. Sets NORMALIZED.
normalize_path() {
  normalize_in=$1
  case $normalize_in in
    /*) NORMALIZED= ;;
    *) NORMALIZED=$PWD ;;
  esac
  normalize_rest=$normalize_in
  while [ -n "$normalize_rest" ]; do
    case $normalize_rest in
      */*)
        normalize_comp=${normalize_rest%%/*}
        normalize_rest=${normalize_rest#*/}
        ;;
      *)
        normalize_comp=$normalize_rest
        normalize_rest=
        ;;
    esac
    case $normalize_comp in
      ''|'.') continue ;;
      '..')
        case $NORMALIZED in
          ''|/) ;;
          *) NORMALIZED=$(dirname -- "$NORMALIZED") ;;
        esac
        ;;
      *) NORMALIZED=$NORMALIZED/$normalize_comp ;;
    esac
  done
  [ -n "$NORMALIZED" ] || NORMALIZED=/
  return 0
}

# Fail with the reason resolve_path refused a path, when it recorded one.
fail_resolve() {
  if [ -n "$RESOLVE_REASON" ]; then
    fail "cannot resolve the $1: $2 ($RESOLVE_REASON)"
  fi
  fail "cannot resolve the $1: $2"
}

# Set SRC_EN and SRC_ZH to the physical paths of both source trees.
source_trees() {
  resolve_path "$REPO/skills" || fail_resolve "Skill source" "$REPO/skills"
  SRC_EN=$RESOLVED
  resolve_path "$REPO/variants/zh/skills" ||
    fail_resolve "Skill source" "$REPO/variants/zh/skills"
  SRC_ZH=$RESOLVED
  return 0
}

# Refuse a write destination that is a repository Skill source, inside one, or
# above one. Both trees are checked whatever --language selected, so a write can
# never reach the other language variant either.
refuse_source_path() {
  refuse_path=$1
  refuse_label=$2
  for refuse_source in "$SRC_EN" "$SRC_ZH"; do
    if [ "$refuse_path" = "$refuse_source" ]; then
      fail "the $refuse_label is the repository Skill source: $refuse_path"
    fi
    case $refuse_path in
      "$refuse_source"/*)
        fail "the $refuse_label is inside the repository Skill source: $refuse_path"
        ;;
    esac
    case $refuse_source in
      "$refuse_path"/*)
        fail "the $refuse_label would contain the repository Skill source $refuse_source: $refuse_path"
        ;;
    esac
  done
  return 0
}

# Check every location a write operation would use before anything is created:
# the Skill root, the Skill entry, and the backup directory. A Skill entry that
# is a symlink is left out on purpose: the script replaces or unlinks the link
# itself and never writes through it.
guard_writes() {
  guard_entry=$1
  refuse_source_path "$ROOT_RESOLVED" "target Skill root"
  if [ ! -L "$guard_entry" ]; then
    resolve_path "$guard_entry" || fail_resolve "target entry" "$guard_entry"
    refuse_source_path "$RESOLVED" "target Skill directory"
  fi
  guard_backup=$(state_dir)
  resolve_path "$guard_backup" || fail_resolve "backup directory" "$guard_backup"
  guard_backup=$RESOLVED
  refuse_source_path "$guard_backup" "backup directory"
  case $guard_backup in
    "$ROOT_RESOLVED"|"$ROOT_RESOLVED"/*)
      fail "the backup directory would be inside the target Skill root: $guard_backup"
      ;;
  esac
  return 0
}

# Fail unless the tree at $2 matches the tree at $1. $3 names the compared copy
# in the message.
require_same_tree() {
  require_status=0
  compare_trees "$1" "$2" || require_status=$?
  if [ "$require_status" -eq 0 ]; then
    return 0
  fi
  if [ "$require_status" -eq 1 ]; then
    fail "$3 does not match $1"
  fi
  fail "$3 cannot be read: $CMP_REASON"
}

# Print the restore pointer for a backup directory that was just written.
print_restore_note() {
  printf '  note     restore steps are documented in %s\n' "$RESTORE_DOC"
}

# Print the version declared in SKILL.md frontmatter under metadata.version.
# Prints nothing when it is absent or not a plain scalar.
read_version() {
  [ -f "$1" ] || return 0
  awk '
    NR == 1 && $0 == "---" { frontmatter = 1; next }
    frontmatter && $0 == "---" { exit }
    frontmatter {
      if ($0 ~ /^metadata:[ \t]*$/) { in_metadata = 1; next }
      if ($0 ~ /^[^ \t]/) { in_metadata = 0; next }
      if (in_metadata && $0 ~ /^[ \t]+version:[ \t]*/) {
        value = $0
        sub(/^[ \t]+version:[ \t]*/, "", value)
        sub(/[ \t]+$/, "", value)
        if (value ~ /^".*"$/ || value ~ /^'"'"'.*'"'"'$/) {
          value = substr(value, 2, length(value) - 2)
        }
        print value
        exit
      }
    }
  ' "$1" 2>/dev/null
}

# Compare the tree at $2 with the tree at $1. Returns 0 when every entry
# matches, 1 when they differ, and 2 when either tree cannot be read or
# compared. Sets CMP_REPORT to the difference lines and CMP_REASON to the
# failure text.
#
# diff(1) reads and compares the trees, so permission handling and entry
# comparison stay in one standard tool. Entries that are neither files nor
# directories are refused first: diff(1) would follow a link or block on a FIFO.
compare_trees() {
  CMP_REPORT=
  CMP_REASON=
  compare_src=$1
  compare_dst=$2

  if ! unsupported=$(list_unsupported "$compare_src"); then
    CMP_REASON="cannot read the source directory: $compare_src"
    return 2
  fi
  if [ -n "$unsupported" ]; then
    CMP_REASON="the source holds entries that are not regular files or directories:$NL$unsupported"
    return 2
  fi
  if ! unsupported=$(list_unsupported "$compare_dst"); then
    CMP_REASON="cannot read the installed directory: $compare_dst"
    return 2
  fi
  if [ -n "$unsupported" ]; then
    CMP_REASON="the installed directory holds entries that are not regular files or directories:$NL$unsupported"
    return 2
  fi

  compare_output=$(LC_ALL=C diff -r -q -- "$compare_src" "$compare_dst" 2>&1)
  compare_status=$?
  if [ "$compare_status" -eq 0 ]; then
    return 0
  fi
  if [ "$compare_status" -gt 1 ]; then
    CMP_REASON=$compare_output
    return 2
  fi
  # A read error reported as a difference must not pass as one.
  if printf '%s\n' "$compare_output" | LC_ALL=C grep -q '^diff:'; then
    CMP_REASON=$compare_output
    return 2
  fi
  CMP_REPORT=$compare_output
  return 1
}

# ---------------------------------------------------------------- environment

script_dir_of() {
  case $0 in
    */*) script_arg=$0 ;;
    *)
      script_arg=$(command -v "$0" 2>/dev/null) || script_arg=$0
      ;;
  esac
  script_arg_dir=$(dirname -- "$script_arg")
  CDPATH= cd -P -- "$script_arg_dir" && pwd -P
}

SCRIPT_DIR=$(script_dir_of) || {
  printf '%s: error: cannot resolve the script directory\n' "$PROG" >&2
  exit "$EXIT_FAIL"
}
REPO=$(CDPATH= cd -P -- "$SCRIPT_DIR/.." && pwd -P) || {
  printf '%s: error: cannot resolve the repository directory\n' "$PROG" >&2
  exit "$EXIT_FAIL"
}
RESTORE_DOC=$REPO/docs/installation.md

source_root_for_language() {
  case $1 in
    en) printf '%s\n' "$REPO/skills" ;;
    zh) printf '%s\n' "$REPO/variants/zh/skills" ;;
    *) fail "unsupported language: $1 (use en or zh)" ;;
  esac
}

# Collect the source names that hold a SKILL.md.
source_names() {
  source_names_root=$1
  source_names_out=
  [ -d "$source_names_root" ] || return 0
  for source_names_entry in "$source_names_root"/*/; do
    [ -d "$source_names_entry" ] || continue
    [ -f "$source_names_entry$SKILL_FILE" ] || continue
    source_names_name=$(basename -- "$source_names_entry")
    source_names_out=$source_names_out$source_names_name$NL
  done
  printf '%s' "$source_names_out"
}

state_dir() {
  if [ -n "${XDG_STATE_HOME:-}" ]; then
    printf '%s\n' "$XDG_STATE_HOME/ruokee-agent-kit/skill-backups"
  else
    printf '%s\n' "${HOME:-$PWD}/.local/state/ruokee-agent-kit/skill-backups"
  fi
}

# Create a new backup directory and print its path. guard_writes has already
# checked this location, so nothing here creates anything outside the state
# directory.
new_backup_dir() {
  backup_name=$1
  backup_base=$(state_dir)
  backup_stamp=$(date +%Y%m%d-%H%M%S 2>/dev/null) || fail "cannot read the current time"
  mkdir -p -- "$backup_base" || fail "cannot create the backup directory: $backup_base"
  backup_suffix=0
  while :; do
    if [ "$backup_suffix" -eq 0 ]; then
      backup_candidate=$backup_base/$backup_stamp-$backup_name
    else
      backup_candidate=$backup_base/$backup_stamp-$backup_name-$backup_suffix
    fi
    if mkdir -- "$backup_candidate" 2>/dev/null; then
      printf '%s\n' "$backup_candidate"
      return 0
    fi
    backup_suffix=$((backup_suffix + 1))
    if [ "$backup_suffix" -gt 100 ]; then
      fail "cannot create a new backup directory below $backup_base"
    fi
  done
}

cleanup() {
  [ -n "$staging_dir" ] || return 0
  [ -e "$staging_dir" ] || return 0
  if ! rm -rf -- "$staging_dir"; then
    printf '%s: error: the staged copy could not be removed and remains: %s\n' \
      "$PROG" "$staging_dir" >&2
  fi
  return 0
}

trap cleanup EXIT

# ---------------------------------------------------------------- validation

validate_skill_name() {
  name_value=$1
  [ -n "$name_value" ] || fail "an empty Skill name is not valid"
  if ! printf '%s\n' "$name_value" | LC_ALL=C grep -Eq "$NAME_PATTERN"; then
    fail "not a valid Skill name: $name_value"
  fi
  case $name_value in
    .|..) fail "not a valid Skill name: $name_value" ;;
  esac
  return 0
}

require_source() {
  source_dir=$1
  source_label=$2
  [ -d "$source_dir" ] || fail "no such $source_label source directory: $source_dir"
  if [ ! -f "$source_dir/$SKILL_FILE" ]; then
    fail "the source has no $SKILL_FILE: $source_dir"
  fi
  unsupported=$(list_unsupported "$source_dir") ||
    fail "cannot read the source directory: $source_dir"
  if [ -n "$unsupported" ]; then
    printf '%s: error: the source contains entries that are not regular files or directories:\n' "$PROG" >&2
    print_indented '  ' "$unsupported" >&2
    fail "refusing to copy $source_dir"
  fi
  return 0
}

# Set ROOT_RESOLVED from target_root without creating it, and set ROOT_EXISTS.
# ROOT_RESOLVED is the physical path a later write would reach, so guard_writes
# can refuse it before any directory is created.
resolve_target_root() {
  if [ -L "$target_root" ] && [ ! -d "$target_root" ]; then
    fail "the target root is a broken symlink: $target_root"
  fi
  if [ -e "$target_root" ] && [ ! -d "$target_root" ]; then
    fail "the target root is not a directory: $target_root"
  fi
  resolve_path "$target_root" || fail_resolve "target root" "$target_root"
  ROOT_RESOLVED=$RESOLVED
  if [ -d "$target_root" ]; then
    ROOT_EXISTS=yes
  else
    ROOT_EXISTS=no
  fi
  return 0
}

# Create the target root for an operation that is about to write.
create_target_root() {
  [ "$ROOT_EXISTS" = no ] || return 0
  mkdir -p -- "$target_root" || fail "cannot create the target root: $target_root"
  resolve_path "$target_root" || fail_resolve "target root" "$target_root"
  ROOT_RESOLVED=$RESOLVED
  ROOT_EXISTS=yes
  return 0
}

print_source_line() {
  printf '  source   %s' "$1"
  if [ -n "$2" ]; then
    printf '  version %s' "$2"
  else
    printf '  version unknown'
  fi
  printf '\n'
}

# ---------------------------------------------------------------- check

git_report() {
  git_head=
  git_branch=
  git_dirty=
  command -v git >/dev/null 2>&1 || return 0
  git_head=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null) || git_head=
  [ -n "$git_head" ] || return 0
  git_branch=$(git -C "$REPO" symbolic-ref --short -q HEAD 2>/dev/null) || git_branch=
  [ -n "$git_branch" ] || git_branch=detached
  git_dirty=$(git -C "$REPO" status --porcelain -- "$SOURCE_ROOT" 2>/dev/null) || git_dirty=
  return 0
}

cmd_check() {
  SOURCE_ROOT=$(source_root_for_language "$language")
  [ -d "$SOURCE_ROOT" ] || fail "this repository has no Skill source directory for '$language': $SOURCE_ROOT"

  resolve_target_root
  refuse_source_path "$ROOT_RESOLVED" "target Skill root"

  check_names=$names
  scan_all=no
  if [ -z "$check_names" ]; then
    scan_all=yes
    check_names=$(source_names "$SOURCE_ROOT")
  fi

  identical=0
  differing=0
  missing=0
  compare_failed=no

  printf '%s check: language %s\n' "$PROG" "$language"
  printf 'repository   %s\n' "$REPO"
  printf 'sources      %s\n' "$SOURCE_ROOT"
  printf 'target root  %s\n' "$target_root"

  git_report
  if [ -n "$git_head" ]; then
    printf 'git          HEAD %s on %s\n' "$git_head" "$git_branch"
    if [ -n "$git_dirty" ]; then
      printf '             uncommitted changes under the compared sources:\n'
      print_indented '               ' "$git_dirty"
      printf '             the comparison uses these files as they are on disk, not as stored in %s\n' "$git_head"
    else
      printf '             uncommitted changes under the compared sources: none\n'
    fi
  fi

  if [ "$ROOT_EXISTS" = no ]; then
    printf 'target note  the target root does not exist: %s\n' "$target_root"
  fi

  check_rest=$check_names
  while [ -n "$check_rest" ]; do
    check_name=${check_rest%%"$NL"*}
    case $check_rest in
      *"$NL"*) check_rest=${check_rest#*"$NL"} ;;
      *) check_rest= ;;
    esac
    [ -n "$check_name" ] || continue
    validate_skill_name "$check_name"

    check_src=$SOURCE_ROOT/$check_name
    [ -d "$check_src" ] || fail "not a Skill in this repository: $check_name (language $language)"
    [ -f "$check_src/$SKILL_FILE" ] || fail "the source has no $SKILL_FILE: $check_src"
    check_src_version=$(read_version "$check_src/$SKILL_FILE")
    check_dst=$ROOT_RESOLVED/$check_name

    if ! unsupported=$(list_unsupported "$check_src"); then
      printf '\n%s\n' "$check_name"
      print_source_line "$check_src" "$check_src_version"
      printf '%s: error: cannot read the source directory: %s\n' "$PROG" "$check_src" >&2
      compare_failed=yes
      continue
    fi
    if [ -n "$unsupported" ]; then
      printf '\n%s\n' "$check_name"
      print_source_line "$check_src" "$check_src_version"
      printf '%s: error: the source contains entries that are not regular files or directories:\n' "$PROG" >&2
      print_indented '  ' "$unsupported" >&2
      printf '%s: error: cannot compare %s\n' "$PROG" "$check_src" >&2
      compare_failed=yes
      continue
    fi

    if [ ! -e "$check_dst" ] && [ ! -L "$check_dst" ]; then
      missing=$((missing + 1))
      if [ "$scan_all" = yes ]; then
        continue
      fi
      printf '\n%s\n' "$check_name"
      print_source_line "$check_src" "$check_src_version"
      printf '  target   %s\n' "$check_dst"
      printf '  state    not installed\n'
      printf '  next     sh scripts/skills.sh install %s --language %s --target %s\n' \
        "$check_name" "$language" "$(quote_arg "$target_root")"
      continue
    fi

    check_link=no
    check_link_target=
    if [ -L "$check_dst" ]; then
      check_link=yes
      check_link_target=$(readlink -- "$check_dst" 2>/dev/null) || check_link_target=
    fi

    printf '\n%s\n' "$check_name"
    print_source_line "$check_src" "$check_src_version"

    if [ "$check_link" = yes ] && [ ! -d "$check_dst" ]; then
      differing=$((differing + 1))
      printf '  target   %s\n' "$check_dst"
      printf '  link     broken symlink -> %s\n' "$check_link_target"
      printf '  state    broken symlink; not the installed content\n'
      printf '  next     sh scripts/skills.sh install %s --language %s --target %s --replace\n' \
        "$check_name" "$language" "$(quote_arg "$target_root")"
      printf '           (replaces the link and leaves its former target alone)\n'
      continue
    fi

    if [ "$check_link" = yes ]; then
      printf '  target   %s  (symlink -> %s)\n' "$check_dst" "$check_link_target"
    else
      printf '  target   %s  (plain directory)\n' "$check_dst"
    fi

    check_dst_version=$(read_version "$check_dst/$SKILL_FILE")
    compare_trees "$check_src" "$check_dst"
    check_compare=$?

    if [ "$check_compare" -eq 2 ]; then
      compare_failed=yes
      printf '  state    cannot compare\n'
      print_indented '  reason   ' "$CMP_REASON"
      printf '%s: error: cannot compare %s with %s\n' "$PROG" "$check_src" "$check_dst" >&2
      continue
    fi

    if [ -n "$check_dst_version" ]; then
      printf '  version  target %s, source %s\n' "$check_dst_version" "${check_src_version:-unknown}"
    else
      printf '  version  target unknown, source %s\n' "${check_src_version:-unknown}"
    fi

    if [ "$check_compare" -eq 1 ]; then
      differing=$((differing + 1))
      printf '  state    differs\n'
      print_list '  diff     ' "$CMP_REPORT"
      printf '  note     this shows the current difference only; without an earlier baseline it cannot say whether the repository or the local copy changed\n'
      printf '  next     diff -ru %s %s\n' "$(quote_arg "$check_src")" "$(quote_arg "$check_dst")"
      printf '  next     sh scripts/skills.sh install %s --language %s --target %s --replace\n' \
        "$check_name" "$language" "$(quote_arg "$target_root")"
      printf '           (backs up the current target, then replaces the whole directory)\n'
    else
      identical=$((identical + 1))
      printf '  state    identical\n'
      if [ "$check_link" = yes ]; then
        printf '  note     this target is a symlink; its content follows %s\n' "$check_link_target"
      fi
    fi
  done

  printf '\nsummary %s identical, %s differing' "$identical" "$differing"
  if [ "$scan_all" = yes ]; then
    printf ', %s not installed' "$missing"
  fi
  if [ "$compare_failed" = yes ]; then
    printf ', at least one Skill could not be compared'
  fi
  printf '\n'

  if [ "$compare_failed" = yes ]; then
    return "$EXIT_FAIL"
  fi
  if [ "$differing" -gt 0 ]; then
    return "$EXIT_DECIDE"
  fi
  if [ "$scan_all" = no ] && [ "$missing" -gt 0 ]; then
    return "$EXIT_DECIDE"
  fi
  return "$EXIT_OK"
}

# ---------------------------------------------------------------- arguments

quote_arg() {
  case $1 in
    *[!A-Za-z0-9._/-]*|'') printf "'%s'" "$(printf '%s' "$1" | sed -e "s/'/'\\\\''/g")" ;;
    *) printf '%s' "$1" ;;
  esac
}

parse_args() {
  while [ $# -gt 0 ]; do
    case $1 in
      -h|--help)
        usage
        exit "$EXIT_OK"
        ;;
      --target)
        [ $# -ge 2 ] || fail "--target needs a directory"
        [ -n "$2" ] || fail "--target needs a directory"
        target_root=$2
        shift 2
        ;;
      --language)
        [ $# -ge 2 ] || fail "--language needs en or zh"
        language=$2
        shift 2
        ;;
      --replace)
        replace=yes
        shift
        ;;
      --yes)
        assume_yes=yes
        shift
        ;;
      --)
        shift
        while [ $# -gt 0 ]; do
          add_name "$1"
          shift
        done
        ;;
      -*)
        fail "unknown option: $1"
        ;;
      *)
        add_name "$1"
        shift
        ;;
    esac
  done

  [ -n "$command_name" ] || fail "missing command (check, install, or uninstall)"
  case $language in
    en|zh) ;;
    *) fail "unsupported language: $language (use en or zh)" ;;
  esac
  case $command_name in
    check)
      [ -n "$target_root" ] || fail "check needs --target DIR"
      [ "$replace" = no ] || fail "--replace is only used by install"
      [ "$assume_yes" = no ] || fail "--yes is only used by uninstall"
      ;;
    install|uninstall)
      [ -n "$target_root" ] || fail "$command_name needs --target DIR"
      name_count=$(count_lines "$names")
      [ "$name_count" -eq 1 ] || fail "$command_name needs exactly one Skill name"
      if [ "$command_name" = install ]; then
        [ "$assume_yes" = no ] || fail "--yes is only used by uninstall"
      else
        [ "$replace" = no ] || fail "--replace is only used by install"
        [ "$language" = en ] || fail "--language is only used by check and install"
      fi
      ;;
    *) fail "unknown command: $command_name" ;;
  esac
  return 0
}

# ---------------------------------------------------------------- install

cmd_install() {
  install_name=${names%%"$NL"*}
  validate_skill_name "$install_name"

  SOURCE_ROOT=$(source_root_for_language "$language")
  [ -d "$SOURCE_ROOT" ] || fail "this repository has no Skill source directory for '$language': $SOURCE_ROOT"
  SRC=$SOURCE_ROOT/$install_name
  require_source "$SRC" "$language Skill"

  resolve_target_root
  DST=$ROOT_RESOLVED/$install_name
  guard_writes "$DST"

  src_version=$(read_version "$SRC/$SKILL_FILE")

  printf '%s install: language %s\n' "$PROG" "$language"
  print_source_line "$SRC" "$src_version"
  printf '  target   %s\n' "$DST"

  dst_type=missing
  if [ -L "$DST" ]; then
    dst_type=link
  elif [ -d "$DST" ]; then
    dst_type=dir
  elif [ -e "$DST" ]; then
    fail "the target exists and is neither a directory nor a symlink: $DST"
  fi

  dst_note=
  if [ "$dst_type" = link ]; then
    dst_link_target=$(readlink -- "$DST" 2>/dev/null) || dst_link_target=
    if [ -d "$DST" ]; then
      dst_note="symlink -> $dst_link_target"
    else
      dst_note="broken symlink -> $dst_link_target"
    fi
  elif [ "$dst_type" = dir ]; then
    dst_note='plain directory'
  fi

  if [ "$dst_type" = dir ] || { [ "$dst_type" = link ] && [ -d "$DST" ]; }; then
    if [ "$dst_type" = dir ]; then
      unsupported=$(list_unsupported "$DST") || fail "cannot read the target: $DST"
      if [ -n "$unsupported" ]; then
        printf '%s: error: the target contains entries that are not regular files or directories:\n' "$PROG" >&2
        print_indented '  ' "$unsupported" >&2
        fail "refusing to replace $DST"
      fi
    fi
    dst_version=$(read_version "$DST/$SKILL_FILE")
    compare_trees "$SRC" "$DST"
    install_compare=$?
    if [ "$install_compare" -eq 2 ]; then
      printf '  current  %s  version %s\n' "${dst_note:-present}" "${dst_version:-unknown}"
      printf '  state    cannot compare\n'
      print_indented '  reason   ' "$CMP_REASON"
      fail "cannot compare $SRC with $DST"
    fi
    printf '  current  %s  version %s\n' "${dst_note:-present}" "${dst_version:-unknown}"
    if [ "$install_compare" -eq 0 ]; then
      printf '  result   no change: the target already matches the source\n'
      if [ "$dst_type" = link ]; then
        printf '  note     the target is a symlink; its content follows its link target\n'
      fi
      return "$EXIT_OK"
    fi
    printf '  state    differs\n'
    print_list '  diff     ' "$CMP_REPORT"
  fi

  if [ "$dst_type" != missing ] && [ "$replace" = no ]; then
    printf '  result   nothing changed: replacing an existing target needs --replace\n'
    printf '  next     sh scripts/skills.sh check %s --language %s --target %s\n' \
      "$install_name" "$language" "$(quote_arg "$target_root")"
    printf '  next     diff -ru %s %s\n' "$(quote_arg "$SRC")" "$(quote_arg "$DST")"
    printf '  next     sh scripts/skills.sh install %s --language %s --target %s --replace\n' \
      "$install_name" "$language" "$(quote_arg "$target_root")"
    printf '           (backs up the current target, then replaces the whole directory)\n'
    return "$EXIT_DECIDE"
  fi

  create_target_root
  install_with_replace "$SRC" "$DST" "$install_name" "$dst_type"
}

install_with_replace() {
  bk_src=$1
  bk_dst=$2
  bk_name=$3
  bk_type=$4

  # Stage the new content before touching the target: a failed copy leaves the
  # target as it was, and the EXIT trap removes the staged directory.
  staging_dir=$ROOT_RESOLVED/.skills-sh-staging-$$
  [ ! -e "$staging_dir" ] || fail "a staging directory already exists: $staging_dir"
  cp -R -- "$bk_src" "$staging_dir" ||
    fail "cannot copy the source into the target root: $bk_src"
  require_same_tree "$bk_src" "$staging_dir" "the staged copy"

  if [ "$bk_type" = missing ]; then
    if ! mv -- "$staging_dir" "$bk_dst"; then
      fail "cannot move the new Skill into place: $bk_dst"
    fi
    staging_dir=
    install_files=$(count_files "$bk_dst")
    printf '  current  not installed\n'
    printf '  result   installed  (%s files copied)\n' "$install_files"
    printf '  note     a running Harness may need a reload or restart to load this version\n'
    return "$EXIT_OK"
  fi

  backup_path=$(new_backup_dir "$bk_name") || fail "cannot create a backup directory"

  if [ "$bk_type" = link ]; then
    bk_link_target=$(readlink -- "$bk_dst" 2>/dev/null) || bk_link_target=
    printf '%s\n' "$bk_link_target" >"$backup_path/link-target.txt" ||
      fail "cannot record the replaced link in $backup_path"
    printf '  backup   %s  (recorded link target: %s)\n' "$backup_path" "$bk_link_target"
  else
    cp -R -- "$bk_dst" "$backup_path/" || fail "cannot back up $bk_dst into $backup_path"
    require_same_tree "$bk_dst" "$backup_path/$bk_name" "the backup"
    printf '  backup   %s\n' "$backup_path"
  fi

  old_dir=$ROOT_RESOLVED/.skills-sh-replaced-$$
  [ ! -e "$old_dir" ] || fail "a replacement directory already exists: $old_dir"
  mv -- "$bk_dst" "$old_dir" || fail "cannot move the current target aside: $bk_dst"
  if ! mv -- "$staging_dir" "$bk_dst"; then
    if mv -- "$old_dir" "$bk_dst" 2>/dev/null; then
      old_dir=
      printf '%s: error: the new content could not be moved into place; the previous target was restored\n' "$PROG" >&2
      printf '%s: error: the backup is at %s\n' "$PROG" "$backup_path" >&2
    else
      printf '%s: error: the new content could not be moved into place and the previous target was not restored\n' "$PROG" >&2
      printf '%s: error: the previous target is at %s and the backup is at %s\n' "$PROG" "$old_dir" "$backup_path" >&2
    fi
    exit "$EXIT_FAIL"
  fi
  staging_dir=

  if [ "$bk_type" = dir ]; then
    rm -rf -- "$old_dir" || {
      printf '%s: warning: the replaced content could not be deleted: %s\n' "$PROG" "$old_dir" >&2
    }
  else
    rm -f -- "$old_dir" || {
      printf '%s: warning: the replaced link could not be removed: %s\n' "$PROG" "$old_dir" >&2
    }
  fi
  old_dir=

  require_same_tree "$bk_src" "$bk_dst" "the installed Skill"

  install_files=$(count_files "$bk_dst")
  printf '  result   installed  (%s files copied)\n' "$install_files"
  printf '  note     a running Harness may need a reload or restart to load this version\n'
  if [ "$bk_type" = link ]; then
    printf '  note     the replaced symlink was recorded in the backup; its former target was not modified\n'
  fi
  print_restore_note
  return "$EXIT_OK"
}

# ---------------------------------------------------------------- uninstall

cmd_uninstall() {
  uninstall_name=${names%%"$NL"*}
  validate_skill_name "$uninstall_name"

  resolve_target_root
  DST=$ROOT_RESOLVED/$uninstall_name
  guard_writes "$DST"

  if [ "$ROOT_EXISTS" = no ]; then
    printf '%s uninstall: %s\n' "$PROG" "$uninstall_name"
    printf '  target   %s\n' "$DST"
    printf '  result   no change: the target root does not exist\n'
    return "$EXIT_OK"
  fi

  if [ ! -e "$DST" ] && [ ! -L "$DST" ]; then
    printf '%s uninstall: %s\n' "$PROG" "$uninstall_name"
    printf '  target   %s\n' "$DST"
    printf '  result   no change: the target is not installed\n'
    return "$EXIT_OK"
  fi

  dst_type=dir
  if [ -L "$DST" ]; then
    dst_type=link
  elif [ ! -d "$DST" ]; then
    fail "the target is neither a directory nor a symlink: $DST"
  fi

  printf '%s uninstall: %s\n' "$PROG" "$uninstall_name"
  if [ "$dst_type" = link ]; then
    uninstall_link_target=$(readlink -- "$DST" 2>/dev/null) || uninstall_link_target=
    printf '  target   %s  (symlink -> %s)\n' "$DST" "$uninstall_link_target"
  else
    printf '  target   %s  (plain directory)\n' "$DST"
  fi

  if [ "$assume_yes" = no ]; then
    printf '  result   nothing removed: confirmation required\n'
    if [ "$dst_type" = link ]; then
      printf '  note     this target is a symlink; only the link is removed and its target is left alone\n'
    else
      printf '  note     the script cannot tell where this directory came from; compare it before removing it\n'
      printf '  note     the directory is copied into the backup directory and then removed from the Skill root\n'
    fi
    printf '  next     sh scripts/skills.sh check %s --language en --target %s\n' \
      "$uninstall_name" "$(quote_arg "$target_root")"
    printf '  next     sh scripts/skills.sh uninstall %s --target %s --yes\n' \
      "$uninstall_name" "$(quote_arg "$target_root")"
    return "$EXIT_DECIDE"
  fi

  if [ "$dst_type" = dir ]; then
    unsupported=$(list_unsupported "$DST") || fail "cannot read the target: $DST"
    if [ -n "$unsupported" ]; then
      printf '%s: error: the target contains entries that are not regular files or directories:\n' "$PROG" >&2
      print_indented '  ' "$unsupported" >&2
      fail "refusing to remove $DST"
    fi
  fi

  backup_path=$(new_backup_dir "$uninstall_name") || fail "cannot create a backup directory"

  if [ "$dst_type" = link ]; then
    uninstall_link_target=$(readlink -- "$DST" 2>/dev/null) || uninstall_link_target=
    printf '%s\n' "$uninstall_link_target" >"$backup_path/link-target.txt" ||
      fail "cannot record the removed link in $backup_path"
    printf '  backup   %s  (recorded link target: %s)\n' "$backup_path" "$uninstall_link_target"
    rm -f -- "$DST" || fail "cannot remove the symlink: $DST"
    printf '  result   removed the symlink; its former target was not modified\n'
    print_restore_note
    return "$EXIT_OK"
  fi

  cp -R -- "$DST" "$backup_path/" || fail "cannot back up $DST into $backup_path"
  require_same_tree "$DST" "$backup_path/$uninstall_name" "the backup"
  printf '  backup   %s\n' "$backup_path"

  old_dir=$ROOT_RESOLVED/.skills-sh-removed-$$
  [ ! -e "$old_dir" ] || fail "a removal directory already exists: $old_dir"
  mv -- "$DST" "$old_dir" || fail "cannot move the target out of the Skill root: $DST"
  if ! rm -rf -- "$old_dir"; then
    printf '%s: error: the target was removed from the Skill root but its content remains at %s\n' "$PROG" "$old_dir" >&2
    printf '%s: error: the backup is at %s\n' "$PROG" "$backup_path" >&2
    exit "$EXIT_FAIL"
  fi
  old_dir=

  printf '  result   removed\n'
  printf '  note     other Skills, the Skill root, and the repository source were not touched\n'
  print_restore_note
  return "$EXIT_OK"
}

# ---------------------------------------------------------------- entry point

if [ $# -eq 0 ]; then
  usage >&2
  exit "$EXIT_FAIL"
fi

command_name=$1
shift

case $command_name in
  -h|--help|help)
    usage
    exit "$EXIT_OK"
    ;;
  check|install|uninstall) ;;
  *) fail "unknown command: $command_name" ;;
esac

parse_args "$@"
source_trees

case $command_name in
  check) cmd_check ;;
  install) cmd_install ;;
  uninstall) cmd_uninstall ;;
esac
exit $?
