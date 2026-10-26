# 模型提示词规则

[English](./model-prompts.md)

为指定模型追加系统指令。受覆盖的普通主轮次及子轮次分别按自身当前模型匹配，规则文件修改在下一受覆盖轮次生效。

## 启用

通过[原生配置](../README.zh.md#配置)设置 `modelPromptsEnabled=true`，然后重启 OMP。默认 `false`，关闭时不读取规则目录或文件，也不报告未使用文件的错误。

## 目录

可在以下位置创建规则：

- 当前配置档案的用户 agent 目录下的 `model-prompts`。未使用配置档案时默认是 `~/.omp/agent/model-prompts`；其他配置档案或 agent 目录覆盖使用各自目录。
- 当前项目的 `<cwd>/.omp/model-prompts`。

只读取直接子项中的非隐藏、小写 `.md` 普通文件。忽略文件符号链接、子目录、祖先目录及其他资源目录。目录不存在时视为空。

先追加用户规则，再追加项目规则。同目录按 JavaScript 字符串顺序排列文件名，可用 `10-base.md`、`20-detail.md` 等数字前缀明确顺序。项目文件不替换同名用户文件。每份匹配文件分别贡献正文，即使与其他文件内容相同。

## 文件格式

```markdown
---
metadata: optional, ignored
match:
  - exact: example-provider/example-model-1.0
  - model: another-model-1.0
  - contains: example-model
  - regex: ^example-provider/example-model-1\.0
---

Text appended to the system prompt.
```

使用 UTF-8 Markdown，允许一个开头 BOM。文件头元数据的分隔行必须精确为 `---`，使用 LF 或 CRLF 换行。`match` 必须是非空数组，每项恰有一个受支持键和非空白字符串：

- `exact`：完整匹配 `provider/model`。
- `model`：完整匹配模型 id，包括其中的 `/`。
- `contains`：对 `provider/model` 作字面子串匹配。
- `regex`：对 `provider/model` 使用不带标志的 JavaScript 正则表达式。

条件之间为或关系，文件命中多个条件仍只追加一次。匹配区分大小写，只比较文本，不解析别名、角色、家族、显示名、请求名、思考后缀、glob 或模型列表语法。额外顶层元数据忽略。未知键或多键条件使整份文件无效。

正文不能全为空白。结束分隔行换行之后的文本原样追加，包括空白、换行、注释及尾部换行。元数据和开头 BOM 不注入。扩展不增加标题或包装，不渲染类似模板的文字。原有指令保持顺序和文本。

## 文件生效

新增、编辑、删除或修复文件在下一受覆盖普通轮次生效，无需重启。失败文件不复用旧正文。没有当前模型或匹配文件时，指令不变。连续轮次不累积规则正文。

普通子会话按自身模型匹配，保留自身角色。计划模式子会话、Handoff、标题生成和分类不增加注入入口。规则不随每条提供方请求、临时轮内模型切换或自动回退刷新。后续扩展可能覆盖追加指令，安装顺序不保证优先级。

## 错误处理

无效文件整体跳过。错误报告固定原因和 `project/20-rules.md` 这样的相对来源。一个文件不可读只影响该文件，一个目录不可读只影响该目录，其他有效规则继续。意外处理错误保留传入指令，包括更早扩展的追加内容。

原因包括 `frontmatter-missing`、`frontmatter-invalid`、`match-missing`、`match-empty`、`entry-shape`、`entry-key`、`entry-value`、`regex-invalid`、`body-blank`、`file-unreadable`、`directory-unreadable` 和 `unexpected-error`。同会话重复相同诊断会被抑制。交互会话显示通知，无界面会话写宿主日志。不打印正文、绝对路径、原始解析异常或正则文本。

通过 `/smart-context` 查看能力是否启用。规则文件可即时刷新，但开关修改仍须重启。

## 信任

启用后项目规则成为系统指令，不新增项目信任门槛或安全隔离。JavaScript 正则没有沙箱或执行超时。正文没有大小限制，大规则占用提示词空间，慢目录拖延轮次准备。个人规则放在用户目录，启用前检查项目规则。

## 验证

组件检查覆盖各匹配键的正反用例、同一文件内的多条目择一语义、规则校验与 BOM 处理、LF 与 CRLF 的正文保真、两个目录之间不受读取完成顺序影响的排序、目录缺失，以及追加块不跨 turn 累积。
