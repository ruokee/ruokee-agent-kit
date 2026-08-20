"""msgspec 基本使用示例

演示 msgspec 的基础功能：
- Struct 定义
- 默认值处理
- 序列化和反序列化
- 类型验证
"""

from typing import Annotated
import msgspec


# 1. 基本 Struct 定义
class User(msgspec.Struct):
    """用户信息结构体"""

    name: Annotated[str, msgspec.Meta(description="用户名")]
    age: Annotated[int, msgspec.Meta(description="年龄", ge=0, le=150)]
    email: Annotated[str, msgspec.Meta(description="邮箱地址")]


# 2. 带默认值的 Struct
class UserProfile(msgspec.Struct):
    """用户配置文件"""

    name: str
    age: int
    # 不可变类型的默认值
    role: str = "user"
    active: bool = True
    # 内置空集合是安全简写，每个实例都会获得独立默认值
    tags: list[str] = []
    metadata: dict[str, str] = {}


# 3. 不可变 Struct (frozen)
class Point(msgspec.Struct, frozen=True):
    """二维坐标点（不可变）"""

    x: Annotated[float, msgspec.Meta(description="X 坐标")]
    y: Annotated[float, msgspec.Meta(description="Y 坐标")]


# 4. 关键字参数 Struct (kw_only)
class Config(msgspec.Struct, kw_only=True):
    """配置对象（仅限关键字参数）"""

    api_key: str
    timeout: int = 30
    max_retries: int = 3


def main() -> None:
    print("=" * 60)
    print("msgspec 基本使用示例")
    print("=" * 60)

    # ========== 1. 创建和使用基本 Struct ==========
    print("\n1. 基本 Struct 使用")
    print("-" * 60)

    user = User(name="张三", age=25, email="zhangsan@example.com")
    print(f"创建用户: {user}")

    # JSON 序列化
    encoded = msgspec.json.encode(user)
    print(f"JSON 编码: {encoded.decode()}")

    # JSON 反序列化
    decoded = msgspec.json.decode(encoded, type=User)
    print(f"JSON 解码: {decoded}")
    print(f"类型验证: {decoded.name=}, {decoded.age=}, {decoded.email=}")

    # ========== 2. 带默认值的 Struct ==========
    print("\n2. 带默认值的 Struct")
    print("-" * 60)

    # 使用默认值
    profile1 = UserProfile(name="李四", age=30)
    print(f"使用默认值: {profile1}")
    print(f"  role={profile1.role}, active={profile1.active}")
    print(f"  tags={profile1.tags}, metadata={profile1.metadata}")

    # 覆盖默认值
    profile2 = UserProfile(
        name="王五",
        age=28,
        role="admin",
        active=False,
        tags=["vip", "developer"],
        metadata={"department": "engineering"},
    )
    print(f"覆盖默认值: {profile2}")

    # 验证可变默认值的独立性
    profile1.tags.append("test")
    profile1.metadata["key"] = "value"
    print("\n修改 profile1 后:")
    print(f"  profile1.tags={profile1.tags}")
    print(f"  profile2.tags={profile2.tags}  <- 不受影响")

    # ========== 3. 不可变 Struct ==========
    print("\n3. 不可变 Struct (frozen)")
    print("-" * 60)

    point = Point(x=1.0, y=2.0)
    print(f"创建坐标点: {point}")

    # 使用内置的 replace 模式创建新实例（通过重新构造）
    new_point = msgspec.structs.replace(point, x=3)
    print(f"修改 x 坐标: {new_point}")
    print(f"原始坐标不变: {point}")

    # 尝试直接修改会报错
    try:
        point.x = 5.0  # type: ignore
    except AttributeError as e:
        print(f"直接修改失败: {e}")

    # ========== 4. 关键字参数 Struct ==========
    print("\n4. 关键字参数 Struct (kw_only)")
    print("-" * 60)

    # 必须使用关键字参数
    config = Config(api_key="secret-key-123")
    print(f"创建配置: {config}")

    # 尝试使用位置参数会报错
    try:
        Config("secret-key-123")  # type: ignore
    except TypeError as e:
        print(f"位置参数失败: {e}")

    # ========== 5. 类型验证 ==========
    print("\n5. 类型验证")
    print("-" * 60)

    # 正确的类型
    valid_user = msgspec.json.decode('{"name":"赵六","age":35,"email":"zhaoliu@example.com"}', type=User)
    print(f"有效数据: {valid_user}")

    # 错误的类型会抛出异常
    try:
        invalid_data = '{"name":"钱七","age":"not a number","email":"qianqi@example.com"}'
        msgspec.json.decode(invalid_data, type=User)
    except msgspec.ValidationError as e:
        print(f"类型验证失败: {e}")

    # 违反约束（年龄超出范围）
    try:
        invalid_age = '{"name":"孙八","age":200,"email":"sunba@example.com"}'
        msgspec.json.decode(invalid_age, type=User)
    except msgspec.ValidationError as e:
        print(f"约束验证失败: {e}")

    # ========== 6. 多协议支持 ==========
    print("\n6. 多协议支持")
    print("-" * 60)

    user_data = User(name="周九", age=40, email="zhoujiu@example.com")

    # JSON
    json_data = msgspec.json.encode(user_data)
    print(f"JSON: {json_data.decode()}")

    # MessagePack
    msgpack_data = msgspec.msgpack.encode(user_data)
    print(f"MessagePack: {msgpack_data!r}")

    # YAML (需要安装 PyYAML)
    try:
        yaml_data = msgspec.yaml.encode(user_data)
        print(f"YAML:\n{yaml_data.decode()}")
    except ImportError:
        print("YAML: 需要安装 PyYAML (uv add msgspec[yaml])")

    # TOML (需要安装 tomli/tomli-w)
    try:
        toml_data = msgspec.toml.encode(user_data)
        print(f"TOML:\n{toml_data.decode()}")
    except ImportError:
        print("TOML: 需要安装 tomli/tomli-w (uv add msgspec[toml])")

    print("\n" + "=" * 60)
    print("示例运行完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
