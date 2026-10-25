# Contribute

English | [中文](./CONTRIBUTING.zh.md)

Contributions can improve documentation, translations, problem reproductions, and the capabilities maintained here. Keep changes within the project's [first-party scope](./.agents/rule/boundary.md#first-party-scope).

## Report a problem

Search the [Issues](https://github.com/ruokee/ruokee-agent-kit/issues) for an existing report before opening one. Include the affected component, relevant component and Harness versions, steps to reproduce, expected behavior, actual behavior, and useful logs or examples. If you cannot tell which component is responsible, describe what you observed.

## Suggest a change

Use an [Issue](https://github.com/ruokee/ruokee-agent-kit/issues) to explain the problem, your current workflow, and the result you want. Discuss changes to project scope or long-lived contracts with the maintainer before implementing them. Ordinary fixes do not need a prior Issue.

## Improve documentation

Corrections, clearer examples, and translation fixes are useful contributions. Update affected language pairs or Skill variants together, and follow the [documentation rules](./.agents/rule/documentation.md) for language, links, and writing. Check that examples and linked sections match the behavior they describe.

For a documentation-only change, start with the root tools. Prepare additional component environments when the selected checks require them, including when check selection falls back to the complete check.

## Prepare a code change

1. Read the affected component's documentation, linked from the [capability list](./README.md#capabilities).
2. Follow the root [check prerequisites](./README.md#check-prerequisites), then prepare only the component environments required by the [check selection rules](./.agents/rule/development.md#checks). Component READMEs provide their own setup and validation commands.
3. Follow the [Git rules](./.agents/rule/git.md) for branches, working directories, and commit messages. Keep the change focused on the reported problem or agreed scope.
4. Update affected documentation with the behavior change. Follow the [component version rules](./.agents/rule/boundary.md#component-versions) for functional changes.

Use the tools required by the component you are changing. Contributing to this repository does not require one particular Agent Harness or model.

## Verify your change

Run `pnpm check:changed` from the repository root and exercise the changed behavior using the component's documented validation path. The [development rules](./.agents/rule/development.md) explain check selection and prerequisites. Report the commands or scenarios you actually ran, their results, and anything you could not verify. A missing prerequisite or a failed check should stay visible, not be hidden by skipping or weakening the check.

For documentation, also follow the links and examples as a reader would, and compare the affected language versions.

## Share your change

Use public [Issues](https://github.com/ruokee/ruokee-agent-kit/issues) or [pull requests](https://github.com/ruokee/ruokee-agent-kit/pulls) to discuss and share changes. A small fix can go straight to a pull request. Explain the motivation, scope, and actual validation results; link an existing discussion when relevant.

Contributors provide a focused change and its validation evidence. The maintainer handles the final [merge gate](./.agents/rule/development.md#merge-gate) and integration under the [Git rules](./.agents/rule/git.md). Acceptance depends on project fit and ongoing maintenance cost. A contribution does not guarantee a response or merge by a fixed date, or that the change will be accepted.
