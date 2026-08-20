# 测试

关于*测试质量*的参考文档——测试套件能否捕捉回归、记录行为、并在重构中存活。这是语言无关的指导：原则，以及违反原则的反模式。语言特定的机制（pytest fixture、参数化、mock、异步）放在对应的工程技能中；对于 Python 来说是 `python-engineering`。

整个领域建立在 Kent Beck 的一句话上：**测试应当与代码的行为耦合，与结构解耦。** [principles.md](./principles.md) 从中推导出可操作的规则；[test-smells.md](./test-smells.md) 把各种失败模式组织成 Fowler 风格的坏味道清单——每个症状都值得探究，且附有误报边界。

| 信号 | 阅读 |
|-|-|
| 什么让测试值得保留；行为 vs 实现、覆盖率、DAMP、隔离、更少更强的测试 | [principles.md](./principles.md) |
| "改了点代码就得重写一堆测试"；重构破坏了断言内部实现的测试 | [test-smells.md](./test-smells.md) —— 脆弱测试、变更检测器测试 |
| 冗余/死重测试；太多微测试；更少测试就能覆盖相同内容 | [test-smells.md](./test-smells.md) —— 变更检测器、测试错误的东西 |
| 测试与实现细节耦合；测试工具函数/配置/琐碎代码 | [test-smells.md](./test-smells.md) —— 测试错误的东西 |
| 不可读的测试、一个测试断言多个行为、无描述的断言 | [test-smells.md](./test-smells.md) —— 晦涩测试、断言轮盘赌 |
| 不稳定测试、顺序依赖、耦合于时钟/网络/随机 | [test-smells.md](./test-smells.md) —— 不稳定/非确定性测试 |
| 跨测试重复或近似重复的 fixture 和 setup | [test-smells.md](./test-smells.md) —— 测试代码重复 |

`variants/zh/skills/code-quality/references/refactoring` 下的[代码坏味道](variants/zh/skills/code-quality/references/refactoring/code-smells.md)覆盖的是测试所练习的*生产*代码；本目录关注测试代码本身。当某个单元难以测试的原因是依赖在内部直接获取而非注入时，这是一个设计信号——参见[依赖反转](variants/zh/skills/code-quality/references/design-principles/dependency-inversion.md)和[TDD](variants/zh/skills/code-quality/references/design-principles/tdd.md)。
