# 参与贡献

[English](./CONTRIBUTING.md) | 中文

你可以改进文档、翻译、问题复现，以及本仓库维护的能力。改动应符合项目的[第一方范围](./.agents/rule/boundary.zh.md#第一方范围)。

参与时须遵守[社区行为准则](./CODE_OF_CONDUCT.zh.md)。行为问题通过准则中的[私密渠道](./CODE_OF_CONDUCT.zh.md#报告问题)报告，不在公开 Issue 或 PR 中举报。

## 报告问题

疑似漏洞请通过[安全策略](./SECURITY.zh.md#报告漏洞)中的私密渠道报告，不要使用公开 Issue 或 PR。

普通非安全问题在提交前先到 [Issues](https://github.com/ruokee/ruokee-agent-kit/issues) 中搜索已有报告。说明受影响组件、相关组件与 Harness 版本、复现步骤、预期行为、实际行为，以及有帮助的日志或示例。如果无法判断由哪个组件引起，描述观察到的现象即可。

## 提出建议

通过 [Issue](https://github.com/ruokee/ruokee-agent-kit/issues) 说明问题、当前工作方式和期望结果。涉及项目范围或长期契约的改动，先与维护者讨论再实施。普通修正不需要预先创建 Issue。

## 改进文档

纠正错误、补充易懂的示例、修正翻译，都是有用的贡献。同步更新受影响的语言配对或 Skill 变体，并遵循[文档规则](./.agents/rule/documentation.zh.md)中的语言、链接和写作要求。核对示例及所链接章节是否与描述的行为一致。

仅修改文档时，先准备根工具，再按选中检查的要求补齐组件环境；检查选择回退到完整检查时，也按其要求准备。

## 准备代码改动

1. 从[功能列表](./README.zh.md#功能列表)进入受影响组件的文档。
2. 按根目录的[检查前置条件](./README.zh.md#检查前置条件)准备，再根据[检查选择规则](./.agents/rule/development.zh.md#检查)准备所需的组件环境。各组件 README 提供自己的环境准备和验证命令。
3. 按 [Git 规则](./.agents/rule/git.zh.md)管理分支、工作目录和提交信息。改动只处理所报告的问题或已确定的范围。
4. 行为改动同时更新受影响文档。功能变更遵循[组件版本规则](./.agents/rule/boundary.zh.md#组件版本)。

使用所改组件需要的工具即可，参与本仓库贡献不要求使用某个特定 Agent Harness 或模型。

## 验证改动

在仓库根目录运行 `pnpm check:changed`，并按组件文档中的验证路径实际检查所改行为。[开发规则](./.agents/rule/development.zh.md)说明检查选择和前置条件。记录实际运行的命令或场景、结果，以及无法验证的部分。缺少前置条件或检查失败时如实说明，不通过跳过或削弱检查来掩盖问题。

文档改动还需要按读者的使用路径打开链接、核对示例，并比较受影响的语言版本。

## 提交改动

通过公开 [Issues](https://github.com/ruokee/ruokee-agent-kit/issues) 或 [Pull Requests](https://github.com/ruokee/ruokee-agent-kit/pulls) 讨论和提交改动。小修正可以直接提交 PR。说明动机、范围和实际验证结果，有相关讨论时附上链接。

贡献者负责提供聚焦的改动及验证证据。维护者负责最终[合并门禁](./.agents/rule/development.zh.md#合并门禁)，并按 [Git 规则](./.agents/rule/git.zh.md)集成。是否接收取决于项目适配程度和持续维护成本。提交贡献不代表一定接收，也不承诺固定的回复或合并期限。
