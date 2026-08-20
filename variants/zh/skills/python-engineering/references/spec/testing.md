# 测试规范

本文档说明如何组织和编写 pytest 测试套件，涵盖测试位置、命名、fixture、参数化、mock、异步测试和可维护的 pytest 惯用法。发现、导入模式、标记、严格模式、配置和插件等运行器配置见 [pytest](variants/zh/skills/python-engineering/references/tooling/pytest.md)。

测试应该与代码的*行为*耦合，并与其*结构*解耦。测试一个单元从外部做了什么，例如返回值、抛出的异常和记录的副作用。不要测试它内部如何完成工作。

## 测试组织

测试放在顶层 `tests/` 目录中，与生产包分开，这样测试可以像真实使用者一样导入并使用包，且发现行为保持可预测（关于 src 布局为什么强化这一点，参见[项目结构](variants/zh/skills/python-engineering/references/project/structure.md)）。这种布局使测试保持在*可导入的*包之外，但本身并不决定 sdist 或 wheel 最终包含什么；那由构建后端的包发现和 include/exclude 配置决定，因此如果确实需要从分发产物中排除测试，应检查构建产物。以*被测行为*命名测试文件和函数，而不是它们碰巧触及的实现文件：`test_expired_token_is_rejected` 告诉读者系统保证了什么；`test_validate` 只告诉读者哪个函数跑了。对于大型库或框架，松散地镜像包树有助于定位测试，但镜像只是导航辅助，不是每个模块都要有对应测试文件的规则。测试应得到与生产代码同等的关注：清晰的名字、没有复制粘贴的蔓延、以及显而易见的意图。

## 消除重复而非制造重复的 Fixture

Fixture 按名字请求：测试把 fixture 声明为参数，pytest 找到它并注入进来。对可维护性最重要的机制是 **fixture 可以请求其他 fixture**，所以共享 setup 组合成依赖图，而不是被复制。AI 写测试套件时两种最常见的失败是同一误解的两端：要么 fixture 被忽略、setup 粘贴到每个测试里，要么一个巨型 fixture 构建了完整世界、每个测试都拖进来。

两者都通过同一条纪律解决：

- **把共享 fixture 放在正确的层级。** [pytest](variants/zh/skills/python-engineering/references/tooling/pytest.md) 覆盖了 `conftest.py` 的加载和可见性机制；这里只讲放在哪里的判断。跨套件共用的 fixture 放在根 `conftest.py`；只由某子树使用的放在该子树的 `conftest.py`。这是"同一个 fixture 在几个地方定义、微妙不同"的直接解法：在正确层级*定义一次*，而不是散落近似副本。在嵌套 `conftest.py` 里*有意*覆盖某个 fixture 为子树定制是受支持的模式，不算重复：坏味道说的是*意外*的近似副本，不是有意的子树特化。
- **先发现再定义。** `pytest --fixtures` 列出每个可用 fixture 和来源。写新 fixture 前跑一下，复用已有的而不是加第六个近似副本。
- **Fixture 保持小巧、以提供的内容命名**（`temp_db`、`authenticated_client`），组合使用。测试的参数列表应该就是它的依赖列表。抵制构建一切的"上帝 fixture"；这是 Meszaros 的 General Fixture 坏味道，让每个测试都变晦涩。
- **作用域为隔离服务，只为成本才拓宽。** [pytest](variants/zh/skills/python-engineering/references/tooling/pytest.md) 文档了作用域级别和 `yield` teardown；判断准则是停留在默认值（每个测试全新状态，隔离基线），只有真正昂贵*且*安全可共享的 setup 才拓宽：拓宽是用隔离换速度。Fixture 需要清理时，一个 setup 配一个 teardown，而不是把几个脆弱的 setup 堆进一个 fixture。

```python
# conftest.py: 一个定义，可组合，默认函数作用域
import pytest


@pytest.fixture
def config() -> Config:
    return Config(timeout=30, retries=3)


@pytest.fixture
def client(config: Config) -> Iterator[Client]:
    c = Client(config)          # setup
    yield c
    c.close()                   # teardown，即使失败也运行
```

### 工厂即 Fixture：用于可变实例

一个测试需要同类型*多个*对象，或字段因测试而异的对象时，从 fixture 返回一个*函数*而不是对象。这用单个 fixture 代替了一群近似相同的 fixture，并且让变化的值在测试体里可见（DAMP）：

