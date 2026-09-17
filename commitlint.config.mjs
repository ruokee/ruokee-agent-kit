const scopes = ["skills", "extensions", "adr", "repo"];

// The built-in scope-enum rule splits the scope on "/", "\", and ",", so a
// message such as "feat(skills/adr)" passes it. One exact membership rule
// rejects unknown values, upper-case letters, hyphens, underscores, and
// multi-area scopes, and passes a message without a scope, which commitlint
// parses as a null scope.
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
