const scopes = ["skills", "extensions", "adr", "repo"];

// The built-in scope-enum rule splits the scope on "/", "\", and ",", so a
// message such as "feat(skills/adr)" passes it. One exact membership rule
// rejects unknown values, upper-case letters, hyphens, underscores, and
// multi-area scopes, and passes a message without a scope, which commitlint
// parses as a null scope.

// The rules inherit config-conventional defaults: a subject that opens with a
// capital letter or ends with a full stop is rejected, and body and footer
// lines are limited to 100 characters. Commitlint skips its default ignore
// patterns, which cover version subjects such as "v1.2.3", "fixup!" and
// "squash!" prefixes, and Git-style "Revert ..." and "Merge ..." subjects.
export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "scope-allowed": ({ scope }) => [
          scope === null || scopes.includes(scope),
          `scope must be omitted or one of: ${scopes.join(", ")}`,
        ],
      },
    },
  ],
  rules: {
    "scope-allowed": [2, "always"],
  },
};