```python
@pytest.fixture
def make_user() -> Callable[..., User]:
    def _make(name: str = "alice", *, admin: bool = False) -> User:
        return User(name=name, admin=admin)
    return _make


def test_admins_can_publish(make_user: Callable[..., User]) -> None:
    author = make_user(admin=True)
    assert author.can_publish()
```

### 慎用 autouse

`autouse=True` fixture 不需请求就应用于作用域内每个测试。它适合真正的横切副作用（为整个模块 patch 时钟），但它制造了测试体不展示的*隐式*依赖，不利于可读性。除非 setup 真的必须处处应用，否则优先显式请求的 fixture。

## 参数化：把案例变成数据

[pytest](variants/zh/skills/python-engineering/references/tooling/pytest.md) 覆盖 `@pytest.mark.parametrize` 的机制。对测试*质量*而言重要的是什么时候该用、什么时候不该用：参数化是用*更少更强*的测试代替复制粘贴的测试代码的方式：把对不同数据的同一检查做成一张可见的表格。

```python
@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        pytest.param("  Alice ", "alice", id="trims-and-lowercases"),
        pytest.param("BOB", "bob", id="lowercases"),
        pytest.param("", "", id="empty-passes-through"),
    ],
)
def test_normalize_username(raw: str, expected: str) -> None:
    assert normalize_username(raw) == expected
```

除基础用法外，有两个惯用法在参数化与 fixture 之间架桥：

- **`indirect=True`** 把一个参数先路由过一个同名 fixture，用于那些在到达测试体之前需要 setup 的案例。
- **参数化 fixture**（`@pytest.fixture(params=[...])`）让*每个*使用它的测试都针对每个变体运行，当变化属于依赖本身、而非某一个测试时使用它。

限度是：只在案例是*对不同数据的同一检查*时才参数化。当案例需要真正不同的 setup 或不同的断言时，强行把它们塞进一个测试体会产生分支逻辑，这比独立的测试更难读。不同的行为想要不同的测试。

## 断言异常和警告

```python
def test_zero_timeout_is_rejected() -> None:
    with pytest.raises(ValueError, match="must be positive") as excinfo:
        Config(timeout=0)
    assert excinfo.value.field == "timeout"
```

- **`pytest.raises` 匹配子类。** `pytest.raises(RuntimeError)` 对 `RuntimeError` 的子类也通过。当*确切*类型就是契约时，加上 `assert excinfo.type is RuntimeError`；否则测试会静默接受一个更宽泛的失败。
- **`match=` 使用 `re.search` 检查消息**：它执行子串或正则匹配，而不是完全匹配。只固定消息中*有意义*的部分，不要固定整个字符串，否则测试会变得脆弱。
- **`pytest.warns(SomeWarning, match=...)`** 用于警告；`pytest.deprecated_call()` 专用于弃用警告；`recwarn` fixture 记录警告供检查。
- 断言所引发异常的*可观察*属性，而不是在抛出过程中构建的内部状态。

## 捕获日志和输出：caplog、capsys

当可观察行为*就是*日志行或控制台输出时，通过 pytest 的捕获 fixture 来断言，而不是手写 handler 或重定向流。

- **`caplog`** 捕获日志记录。尽量断言结构化字段（`caplog.records`、`caplog.record_tuples`）而不是 `caplog.text` 的子串，这样断言不会因消息措辞变化而失效。用 `caplog.set_level(logging.INFO)` 或作用域限定的 `with caplog.at_level(logging.INFO):` 设置捕获级别；`caplog.records` 只包含当前阶段（test）的记录，其他阶段用 `caplog.get_records("setup")` 访问。优先断言*事件*以正确级别被记录，而不是固定具体的字符串。
- **`capsys`** 捕获 `stdout`/`stderr`；`captured = capsys.readouterr()` 返回一个命名元组，包含 `.out` 和 `.err`，对当前输出做快照。需要在文件描述符层面捕获时（子进程或 C 库直接写 FD 1/2）用 `capfd`，处理字节流用对应的 `*binary` 变体。流会在测试后自动恢复。

```python
def test_warns_on_retry(caplog: pytest.LogCaptureFixture) -> None:
    with caplog.at_level(logging.WARNING):
        connect(retries=1)
    assert any(r.levelno == logging.WARNING for r in caplog.records)
```

一个值得注意的陷阱：日志很容易过度测试。日志行往往是附带产物，不是契约；只有在发出日志本身就是别人依赖的行为时才断言（审计追踪、运维告警），而不是仅仅因为代码恰好写了日志。

