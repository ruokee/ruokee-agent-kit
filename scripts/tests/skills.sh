#!/bin/sh
#
# Regression tests for scripts/skills.sh.
#
#   sh scripts/tests/skills.sh
#
# The tests build a fixture repository and fixture target roots inside one
# temporary directory and remove only that directory. The real repository, the
# user's Skill roots, and the user's Harness configuration are not touched.

set -u

NL='
'

WORK=
RC=0
OUT=
ERR=
CHECKS=0
FAILURES=0

# ---------------------------------------------------------------- helpers

script_path_of_test() {
  case $0 in
    */*) test_arg=$0 ;;
    *) test_arg=$(command -v "$0" 2>/dev/null) || test_arg=$0 ;;
  esac
  test_dir=$(CDPATH= cd -P -- "$(dirname -- "$test_arg")" && pwd -P) || {
    printf 'cannot resolve the test directory\n' >&2
    exit 1
  }
  printf '%s\n' "$test_dir/../skills.sh"
}

SCRIPT=$(script_path_of_test)
[ -f "$SCRIPT" ] || {
  printf 'cannot find scripts/skills.sh next to %s\n' "$0" >&2
  exit 1
}

cleanup() {
  [ -n "$WORK" ] && [ -d "$WORK" ] && rm -rf -- "$WORK"
}
trap cleanup EXIT

run() {
  run_out=$WORK/run.out
  run_err=$WORK/run.err
  "$@" >"$run_out" 2>"$run_err"
  RC=$?
  OUT=$(cat "$run_out" 2>/dev/null)
  ERR=$(cat "$run_err" 2>/dev/null)
  return 0
}

sk() {
  run sh "$FIXTURE/scripts/skills.sh" "$@"
}

ok() {
  CHECKS=$((CHECKS + 1))
  printf 'ok   %s\n' "$1"
}

bad() {
  CHECKS=$((CHECKS + 1))
  FAILURES=$((FAILURES + 1))
  printf 'FAIL %s\n' "$1"
  printf '     exit status: %s\n' "$RC"
  if [ -n "$OUT" ]; then
    printf '%s\n' "$OUT" | sed -e 's/^/     out | /'
  fi
  if [ -n "$ERR" ]; then
    printf '%s\n' "$ERR" | sed -e 's/^/     err | /'
  fi
}

expect_rc() {
  if [ "$RC" -eq "$1" ]; then
    ok "$2"
  else
    bad "$2 (expected exit $1)"
  fi
}

expect_out() {
  if printf '%s\n' "$OUT" | LC_ALL=C grep -Fq -e "$1"; then
    ok "$2"
  else
    bad "$2 (output does not contain: $1)"
  fi
}

expect_no_out() {
  if printf '%s\n' "$OUT" | LC_ALL=C grep -Fq -e "$1"; then
    bad "$2 (output unexpectedly contains: $1)"
  else
    ok "$2"
  fi
}

expect_out_re() {
  if printf '%s\n' "$OUT" | LC_ALL=C grep -Eq -e "$1"; then
    ok "$2"
  else
    bad "$2 (output does not match: $1)"
  fi
}

expect_err() {
  if printf '%s\n' "$ERR" | LC_ALL=C grep -Fq -e "$1"; then
    ok "$2"
  else
    bad "$2 (stderr does not contain: $1)"
  fi
}

expect_dir() {
  if [ -d "$1" ]; then
    ok "$2"
  else
    bad "$2 (no directory: $1)"
  fi
}

expect_no_entry() {
  if [ -e "$1" ] || [ -L "$1" ]; then
    bad "$2 (still present: $1)"
  else
    ok "$2"
  fi
}

expect_file() {
  if [ -f "$1" ]; then
    ok "$2"
  else
    bad "$2 (no file: $1)"
  fi
}

expect_not_link() {
  if [ -L "$1" ]; then
    bad "$2 (still a symlink: $1)"
  else
    ok "$2"
  fi
}

# $1 is a snapshot taken earlier, $2 the path to compare it with.
expect_unchanged() {
  if [ "$1" = "$(snapshot "$2")" ]; then
    ok "$3"
  else
    bad "$3 (changed: $2)"
  fi
}

# Print the backup path from the last command output.
reported_backup() {
  printf '%s\n' "$OUT" | LC_ALL=C awk '/^  backup   /{print $2; exit}'
}

# The directory restore documented in docs/installation.md, with $1 the Skill
# root, $2 the backup directory, and $3 the Skill name. Sets HOLDING.
restore_dir() {
  HOLDING=
  holding=$(mktemp -d "$2/restore.XXXXXX") &&
    { { [ ! -e "$1/$3" ] && [ ! -L "$1/$3" ]; } || mv "$1/$3" "$holding/$3"; } &&
    mv "$2/$3" "$1/$3" || return 1
  HOLDING=$holding
  return 0
}

# The link restore documented in docs/installation.md. Sets HOLDING.
restore_link() {
  HOLDING=
  holding=$(mktemp -d "$2/restore.XXXXXX") &&
    { { [ ! -e "$1/$3" ] && [ ! -L "$1/$3" ]; } || mv "$1/$3" "$holding/$3"; } &&
    ln -s "$(cat "$2/link-target.txt")" "$1/$3" || return 1
  HOLDING=$holding
  return 0
}

snapshot() {
  (
    CDPATH= cd -P -- "$1" 2>/dev/null || exit 1
    find . -type f -exec cksum {} \; 2>/dev/null | LC_ALL=C sort
    find . ! -type f -print 2>/dev/null | LC_ALL=C sort
  )
}

expect_same_tree() {
  if [ "$(snapshot "$1")" = "$(snapshot "$2")" ]; then
    ok "$3"
  else
    bad "$3 (trees differ: $1 and $2)"
  fi
}

expect_changed_tree() {
  if [ "$(snapshot "$1")" = "$(snapshot "$2")" ]; then
    bad "$3 (trees are equal: $1 and $2)"
  else
    ok "$3"
  fi
}

# ---------------------------------------------------------------- fixtures

build_fixture() {
  FIXTURE="$WORK/fixture repo"
  mkdir -p "$FIXTURE/scripts" || exit 1
  cp "$SCRIPT" "$FIXTURE/scripts/skills.sh" || exit 1

  mkdir -p "$FIXTURE/skills/alpha/references" "$FIXTURE/skills/alpha/workflow"
  cat >"$FIXTURE/skills/alpha/SKILL.md" <<'EOF'
---
name: alpha
description: Fixture Skill with a version.
metadata:
  version: "1.0.0"
---

# Alpha

Fixture body. A text example mentions version: "9.9.9" and must be ignored.
EOF
  printf 'notes v1\n' >"$FIXTURE/skills/alpha/references/notes.md"
  printf 'flow\n' >"$FIXTURE/skills/alpha/workflow/flow.md"

  mkdir -p "$FIXTURE/skills/beta"
  cat >"$FIXTURE/skills/beta/SKILL.md" <<'EOF'
---
name: beta
description: Fixture Skill without version metadata.
---

# Beta

Fixture body without a version.
EOF

  mkdir -p "$FIXTURE/variants/zh/skills/alpha/references"
  cat >"$FIXTURE/variants/zh/skills/alpha/SKILL.md" <<'EOF'
---
name: alpha
description: 中文 fixture。
metadata:
  version: "1.0.0"
---

# Alpha（中文）

中文 fixture 正文。
EOF
  printf '中文 notes\n' >"$FIXTURE/variants/zh/skills/alpha/references/notes.md"

  # A source whose entries cannot be handled safely is created per test, so the
  # committed fixture stays clean.

  if command -v git >/dev/null 2>&1; then
    git -C "$FIXTURE" init -q 2>/dev/null
    git -C "$FIXTURE" add -A 2>/dev/null
    git -C "$FIXTURE" -c user.email=tests@example.invalid -c user.name=Tests \
      commit -qm "fixture" 2>/dev/null
    HAVE_GIT=yes
  else
    HAVE_GIT=no
  fi
}

fresh_target() {
  rm -rf -- "$TARGET"
  mkdir -p "$TARGET"
}

# ---------------------------------------------------------------- tests

WORK=$(mktemp -d "${TMPDIR:-/tmp}/skills-tests.XXXXXX") || exit 1
XDG_STATE_HOME="$WORK/state"
export XDG_STATE_HOME
HOME_SAVED=${HOME:-}
TARGET="$WORK/target root/skills"
HAVE_GIT=no

build_fixture

printf '# invocation and arguments\n'

run sh "$SCRIPT" --help
expect_rc 0 "help exits 0"
expect_out "Usage:" "help prints usage"
expect_out "--target" "help documents --target"
expect_out "skill-backups" "help documents the backup location"

( CDPATH= cd / && sh "$SCRIPT" --help >"$WORK/out" 2>"$WORK/err" )
rc=$?
if [ "$rc" -eq 0 ]; then
  ok "help works from another directory"
else
  RC=$rc
  OUT=$(cat "$WORK/out")
  ERR=$(cat "$WORK/err")
  bad "help works from another directory"
fi

( CDPATH= cd "$WORK" && sh "fixture repo/scripts/skills.sh" --help >"$WORK/out" 2>"$WORK/err" )
rc=$?
if [ "$rc" -eq 0 ]; then
  ok "a relative script path works from another directory"
else
  RC=$rc
  OUT=$(cat "$WORK/out")
  ERR=$(cat "$WORK/err")
  bad "a relative script path works from another directory"
fi

run sh "$SCRIPT"
expect_rc 2 "no command exits 2"
expect_err "Usage:" "no command prints usage on stderr"

sk frobnicate --target "$TARGET"
expect_rc 2 "unknown command exits 2"

sk check alpha --target "$TARGET" --bogus
expect_rc 2 "unknown option exits 2"

sk install alpha
expect_rc 2 "install without --target exits 2"

sk check alpha --target "$TARGET" --language de
expect_rc 2 "unsupported language exits 2"

sk check alpha --target "$TARGET" --yes
expect_rc 2 "--yes is rejected by check"

sk uninstall alpha --target "$TARGET" --language zh
expect_rc 2 "uninstall rejects two Skill names"

sk install alpha extra --target "$TARGET"
expect_rc 2 "install rejects two Skill names"

printf '\n# install\n'

fresh_target
sk install alpha --target "$TARGET"
expect_rc 0 "install copies a new Skill"
expect_dir "$TARGET/alpha" "install creates the Skill directory"
expect_file "$TARGET/alpha/SKILL.md" "install copies SKILL.md"
expect_file "$TARGET/alpha/references/notes.md" "install copies reference files"
expect_out "installed" "install reports the result"

sk check alpha --target "$TARGET"
expect_rc 0 "the fresh install compares as consistent"
expect_out "1.0.0" "check shows the declared version"

( CDPATH= cd "$WORK/target root" && sh "../fixture repo/scripts/skills.sh" check alpha --target skills >"$WORK/out" 2>"$WORK/err" )
rc=$?
if [ "$rc" -eq 0 ]; then
  ok "a relative target path works from another directory"
else
  RC=$rc
  OUT=$(cat "$WORK/out")
  ERR=$(cat "$WORK/err")
  bad "a relative target path works from another directory"
fi

snapshot_before=$(snapshot "$TARGET/alpha")
sk install alpha --target "$TARGET"
expect_rc 0 "repeated install exits 0"
expect_out "no change" "repeated install reports no change"
snapshot_after=$(snapshot "$TARGET/alpha")
if [ "$snapshot_before" = "$snapshot_after" ]; then
  ok "repeated install leaves the target unchanged"
else
  bad "repeated install leaves the target unchanged"
fi

rm -rf -- "$WORK/fresh root"
sk install beta --target "$WORK/fresh root/skills"
expect_rc 0 "install creates a missing target root"
expect_dir "$WORK/fresh root/skills/beta" "install creates the Skill under a new root"

rm -rf -- "$WORK/zh target"
sk install alpha --language zh --target "$WORK/zh target/skills"
expect_rc 0 "install accepts the zh variant"
expect_same_tree "$FIXTURE/variants/zh/skills/alpha" "$WORK/zh target/skills/alpha" \
  "the zh install matches the zh source"
expect_changed_tree "$FIXTURE/skills/alpha" "$WORK/zh target/skills/alpha" \
  "the zh install differs from the en source"

printf '\n# check states\n'

sk check alpha --target "$TARGET"
expect_rc 0 "check reports an identical target as consistent"
expect_out "identical" "check names the identical state"
expect_out "uncommitted changes under the compared sources: none" "a clean checkout is reported as clean"

printf 'notes v2\n' >"$TARGET/alpha/references/notes.md"
sk check alpha --target "$TARGET"
expect_rc 1 "check reports a changed reference file"
expect_out "differs" "check names the differing state"
expect_out "references/notes.md" "check lists the changed file"
expect_out "install alpha --language en --target" "check prints the replace command"
expect_out "--replace" "the replace command carries --replace"

sk install alpha --target "$TARGET"
expect_rc 1 "install refuses an unauthorized replacement"
expect_out "nothing changed" "the refused install says nothing changed"

printf 'extra\n' >"$TARGET/alpha/notes.md"
sk check alpha --target "$TARGET"
expect_rc 1 "check reports an extra file"
expect_out_re "Only in '?$TARGET/alpha'?: notes.md" "check names the file that only the target holds"
rm -f -- "$TARGET/alpha/notes.md"

rm -f -- "$TARGET/alpha/workflow/flow.md"
sk check alpha --target "$TARGET"
expect_rc 1 "check reports a missing file"
expect_out_re "Only in '?$FIXTURE/skills/alpha/workflow'?: flow.md" \
  "check names the file that only the source holds"
sk install alpha --target "$TARGET" --replace >/dev/null 2>&1

printf '\nlocal edit\n' >>"$TARGET/alpha/SKILL.md"
sk check alpha --target "$TARGET"
expect_rc 1 "check reports equal versions with different content"
expect_out "differs" "the equal-version difference is shown"
expect_out "target 1.0.0, source 1.0.0" "both versions are printed"

mkdir -p "$FIXTURE/skills/linked"
cat >"$FIXTURE/skills/linked/SKILL.md" <<'EOF'
---
name: linked
description: Fixture Skill containing a symlink.
metadata:
  version: "1.0.0"
---

# Linked
EOF
ln -s ../alpha/references/notes.md "$FIXTURE/skills/linked/notes.md"
sk check linked --target "$TARGET"
expect_rc 2 "a source with a symlink is refused"
expect_err "not regular files or directories" "the unsupported source entry is named"
sk install linked --target "$TARGET"
expect_rc 2 "install refuses a source with a symlink"
rm -rf -- "$FIXTURE/skills/linked"

sk check nosuch --target "$TARGET"
expect_rc 2 "an unknown Skill name exits 2"

fresh_target
sk check alpha --target "$TARGET"
expect_rc 1 "a named Skill that is not installed exits 1"
expect_out "not installed" "the absent Skill is reported"

sk check --target "$TARGET"
expect_rc 0 "a scan with no installed Skill exits 0"
expect_out "not installed" "the scan reports the missing count"

sk install beta --target "$TARGET" >/dev/null 2>&1
rm -f -- "$TARGET/beta/SKILL.md"
printf 'changed\n' >"$TARGET/beta/extra.md"
sk check --target "$TARGET"
expect_rc 1 "a scan reports an existing Skill that differs"
expect_out "beta" "the scan names the differing Skill"
expect_out "unknown" "a missing version is reported as unknown"

state_before=$(snapshot "$WORK/state" 2>/dev/null)
target_before=$(snapshot "$TARGET")
sk check --target "$TARGET"
sk check beta --target "$TARGET"
target_after=$(snapshot "$TARGET")
if [ "$target_before" = "$target_after" ]; then
  ok "check does not modify the target"
else
  bad "check does not modify the target"
fi
state_after=$(snapshot "$WORK/state" 2>/dev/null)
if [ "$state_before" = "$state_after" ]; then
  ok "check writes no state file"
else
  bad "check writes no state file"
fi
if [ -z "$(find "$TARGET" -name '.skills-sh-*' -print 2>/dev/null)" ]; then
  ok "check leaves no temporary entry in the Skill root"
else
  bad "check leaves no temporary entry in the Skill root"
fi

printf '\n# authorized replacement\n'

fresh_target
sk install alpha --target "$TARGET" >/dev/null 2>&1
printf 'notes v2\n' >"$TARGET/alpha/references/notes.md"
rm -f -- "$TARGET/alpha/workflow/flow.md"
printf 'local\n' >"$TARGET/alpha/local.md"
saved_target=$(snapshot "$TARGET/alpha")
backups_before=$(find "$XDG_STATE_HOME" -type d -name '*-alpha' 2>/dev/null | LC_ALL=C sort)
sk install alpha --target "$TARGET"
expect_rc 1 "a differing target is not replaced without --replace"
if [ "$saved_target" = "$(snapshot "$TARGET/alpha")" ]; then
  ok "the refused replacement leaves the target unchanged"
else
  bad "the refused replacement leaves the target unchanged"
fi
backups_after=$(find "$XDG_STATE_HOME" -type d -name '*-alpha' 2>/dev/null | LC_ALL=C sort)
if [ "$backups_before" = "$backups_after" ]; then
  ok "a refused replacement creates no backup"
else
  bad "a refused replacement creates no backup"
fi

sk install alpha --target "$TARGET" --replace
expect_rc 0 "an authorized replacement succeeds"
expect_out "backup" "the replacement reports a backup path"
expect_same_tree "$FIXTURE/skills/alpha" "$TARGET/alpha" "the replaced target matches the source"
expect_no_entry "$TARGET/alpha/local.md" "the replacement removes a file that only existed in the target"
expect_file "$TARGET/alpha/workflow/flow.md" "the replacement restores a missing file"
backup_path=$(find "$XDG_STATE_HOME" -type d -name '*-alpha' 2>/dev/null | LC_ALL=C sort | tail -n 1)
expect_file "$backup_path/alpha/references/notes.md" "the backup holds the previous target"
if printf '%s\n' "$(cat "$backup_path/alpha/references/notes.md")" | LC_ALL=C grep -Fq "notes v2"; then
  ok "the backup keeps the previous content"
else
  bad "the backup keeps the previous content"
fi
if [ -z "$(find "$TARGET" -name '.skills-sh-*' -print 2>/dev/null)" ]; then
  ok "the replacement leaves no temporary entry"
else
  bad "the replacement leaves no temporary entry"
fi

backup_count_before=$(find "$XDG_STATE_HOME" -type d -name '*-alpha' 2>/dev/null | wc -l)
sk install alpha --target "$TARGET" --replace
expect_rc 0 "replacing an identical target exits 0"
expect_out "no change" "replacing an identical target reports no change"
backup_count_after=$(find "$XDG_STATE_HOME" -type d -name '*-alpha' 2>/dev/null | wc -l)
if [ "$backup_count_before" -eq "$backup_count_after" ]; then
  ok "an identical target creates no backup"
else
  bad "an identical target creates no backup"
fi

printf 'notes v3\n' >"$TARGET/alpha/references/notes.md"
saved_target=$(snapshot "$TARGET/alpha")
touch "$WORK/state-is-a-file"
run env XDG_STATE_HOME="$WORK/state-is-a-file" sh "$SCRIPT" install alpha --target "$TARGET" --replace
expect_rc 2 "a broken backup location fails the replacement"
if [ "$saved_target" = "$(snapshot "$TARGET/alpha")" ]; then
  ok "a failed backup leaves the target unchanged"
else
  bad "a failed backup leaves the target unchanged"
fi
if [ -z "$(find "$TARGET" -name '.skills-sh-*' -print 2>/dev/null)" ]; then
  ok "a failed backup leaves no temporary entry"
else
  bad "a failed backup leaves no temporary entry"
fi
rm -f -- "$WORK/state-is-a-file"

sk install alpha --target "$FIXTURE/skills"
expect_rc 2 "installing onto the source directory is refused"
sk upgrade alpha --target "$TARGET"
expect_rc 2 "an unknown command is still refused"

printf '\n# uninstall\n'

fresh_target
sk install alpha --target "$TARGET" >/dev/null 2>&1
sk install beta --target "$TARGET" >/dev/null 2>&1
source_before=$(snapshot "$FIXTURE/skills/alpha")
sk uninstall alpha --target "$TARGET"
expect_rc 1 "uninstall without --yes changes nothing"
expect_dir "$TARGET/alpha" "the unconfirmed target is still installed"
expect_out "confirmation required" "the unconfirmed uninstall says why"

sk uninstall alpha --target "$TARGET" --yes
expect_rc 0 "uninstall with --yes succeeds"
expect_no_entry "$TARGET/alpha" "the confirmed target is removed"
expect_dir "$TARGET/beta" "a neighbouring Skill is untouched"
expect_dir "$TARGET" "the Skill root is untouched"
if [ "$source_before" = "$(snapshot "$FIXTURE/skills/alpha")" ]; then
  ok "uninstall leaves the repository source unchanged"
else
  bad "uninstall leaves the repository source unchanged"
fi
removal_backup=$(find "$XDG_STATE_HOME" -type d -name '*-alpha' 2>/dev/null | LC_ALL=C sort | tail -n 1)
expect_file "$removal_backup/alpha/SKILL.md" "the removal keeps a complete backup"

sk uninstall alpha --target "$TARGET" --yes
expect_rc 0 "uninstalling an absent Skill exits 0"
expect_out "no change" "an absent target reports no change"

rm -rf -- "$WORK/absent root"
sk uninstall alpha --target "$WORK/absent root/skills" --yes
expect_rc 0 "uninstalling from a missing root exits 0"

rm -rf -- "$WORK/link target"
mkdir -p "$WORK/link target/skills"
ln -s "$FIXTURE/skills/alpha" "$WORK/link target/skills/alpha"
sk check alpha --target "$WORK/link target/skills"
expect_rc 0 "a symlinked target compares as identical"
expect_out "symlink" "the symlink target is reported as a link"
sk install alpha --target "$WORK/link target/skills"
expect_rc 0 "installing over an identical symlink reports no change"
sk uninstall alpha --target "$WORK/link target/skills" --yes
expect_rc 0 "uninstalling a symlink succeeds"
expect_no_entry "$WORK/link target/skills/alpha" "the symlink is removed"
expect_dir "$FIXTURE/skills/alpha" "the symlink target directory is untouched"

rm -rf -- "$WORK/link target/skills/alpha"
ln -s "$WORK/nowhere" "$WORK/link target/skills/alpha"
sk check alpha --target "$WORK/link target/skills"
expect_rc 1 "a broken symlink is not treated as identical"
expect_out "broken symlink" "the broken link is reported"
sk install alpha --target "$WORK/link target/skills" --replace
expect_rc 0 "an authorized replacement replaces the broken link"
expect_same_tree "$FIXTURE/skills/alpha" "$WORK/link target/skills/alpha" \
  "the broken link is replaced with a directory"
expect_no_entry "$WORK/nowhere" "the former link target is not created"

printf '\n# refusals and boundaries\n'

fresh_target
sk check ../alpha --target "$TARGET"
expect_rc 2 "a path-traversal Skill name is refused"
sk install 'alpha/beta' --target "$TARGET"
expect_rc 2 "a Skill name with a separator is refused"
sk uninstall --alpha --target "$TARGET" --yes
expect_rc 2 "an option-like Skill name is rejected as an unknown option"
sk check . --target "$TARGET"
expect_rc 2 "a dot Skill name is refused"

sk check alpha --target "$FIXTURE/skills"
expect_rc 2 "checking the source root against itself is refused"
sk install alpha --target "$FIXTURE/skills/alpha"
expect_rc 2 "a target inside the source directory is refused"
expect_no_entry "$FIXTURE/skills/alpha/alpha" "the refused install wrote nothing"

touch "$WORK/plain-file"
sk install alpha --target "$WORK/plain-file"
expect_rc 2 "a target root that is a file is refused"
sk check alpha --target "$WORK/plain-file"
expect_rc 2 "checking a target root that is a file is refused"

fresh_target
mkdir -p "$TARGET/alpha"
printf 'stray\n' >"$TARGET/alpha/SKILL.md"
sk uninstall alpha --target "$TARGET" --yes
expect_rc 0 "uninstall can remove a manually copied Skill"
expect_no_entry "$TARGET/alpha" "the manually copied Skill is removed"

fresh_target
mkdir -p "$TARGET/alpha"
if command -v mkfifo >/dev/null 2>&1; then
  mkfifo "$TARGET/alpha/pipe"
  sk check alpha --target "$TARGET"
  expect_rc 2 "check refuses an unsupported entry in the target"
  sk install alpha --target "$TARGET" --replace
  expect_rc 2 "install refuses an unsupported entry in the target"
  expect_dir "$TARGET/alpha" "the refused target is left in place"
  rm -f -- "$TARGET/alpha/pipe"
else
  printf 'skip mkfifo is not available\n'
fi

fresh_target
touch "$TARGET/alpha"
sk install alpha --target "$TARGET"
expect_rc 2 "a target entry that is a plain file is refused"
sk uninstall alpha --target "$TARGET" --yes
expect_rc 2 "uninstalling a plain file target is refused"

printf '\n# repository source protection\n'

fresh_target
sk install alpha --target "$TARGET" >/dev/null 2>&1
en_before=$(snapshot "$FIXTURE/skills/alpha")
zh_before=$(snapshot "$FIXTURE/variants/zh/skills/alpha")

sk uninstall alpha --target "$FIXTURE/skills" --yes
expect_rc 2 "removing a Skill from the en source root is refused"
expect_err "repository Skill source" "the refusal names the source"
expect_dir "$FIXTURE/skills/alpha" "the en source Skill survives"

sk install alpha --target "$FIXTURE/skills" --replace
expect_rc 2 "installing into the en source root is refused"

sk install alpha --target "$FIXTURE/variants/zh/skills" --replace
expect_rc 2 "installing en content over the zh source is refused"
expect_err "variants/zh/skills" "the refusal names the zh source"

sk uninstall alpha --language zh --target "$FIXTURE/variants/zh/skills" --yes
expect_rc 2 "removing a Skill from the zh source root is refused"

sk install alpha --target "$FIXTURE/variants/zh" --replace
expect_rc 2 "a target root that would contain the zh source is refused"
sk install alpha --target "$FIXTURE" --replace
expect_rc 2 "a target root above both source trees is refused"

expect_unchanged "$en_before" "$FIXTURE/skills/alpha" \
  "the refusals leave the en source unchanged"
expect_unchanged "$zh_before" "$FIXTURE/variants/zh/skills/alpha" \
  "the refusals leave the zh source unchanged"

rm -rf -- "$WORK/link root"
mkdir -p "$WORK/link root/skills"
ln -s "$FIXTURE/variants/zh/skills/alpha" "$WORK/link root/skills/alpha"
sk install alpha --target "$WORK/link root/skills" --replace
expect_rc 0 "a Skill entry that links into the source can still be replaced"
expect_not_link "$WORK/link root/skills/alpha" "the replaced entry is a directory, not a link"
expect_same_tree "$FIXTURE/skills/alpha" "$WORK/link root/skills/alpha" \
  "the replacement copies the requested source"
expect_unchanged "$zh_before" "$FIXTURE/variants/zh/skills/alpha" \
  "replacing the link leaves the source it pointed at unchanged"

rm -rf -- "$WORK/link root/skills/alpha"
ln -s "$FIXTURE/skills/alpha" "$WORK/link root/skills/alpha"
sk uninstall alpha --target "$WORK/link root/skills" --yes
expect_rc 0 "a Skill entry that links to the source can still be unlinked"
expect_no_entry "$WORK/link root/skills/alpha" "the link is removed"
expect_dir "$FIXTURE/skills/alpha" "the former link target is untouched"

printf '\n# pre-write validation\n'

fresh_target
sk install alpha --target "$TARGET" >/dev/null 2>&1
printf 'notes v2\n' >"$TARGET/alpha/references/notes.md"
saved_target=$(snapshot "$TARGET/alpha")

rm -rf -- "$WORK/alias"
ln -s "$FIXTURE/skills/alpha" "$WORK/alias"
sk install alpha --target "$WORK/alias/new/deep"
expect_rc 2 "a target below a symlink into the source is refused"
expect_no_entry "$FIXTURE/skills/alpha/new" "the refused install creates nothing below the source"

run env XDG_STATE_HOME="$TARGET/state" sh "$FIXTURE/scripts/skills.sh" \
  install alpha --target "$TARGET" --replace
expect_rc 2 "a backup location inside the Skill root is refused"
expect_err "inside the target Skill root" "the refusal names the backup location"
expect_unchanged "$saved_target" "$TARGET/alpha" "the refused install leaves the target unchanged"
expect_no_entry "$TARGET/state" "the refused install creates no state directory"

run env XDG_STATE_HOME="$TARGET/alpha/state" sh "$FIXTURE/scripts/skills.sh" \
  install alpha --target "$TARGET" --replace
expect_rc 2 "a backup location inside the installed Skill is refused"
expect_no_entry "$TARGET/alpha/state" "the refused install writes no state into the Skill"

run env XDG_STATE_HOME="$FIXTURE/skills/alpha/state" sh "$FIXTURE/scripts/skills.sh" \
  install alpha --target "$TARGET" --replace
expect_rc 2 "a backup location inside the source is refused"
expect_no_entry "$FIXTURE/skills/alpha/state" "the refused install writes no state into the source"
expect_unchanged "$saved_target" "$TARGET/alpha" "the source guard leaves the target unchanged"

run env XDG_STATE_HOME="$TARGET/alpha/state" sh "$FIXTURE/scripts/skills.sh" \
  uninstall alpha --target "$TARGET" --yes
expect_rc 2 "uninstall refuses a backup location inside the installed Skill"
expect_dir "$TARGET/alpha" "the refused uninstall keeps the target"
expect_no_entry "$TARGET/alpha/state" "the refused uninstall creates no state directory"

rm -rf -- "$WORK/dot prefix"
mkdir -p "$WORK/dot prefix"
ln -s "$FIXTURE/skills/alpha" "$WORK/dot prefix/alias"
dot_src_before=$(snapshot "$FIXTURE/skills/alpha")

sk install alpha --target "$WORK/dot prefix/missing/../alias/state"
expect_rc 2 "a missing '..' component in the target root is refused"
expect_err "a missing path component is '..'" "the refusal names the missing '..' component"
expect_no_entry "$WORK/dot prefix/missing" "the refused target creates no path component"
expect_unchanged "$dot_src_before" "$FIXTURE/skills/alpha" \
  "the refused target leaves the source it points into unchanged"

run env XDG_STATE_HOME="$WORK/dot prefix/missing/../alias/state" sh "$FIXTURE/scripts/skills.sh" \
  install alpha --target "$TARGET" --replace
expect_rc 2 "a missing '..' component in the backup location is refused"
expect_err "a missing path component is '..'" "the refusal names the missing '..' component in the backup"
expect_no_entry "$WORK/dot prefix/missing" "the refused backup creates no path component"
expect_unchanged "$dot_src_before" "$FIXTURE/skills/alpha" \
  "the refused backup leaves the source it points into unchanged"
expect_unchanged "$saved_target" "$TARGET/alpha" "the refused backup leaves the target unchanged"

run env XDG_STATE_HOME="$WORK/dot prefix/missing/../alias/state" sh "$FIXTURE/scripts/skills.sh" \
  uninstall alpha --target "$TARGET" --yes
expect_rc 2 "uninstall refuses a missing '..' component in the backup location"
expect_unchanged "$dot_src_before" "$FIXTURE/skills/alpha" \
  "the refused uninstall leaves the source unchanged"
expect_unchanged "$saved_target" "$TARGET/alpha" "the refused uninstall keeps the installed Skill"

printf '\n# restore steps\n'

fresh_target
sk install alpha --target "$TARGET" >/dev/null 2>&1
printf 'notes v2\n' >"$TARGET/alpha/references/notes.md"
printf 'local\n' >"$TARGET/alpha/local.md"
saved_target=$(snapshot "$TARGET/alpha")

sk install alpha --target "$TARGET" --replace
expect_rc 0 "the authorized replacement succeeds"
expect_out "docs/installation.md" "the replacement points at the restore documentation"
expect_no_out "restore the previous content with: mv" "the replacement prints no nesting move command"

backup_path=$(reported_backup)
if [ -n "$backup_path" ] && [ -f "$backup_path/alpha/local.md" ]; then
  ok "the reported backup path holds the previous Skill"
else
  bad "the reported backup path holds the previous Skill (path: $backup_path)"
fi

printf 'after\n' >"$TARGET/alpha/after-replace.md"
if restore_dir "$TARGET" "$backup_path" alpha; then
  ok "the documented directory restore succeeds"
else
  bad "the documented directory restore succeeds"
fi
first_holding=$HOLDING
case $first_holding in
  "$backup_path"/restore.*) ok "the restore preserves current content in the durable backup directory" ;;
  *) bad "the restore preserves current content in the durable backup directory" ;;
esac
expect_unchanged "$saved_target" "$TARGET/alpha" \
  "the documented restore reproduces the content from before the replacement"
expect_no_entry "$TARGET/alpha/alpha" "the documented restore does not nest the Skill"
expect_file "$first_holding/alpha/after-replace.md" \
  "the documented restore keeps the content that was installed when it ran"

printf 'second\n' >"$TARGET/alpha/second.md"
sk install alpha --target "$TARGET" --replace >/dev/null 2>&1
second_backup=$(reported_backup)
printf 'later\n' >"$TARGET/alpha/later.md"
if restore_dir "$TARGET" "$second_backup" alpha; then
  ok "a repeated restore succeeds"
else
  bad "a repeated restore succeeds"
fi
if [ -n "$first_holding" ] && [ "$first_holding" != "$HOLDING" ]; then
  ok "a repeated restore uses its own holding directory"
else
  bad "a repeated restore uses its own holding directory"
fi
expect_file "$TARGET/alpha/second.md" "the repeated restore brings back the earlier content"
expect_file "$HOLDING/alpha/later.md" \
  "the repeated restore keeps the content that was installed when it ran"
expect_no_entry "$HOLDING/alpha/alpha" "the repeated restore does not nest the Skill"

rm -rf -- "$WORK/restore link" "$WORK/previous beta"
mkdir -p "$WORK/restore link/skills" "$WORK/previous beta"
cp -R "$FIXTURE/skills/beta" "$WORK/previous beta/beta"
printf 'local\n' >"$WORK/previous beta/beta/local.md"
previous_before=$(snapshot "$WORK/previous beta/beta")
ln -s "$WORK/previous beta/beta" "$WORK/restore link/skills/beta"
sk install beta --target "$WORK/restore link/skills" --replace
expect_rc 0 "replacing a symlinked Skill succeeds"
expect_out "recorded in the backup" "the replacement reports the recorded link"
link_backup=$(reported_backup)
expect_file "$link_backup/link-target.txt" "the backup records the replaced link target"
expect_not_link "$WORK/restore link/skills/beta" "the replaced link is now a directory"
expect_unchanged "$previous_before" "$WORK/previous beta/beta" \
  "replacing the link leaves the directory it pointed at unchanged"

printf 'after\n' >"$WORK/restore link/skills/beta/after-replace.md"
if restore_link "$WORK/restore link/skills" "$link_backup" beta; then
  ok "the documented link restore succeeds"
else
  bad "the documented link restore succeeds"
fi
if [ -f "$WORK/restore link/skills/beta/SKILL.md" ]; then
  ok "the documented link restore resolves to the previous target"
else
  bad "the documented link restore resolves to the previous target"
fi
expect_file "$HOLDING/beta/after-replace.md" \
  "the link restore keeps the directory it moved aside"

sk uninstall beta --target "$WORK/restore link/skills" --yes
expect_rc 0 "the restored link can be uninstalled again"
expect_out "docs/installation.md" "uninstall points at the restore documentation"
expect_no_out "restore the previous content with: mv" "uninstall prints no nesting move command"
link_backup=$(reported_backup)
if [ -n "$link_backup" ] && [ -f "$link_backup/link-target.txt" ]; then
  ok "the removal backup records the link target"
else
  bad "the removal backup records the link target (path: $link_backup)"
fi
if restore_link "$WORK/restore link/skills" "$link_backup" beta; then
  ok "the documented link restore brings a removed link back"
else
  bad "the documented link restore brings a removed link back"
fi
if [ -f "$WORK/restore link/skills/beta/SKILL.md" ]; then
  ok "the removed link is restored to the directory it pointed at"
else
  bad "the removed link is restored to the directory it pointed at"
fi
expect_no_entry "$HOLDING/beta" "the link removal had no content to move aside"

fresh_target
sk install alpha --target "$TARGET" >/dev/null 2>&1
printf 'local\n' >"$TARGET/alpha/local.md"
saved_target=$(snapshot "$TARGET/alpha")
sk uninstall alpha --target "$TARGET" --yes
expect_rc 0 "uninstall removes the installed Skill"
backup_path=$(reported_backup)
if restore_dir "$TARGET" "$backup_path" alpha; then
  ok "the documented restore brings a removed Skill back"
else
  bad "the documented restore brings a removed Skill back"
fi
expect_unchanged "$saved_target" "$TARGET/alpha" \
  "the restored removal matches the content from before the removal"
expect_no_entry "$TARGET/alpha/alpha" "the restored removal does not nest the Skill"
expect_no_entry "$HOLDING/alpha" "the removal had no content to move aside"

# The documented steps must not delete the installed content.
docs=$(dirname -- "$SCRIPT")/../docs
restore_text=$(
  sed -n '/^## Restore a backup$/,/^## /p' "$docs/installation.md"
  sed -n '/^## 恢复备份$/,/^## /p' "$docs/installation.zh.md"
)
case $restore_text in
  *'rm -rf'*) bad "the documented restore does not delete the installed Skill" ;;
  *) ok "the documented restore does not delete the installed Skill" ;;
esac
case $restore_text in
  *'mktemp -d'*) ok "the documented restore moves the current content aside" ;;
  *) bad "the documented restore moves the current content aside" ;;
esac
case $restore_text in
  *XDG_STATE_HOME*) ok "the documented restore names the backup location variable" ;;
  *) bad "the documented restore names the backup location variable" ;;
esac

printf '\n# git checkout reporting\n'

if [ "$HAVE_GIT" = yes ]; then
  fresh_target
  sk install alpha --target "$TARGET" >/dev/null 2>&1
  sk check alpha --target "$TARGET"
  expect_rc 0 "a committed fixture compares as consistent"
  expect_out "HEAD" "check reports the checkout HEAD"
  expect_out "uncommitted changes under the compared sources: none" "a clean checkout reports no changes"

  printf '\ndirty edit\n' >>"$FIXTURE/skills/alpha/references/notes.md"
  sk install alpha --target "$TARGET" --replace >/dev/null 2>&1
  sk check alpha --target "$TARGET"
  expect_rc 0 "a dirty source can still compare as consistent"
  expect_out "uncommitted changes under the compared sources:" "a dirty checkout reports its changes"
  expect_out "references/notes.md" "the dirty report names the modified file"
  expect_no_out "uncommitted changes under the compared sources: none" \
    "a dirty checkout is not reported as clean"
  expect_out "not as stored in" "the report distinguishes the working tree from the commit"
  git -C "$FIXTURE" checkout -- skills/alpha/references/notes.md 2>/dev/null
else
  printf 'skip git is not available\n'
fi

printf '\n# unreadable trees\n'

if [ "$(id -u 2>/dev/null)" = 0 ]; then
  printf 'skip permission tests: the test process is root, so an unreadable mode stays readable\n'
else
  fresh_target
  sk install alpha --target "$TARGET" >/dev/null 2>&1

  chmod 000 "$TARGET/alpha/references"
  sk check alpha --target "$TARGET"
  expect_rc 2 "an unreadable subdirectory in the target exits 2"
  expect_out "cannot compare" "the unreadable target is reported as not comparable"
  expect_no_out "state    identical" "an unreadable target is not reported as identical"
  chmod 755 "$TARGET/alpha/references"

  chmod 000 "$TARGET/alpha/SKILL.md"
  sk check alpha --target "$TARGET"
  expect_rc 2 "an unreadable file in the target exits 2"
  expect_no_out "state    identical" "an unreadable file is not reported as identical"
  expect_no_out "state    differs" "an unreadable file is not reported as a difference"
  chmod 644 "$TARGET/alpha/SKILL.md"

  sk check alpha --target "$TARGET"
  expect_rc 0 "the target compares again once its modes are restored"

  mkdir -p "$FIXTURE/skills/alpha/hidden"
  printf 'hidden\n' >"$FIXTURE/skills/alpha/hidden/secret.md"
  chmod 000 "$FIXTURE/skills/alpha/hidden"
  sk check alpha --target "$TARGET"
  expect_rc 2 "an unreadable subdirectory in the source exits 2"
  expect_err "cannot read the source directory" "the unreadable source names the failure"
  sk install alpha --target "$TARGET" --replace
  expect_rc 2 "install refuses an unreadable source"
  expect_no_out "result   installed" "the refused install reports no success"
  chmod 755 "$FIXTURE/skills/alpha/hidden"
  rm -rf -- "$FIXTURE/skills/alpha/hidden"

  backups_before=$(find "$XDG_STATE_HOME" -type d -name '*-alpha' 2>/dev/null | wc -l)
  chmod 000 "$TARGET/alpha/references"
  sk install alpha --target "$TARGET" --replace
  expect_rc 2 "install refuses an unreadable target"
  expect_no_out "result   installed" "the refused replacement reports no success"
  expect_dir "$TARGET/alpha" "the unreadable target is kept"
  chmod 755 "$TARGET/alpha/references"
  backups_after=$(find "$XDG_STATE_HOME" -type d -name '*-alpha' 2>/dev/null | wc -l)
  if [ "$backups_before" -eq "$backups_after" ]; then
    ok "a refused replacement creates no backup"
  else
    bad "a refused replacement creates no backup"
  fi

  chmod 000 "$TARGET/alpha/workflow"
  sk uninstall alpha --target "$TARGET" --yes
  expect_rc 2 "uninstall refuses an unreadable target"
  expect_dir "$TARGET/alpha" "the unreadable target is kept"
  chmod 755 "$TARGET/alpha/workflow"

  sk check alpha --target "$TARGET"
  expect_rc 0 "the restored target is still consistent"

  # A local write failure stops the command, keeps the installed Skill, and
  # leaves no staged copy behind.
  fresh_target
  sk install alpha --target "$TARGET" >/dev/null 2>&1
  printf 'local\n' >"$TARGET/alpha/local.md"
  saved_target=$(snapshot "$TARGET/alpha")

  mkdir -p "$FIXTURE/skills/locked"
  {
    printf '%s\n' '---' 'name: locked' 'description: Fixture Skill for a failed copy.'
    printf '%s\n' 'metadata:' '  version: "1.0.0"' '---' '' '# Locked'
  } >"$FIXTURE/skills/locked/SKILL.md"
  printf 'secret\n' >"$FIXTURE/skills/locked/secret.md"
  chmod 000 "$FIXTURE/skills/locked/secret.md"

  sk install locked --target "$TARGET"
  expect_rc 2 "an unreadable source file fails the install"
  expect_no_out "result   installed" "the failed install reports no success"
  if [ -z "$(find "$TARGET" -name '.skills-sh-*' -print 2>/dev/null)" ]; then
    ok "the failed install leaves no staged copy"
  else
    bad "the failed install leaves no staged copy"
  fi
  expect_no_entry "$TARGET/locked" "the failed install leaves no Skill entry"
  expect_unchanged "$saved_target" "$TARGET/alpha" "the failed install keeps the installed Skills"

  chmod 644 "$FIXTURE/skills/locked/secret.md"
  rm -rf -- "$FIXTURE/skills/locked"

  fresh_target
  sk install alpha --target "$TARGET" >/dev/null 2>&1
  printf 'local\n' >"$TARGET/alpha/local.md"
  saved_target=$(snapshot "$TARGET/alpha")
  chmod 500 "$TARGET"
  sk install alpha --target "$TARGET" --replace
  expect_rc 2 "a failed write into the Skill root is reported as a failure"
  chmod 755 "$TARGET"
  expect_unchanged "$saved_target" "$TARGET/alpha" "the failed replacement keeps the installed Skill"
  if [ -z "$(find "$TARGET" -name '.skills-sh-*' -print 2>/dev/null)" ]; then
    ok "the failed replacement leaves no staged copy"
  else
    bad "the failed replacement leaves no staged copy"
  fi
fi

printf '\n%d checks, %d failures\n' "$CHECKS" "$FAILURES"
if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
exit 0
