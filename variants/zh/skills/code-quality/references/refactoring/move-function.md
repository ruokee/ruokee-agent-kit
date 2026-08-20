# 移动函数（Move Function）

## 什么是移动函数

移动函数（Move Function）将一个函数（或方法）从一个模块或类重新定位到另一个更合适的所有者。程序的结构反映了其行为所在的位置；随着理解的加深，行为往往被发现坐在了错误的地方。移动函数就是你纠正这一点的方式：将代码放在它所操作的数据旁边，以及它与之一起变更的其他代码旁边。

```python
# before: account.py reaches into a rate table it doesn't own
class Account:
    def overdraft_charge(self):
        if self.type.is_premium:
            base = 10
            return base + max(0, self.days_overdrawn - 7) * 0.85
        return self.days_overdrawn * 1.75

# after: the charge rule lives with the account type that defines it
class AccountType:
    def overdraft_charge(self, days_overdrawn):
        if self.is_premium:
            return 10 + max(0, days_overdrawn - 7) * 0.85
        return days_overdrawn * 1.75
```

## 移动的时机信号

- **依恋情结（Feature Envy）。** 最清晰的信号：一个函数使用另一个对象的数据多于使用自己的。[feature-envy.md](./feature-envy.md) 中该坏味的修复方法通常是移动函数：将行为迁移到它渴望的数据所在的对象上。这遵循了 GRASP 信息专家的思想：将行为放在信息所在的地方（`variants/zh/skills/code-quality/references/design-principles/grasp.md`）。
- **耦合方向。** 当模块 A 中的一个函数严重依赖模块 B 但几乎不依赖自己的模块时，依赖箭头与代码的位置相悖。将函数移动到 B 可以理顺依赖图并减少耦合。
- **共变更。** 当一个函数始终与另一个模块中的代码一起变更时，你总是在同一个提交中编辑它们，它们可能属于一起。这是 [shotgun-surgery.md](./shotgun-surgery.md) 指向合并的信号。

## 安全地执行移动

确定函数需要从其当前上下文中获得什么。如果它只使用目标的数据，移动是干净的。如果它跨越两者，你可能需要先拆分它（提取属于别处的部分，然后只移动那部分），或者将剩余的上下文作为参数传递。检查函数调用了什么以及什么调用了它：移动它可能反转依赖或创建循环，这本身就是关于移动是否正确的一种信息。

每一步都保持行为不变并运行测试；参见 [safe-refactoring.md](./safe-refactoring.md)。在 Python 中，还要更新导入并注意新位置可能引入的循环导入风险。

## 在迁移期间维护旧 API

当函数是公共或广泛使用接口的一部分时，不要一次性破坏调用方。将函数体移动到新位置，然后在旧位置留下一个委托函数，它转发到新位置。这暂时是一个 [thin-wrapper-function.md](./thin-wrapper-function.md)，这没问题；它在调用方迁移期间保持旧 API 稳定。一旦所有调用方指向新位置（用 `rg` 找到它们），删除委托。对于需要废弃期的情况，用警告标记旧路径，以便调用方知道更新。

## 何时不移动

如果一个函数确实以平衡的方式使用了来自多个对象的数据，可能没有单一的更好所有者：强制移动只是重新定位了耦合。而如果"更好的所有者"是一个数据专用对象（DTO、ORM 行、配置对象）应保持无行为状态，将行为移入会违反该边界；参见 `tell-dont-ask.md` 了解那行划在哪里。
