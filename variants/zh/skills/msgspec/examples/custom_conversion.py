"""msgspec 自定义转换示例

演示如何使用 enc_hook 和 dec_hook 处理非原生支持的自定义类型：
- 路径类型转换（Path 不是原生支持的类型）
- ORM 对象转换
- msgspec.convert 函数
- 自定义格式转换

注意：datetime, date, Enum 等类型是 msgspec 原生支持的，不需要自定义钩子。
"""

from datetime import datetime, date, timedelta
from pathlib import Path
from enum import Enum
from typing import Any
import msgspec


# ========== 自定义类型定义 ==========
class UserRole(Enum):
    """用户角色枚举（原生支持，不需要钩子）"""

    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


class User(msgspec.Struct):
    """用户信息（datetime/date/Enum 原生支持）"""

    id: int
    name: str
    role: UserRole
    created_at: datetime
    last_login: date | None = None


class Project(msgspec.Struct):
    """项目信息（Path 需要自定义钩子）"""

    name: str
    path: Path  # Path 不是原生支持的类型
    created: datetime
    deadline: date

# ========== 示例 1: Path 类型钩子 ==========
def path_enc_hook(obj: Any) -> str:
    """处理 Path 类型的编码钩子"""
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"不支持的类型: {type(obj)}")


def path_dec_hook(type_: type, obj: Any) -> Path:
    """处理 Path 类型的解码钩子"""
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持的类型: {type_}")


# ========== 示例 2: ORM 模拟类 ==========
class ORMModel:
    """模拟 ORM 模型基类"""

    def __init__(self, **kwargs: Any) -> None:
        for key, value in kwargs.items():
            setattr(self, key, value)

    def __repr__(self) -> str:
        attrs = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"{self.__class__.__name__}({attrs})"


class UserORM(ORMModel):
    """用户 ORM 模型"""

    pass


def orm_enc_hook(obj: Any) -> Any:
    """ORM 编码钩子"""
    if isinstance(obj, ORMModel):
        # 将 ORM 对象转换为字典
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    elif isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"不支持的类型: {type(obj)}")


def demo_native_support() -> None:
    """演示 msgspec 原生支持的类型（无需钩子）"""
    print("\n1. 原生支持的类型（无需钩子）")
    print("-" * 60)

    user = User(
        id=1,
        name="张三",
        role=UserRole.ADMIN,
        created_at=datetime(2024, 1, 1, 12, 0, 0),
        last_login=date(2024, 1, 15),
    )

    print(f"原始对象: {user}")

    # datetime, date, Enum 都是原生支持的，无需钩子
    encoded = msgspec.json.encode(user)
    print(f"编码结果: {encoded.decode()}")

    decoded = msgspec.json.decode(encoded, type=User)
    print(f"解码结果: {decoded}")
    print(f"类型验证: role={decoded.role} (type={type(decoded.role).__name__})")
    print(f"           created_at={decoded.created_at} (type={type(decoded.created_at).__name__})")


def demo_path_handling() -> None:
    """演示路径类型处理（需要钩子）"""
    print("\n2. Path 类型处理（需要自定义钩子）")
    print("-" * 60)

    project = Project(
        name="MyProject",
        path=Path("/home/user/projects/myproject"),
        created=datetime.now(),
        deadline=date.today() + timedelta(days=30),
    )

    print(f"原始项目: {project}")

    # Path 不是原生支持的，需要 enc_hook
    encoder = msgspec.json.Encoder(enc_hook=path_enc_hook)
    encoded = encoder.encode(project)
    print(f"编码结果: {encoded.decode()}")

    # 解码也需要 dec_hook
    decoder = msgspec.json.Decoder(type=Project, dec_hook=path_dec_hook)
    decoded_project: Project = decoder.decode(encoded)
    print(f"解码结果: {decoded_project}")
    print(f"路径类型: {type(decoded_project.path).__name__} = {decoded_project.path}")


def demo_msgspec_convert() -> None:
    """演示 msgspec.convert 函数"""
    print("\n3. msgspec.convert 函数")
    print("-" * 60)

    # 字典到 Struct（原生类型无需钩子）
    user_dict = {
        "id": 2,
        "name": "李四",
        "role": "user",
        "created_at": "2024-01-10T08:00:00",
        "last_login": "2024-01-15",
    }

    print(f"原始字典: {user_dict}")

    # datetime, date, Enum 原生支持，无需 dec_hook
    converted_user = msgspec.convert(user_dict, type=User)
    print(f"转换结果: {converted_user}")
    print(f"类型验证: {type(converted_user).__name__}, role={type(converted_user.role).__name__}")

    # Struct 到字典（Path 需要 enc_hook）
    project_dict = {
        "name": "TestProject",
        "path": "/home/user/test",
        "created": "2024-01-01T00:00:00",
        "deadline": "2024-12-31",
    }

    # Path 需要 dec_hook
    converted_project = msgspec.convert(project_dict, type=Project, dec_hook=path_dec_hook)
    print(f"转换项目: {converted_project}")
    print(f"路径类型: {type(converted_project.path).__name__}")


def demo_orm_conversion() -> None:
    """演示 ORM 对象转换"""
    print("\n4. ORM 对象转换")
    print("-" * 60)

    # 创建 ORM 对象
    orm_user = UserORM(id=3, name="王五", email="wangwu@example.com", role="admin")

    print(f"ORM 对象: {orm_user}")

    # 转换为 JSON
    encoder = msgspec.json.Encoder(enc_hook=orm_enc_hook)
    encoded_orm = encoder.encode(orm_user)
    print(f"编码结果: {encoded_orm.decode()}")

    # ORM 到 Struct
    class SimpleUser(msgspec.Struct):
        id: int
        name: str
        email: str
        role: str

    converted = msgspec.convert(orm_user, type=SimpleUser, from_attributes=True)
    print(f"转换为 Struct: {converted}")


def main() -> None:
    """运行所有示例"""
    print("=" * 60)
    print("msgspec 自定义转换示例")
    print("=" * 60)

    demo_native_support()
    demo_path_handling()
    demo_msgspec_convert()
    demo_orm_conversion()

    print("\n" + "=" * 60)
    print("示例运行完成！")
    print("=" * 60)
    print("\n重要提示:")
    print("- datetime, date, Enum 等类型是 msgspec 原生支持的，无需钩子")
    print("- Path 类型需要使用 enc_hook 和 dec_hook 进行转换")
    print("- 对于原生支持的类型，enc_hook 不会被调用，msgspec 直接使用内置序列化")
    print("- ORM 对象等第三方类需要自定义钩子")


if __name__ == "__main__":
    main()