## monkeypatch 和 tmp_path：不用手写清理的状态

优先用 pytest 内建的状态操纵器，而不是手写 setup/cleanup。`monkeypatch` 在测试后**自动恢复**；`tmp_path` 由 **pytest 托管**而非留给你删除。无论哪种，都没有在测试失败时会被跳过的手动恢复步骤。

- **`monkeypatch`** patch 并自动撤销：`setattr` / `delattr`、`setenv` / `delenv`、`setitem` / `delitem`、`syspath_prepend`、`chdir`。`raising` 参数控制 patch 不存在的目标是否报错。时机关键：patch 必须在被测代码读目标*之前*应用。
- **在名字被查找的地方 patch，不是在它定义的地方。** 如果被测模块 `from services import Client`，patch `module_under_test.Client`；如果 `import services` 然后调 `services.Client`，patch `services.Client`。这个"在哪 patch"的规则（来自 `unittest.mock` 文档）是 mock 静默不做事的头号原因。
- **`tmp_path`** 给每个测试一个唯一的 `pathlib.Path` 临时目录（函数作用域）；**`tmp_path_factory`** 是 session 作用域版本，用于跨测试共享的临时资源。pytest 管理其创建和保留；默认保留最近几次运行的目录（可通过 `tmp_path_retention_count` / `tmp_path_retention_policy` 配置），所以测试永远不需要手写删除逻辑。用这些代替 `tempfile` 加手动删除。

```python
def test_reads_token_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_TOKEN", "secret")   # 测试后自动还原
    assert load_token() == "secret"
```

## 在边界处 Mock

pytest 不替代 `unittest.mock`，而是承载它。在网络、时钟、文件系统和外部服务等系统边界处使用 mock，因为真实依赖往往缓慢或不确定。对便宜、确定的协作者使用真实对象。如果测试 mock 了被测代码及其紧密协作者，它就会变成变更检测器测试，只验证代码是否按预设方式调用 mock。这种循环论证会在保持行为不变的重构中失效。

两点可以避免 mock 产生误导：

- **在被查找的命名空间用 `monkeypatch.setattr` 或 `patch`**（见上文）：路径错了就什么也没 patch，测试意外通了真实代码。
- **优先用真实的内存假实现，而不是带脚本化调用期望的 mock。** 假实现（内存仓库、固定时钟）验证*状态*，能挺过重构；验证*调用顺序和参数*的 mock 固定结构。只有交互本身是可观察行为时（扣款恰好发生了一次）才用交互验证。

一个单元不 mock 周围一切就很难测时，这是个设计信号：通常说明应把依赖作为参数注入，而不是在内部获取。

## 异步测试

在 `pytest-asyncio` 的默认**严格**模式下，用 `@pytest.mark.asyncio` 标记协程测试，用 `@pytest_asyncio.fixture` 标记异步 fixture，插件就能跟其他插件干净共存。每个测试默认拿到函数作用域的事件循环，最大化隔离；只有测试必须共享循环时才用 `loop_scope` 拓宽。异步测试顺序运行，不并发，正是为了保持隔离：不要靠它们竞速。

```python
@pytest.mark.asyncio
async def test_fetch_returns_payload() -> None:
    result = await fetch("/health")
    assert result.status == 200
```

固定行为，而不是插件开发版本中的具体 API：概念（标记、异步 fixture、循环作用域）稳定，具体 fixture 各版本间变动过。

## pytest 中的反模式

以下是 pytest 中常见的测试坏味道：

- **跨文件重复的 `conftest`/fixture 定义** → 合并到最近的公共 `conftest.py`；用 `pytest --fixtures` 找出来。
- **每个测试都依赖的上帝 fixture** → 拆成小的可组合 fixture；General Fixture 是晦涩测试坏味道。
- **`assert_called_with` 作为唯一断言** → 变更检测器测试；改为断言结果或真实副作用。
- **用 `time.sleep` 等异步工作、真 `datetime.now()`、没设种子的 `random`** → 不稳定测试；注入时钟、给 RNG 设种子、控制边界。
- **断言 `SETTINGS.timeout == 30`** → 测试错误的东西；测值驱动的行为，不是字面量。
- **没有 `match` 的 `pytest.raises(Exception)`** → 过于宽泛；引发了错误异常的 bug 也能过。收窄类型并固定消息。
