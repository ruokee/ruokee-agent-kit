"""msgspec Custom Conversion Example

Demonstrates how to use enc_hook and dec_hook for non-natively-supported custom types:
- Path type conversion (Path is not natively supported)
- ORM object conversion
- msgspec.convert function
- Custom format conversion

Note: datetime, date, and Enum are natively supported by msgspec and do not need custom hooks.
"""

from datetime import datetime, date, timedelta
from pathlib import Path
from enum import Enum
from typing import Any
import msgspec


# ========== Custom Type Definitions ==========
class UserRole(Enum):
    """User role enum (natively supported, no hook needed)"""

    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"


class User(msgspec.Struct):
    """User information (datetime/date/Enum natively supported)"""

    id: int
    name: str
    role: UserRole
    created_at: datetime
    last_login: date | None = None


class Project(msgspec.Struct):
    """Project information (Path needs custom hook)"""

    name: str
    path: Path  # Path is not natively supported
    created: datetime
    deadline: date


# ========== Example 1: Path Type Hooks ==========
def path_enc_hook(obj: Any) -> str:
    """Encoding hook for Path type"""
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"Unsupported type: {type(obj)}")


def path_dec_hook(type_: type, obj: Any) -> Path:
    """Decoding hook for Path type"""
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")


# ========== Example 2: ORM Simulation ==========
class ORMModel:
    """Simulated ORM model base class"""

    def __init__(self, **kwargs: Any) -> None:
        for key, value in kwargs.items():
            setattr(self, key, value)

    def __repr__(self) -> str:
        attrs = ", ".join(f"{k}={v!r}" for k, v in self.__dict__.items())
        return f"{self.__class__.__name__}({attrs})"


class UserORM(ORMModel):
    """User ORM model"""

    pass


def orm_enc_hook(obj: Any) -> Any:
    """ORM encoding hook"""
    if isinstance(obj, ORMModel):
        # Convert ORM object to dict
        return {k: v for k, v in obj.__dict__.items() if not k.startswith("_")}
    elif isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"Unsupported type: {type(obj)}")


def demo_native_support() -> None:
    """Demonstrate natively supported types (no hooks needed)"""
    print("\n1. Natively Supported Types (No Hooks Needed)")
    print("-" * 60)

    user = User(
        id=1,
        name="Alice",
        role=UserRole.ADMIN,
        created_at=datetime(2024, 1, 1, 12, 0, 0),
        last_login=date(2024, 1, 15),
    )

    print(f"Original object: {user}")

    # datetime, date, Enum are all natively supported, no hook needed
    encoded = msgspec.json.encode(user)
    print(f"Encoded result: {encoded.decode()}")

    decoded = msgspec.json.decode(encoded, type=User)
    print(f"Decoded result: {decoded}")
    print(f"Type verification: role={decoded.role} (type={type(decoded.role).__name__})")
    print(f"                 created_at={decoded.created_at} (type={type(decoded.created_at).__name__})")


def demo_path_handling() -> None:
    """Demonstrate Path type handling (needs hooks)"""
    print("\n2. Path Type Handling (Needs Custom Hooks)")
    print("-" * 60)

    project = Project(
        name="MyProject",
        path=Path("/home/user/projects/myproject"),
        created=datetime.now(),
        deadline=date.today() + timedelta(days=30),
    )

    print(f"Original project: {project}")

    # Path is not natively supported, so use enc_hook
    encoder = msgspec.json.Encoder(enc_hook=path_enc_hook)
    encoded = encoder.encode(project)
    print(f"Encoded result: {encoded.decode()}")

    # Decoding also needs dec_hook
    decoder = msgspec.json.Decoder(type=Project, dec_hook=path_dec_hook)
    decoded_project: Project = decoder.decode(encoded)
    print(f"Decoded result: {decoded_project}")
    print(f"Path type: {type(decoded_project.path).__name__} = {decoded_project.path}")


def demo_msgspec_convert() -> None:
    """Demonstrate msgspec.convert function"""
    print("\n3. msgspec.convert Function")
    print("-" * 60)

    # Dict to Struct (native types need no hooks)
    user_dict = {
        "id": 2,
        "name": "Bob",
        "role": "user",
        "created_at": "2024-01-10T08:00:00",
        "last_login": "2024-01-15",
    }

    print(f"Original dict: {user_dict}")

    # datetime, date, Enum natively supported, no dec_hook needed
    converted_user = msgspec.convert(user_dict, type=User)
    print(f"Converted result: {converted_user}")
    print(f"Type verification: {type(converted_user).__name__}, role={type(converted_user.role).__name__}")

    # Struct to dict (Path needs enc_hook)
    project_dict = {
        "name": "TestProject",
        "path": "/home/user/test",
        "created": "2024-01-01T00:00:00",
        "deadline": "2024-12-31",
    }

    # Path needs dec_hook
    converted_project = msgspec.convert(project_dict, type=Project, dec_hook=path_dec_hook)
    print(f"Converted project: {converted_project}")
    print(f"Path type: {type(converted_project.path).__name__}")


def demo_orm_conversion() -> None:
    """Demonstrate ORM object conversion"""
    print("\n4. ORM Object Conversion")
    print("-" * 60)

    # Create ORM object
    orm_user = UserORM(id=3, name="Charlie", email="charlie@example.com", role="admin")

    print(f"ORM object: {orm_user}")

    # Convert to JSON
    encoder = msgspec.json.Encoder(enc_hook=orm_enc_hook)
    encoded_orm = encoder.encode(orm_user)
    print(f"Encoded result: {encoded_orm.decode()}")

    # ORM to Struct
    class SimpleUser(msgspec.Struct):
        id: int
        name: str
        email: str
        role: str

    converted = msgspec.convert(orm_user, type=SimpleUser, from_attributes=True)
    print(f"Converted to Struct: {converted}")


def main() -> None:
    """Run all examples"""
    print("=" * 60)
    print("msgspec Custom Conversion Examples")
    print("=" * 60)

    demo_native_support()
    demo_path_handling()
    demo_msgspec_convert()
    demo_orm_conversion()

    print("\n" + "=" * 60)
    print("Examples completed!")
    print("=" * 60)
    print("\nImportant notes:")
    print("- datetime, date, Enum, etc. are natively supported by msgspec, no hooks needed")
    print("- Path type needs enc_hook and dec_hook for conversion")
    print("- For natively supported types, enc_hook is not called; msgspec uses built-in serialization")
    print("- Third-party classes like ORM objects need custom hooks")


if __name__ == "__main__":
    main()
