"""msgspec Basic Usage Examples

Demonstrates msgspec's core functionality:
- Struct definition
- Default value handling
- Serialization and deserialization
- Type validation
"""

from typing import Annotated
import msgspec


# 1. Basic Struct definition
class User(msgspec.Struct):
    """User information struct"""

    name: Annotated[str, msgspec.Meta(description="Username")]
    age: Annotated[int, msgspec.Meta(description="Age", ge=0, le=150)]
    email: Annotated[str, msgspec.Meta(description="Email address")]


# 2. Struct with defaults
class UserProfile(msgspec.Struct):
    """User profile"""

    name: str
    age: int
    # Immutable type defaults
    role: str = "user"
    active: bool = True
    # Empty built-in collections are safe shorthand for fresh per-instance defaults
    tags: list[str] = []
    metadata: dict[str, str] = {}


# 3. Frozen struct
class Point(msgspec.Struct, frozen=True):
    """2D point (immutable)"""

    x: Annotated[float, msgspec.Meta(description="X coordinate")]
    y: Annotated[float, msgspec.Meta(description="Y coordinate")]


# 4. Keyword-only struct
class Config(msgspec.Struct, kw_only=True):
    """Configuration object (keyword-only arguments)"""

    api_key: str
    timeout: int = 30
    max_retries: int = 3


def main() -> None:
    print("=" * 60)
    print("msgspec Basic Usage Examples")
    print("=" * 60)

    # ========== 1. Create and use basic Struct ==========
    print("\n1. Basic Struct Usage")
    print("-" * 60)

    user = User(name="Alice", age=25, email="alice@example.com")
    print(f"Created user: {user}")

    # JSON serialization
    encoded = msgspec.json.encode(user)
    print(f"JSON encoded: {encoded.decode()}")

    # JSON deserialization
    decoded = msgspec.json.decode(encoded, type=User)
    print(f"JSON decoded: {decoded}")
    print(f"Type validation: {decoded.name=}, {decoded.age=}, {decoded.email=}")

    # ========== 2. Struct with defaults ==========
    print("\n2. Struct with Defaults")
    print("-" * 60)

    # Using defaults
    profile1 = UserProfile(name="Bob", age=30)
    print(f"Using defaults: {profile1}")
    print(f"  role={profile1.role}, active={profile1.active}")
    print(f"  tags={profile1.tags}, metadata={profile1.metadata}")

    # Overriding defaults
    profile2 = UserProfile(
        name="Carol",
        age=28,
        role="admin",
        active=False,
        tags=["vip", "developer"],
        metadata={"department": "engineering"},
    )
    print(f"Overriding defaults: {profile2}")

    # Verify mutable defaults are independent
    profile1.tags.append("test")
    profile1.metadata["key"] = "value"
    print("\nAfter modifying profile1:")
    print(f"  profile1.tags={profile1.tags}")
    print(f"  profile2.tags={profile2.tags}  <- not affected")

    # ========== 3. Frozen Struct ==========
    print("\n3. Frozen Struct")
    print("-" * 60)

    point = Point(x=1.0, y=2.0)
    print(f"Created point: {point}")

    # Use replace pattern to create new instances
    new_point = msgspec.structs.replace(point, x=3)
    print(f"Modified x coordinate: {new_point}")
    print(f"Original unchanged: {point}")

    # Attempting to modify directly will fail
    try:
        point.x = 5.0  # type: ignore
    except AttributeError as e:
        print(f"Direct modification failed: {e}")

    # ========== 4. Keyword-only Struct ==========
    print("\n4. Keyword-only Struct")
    print("-" * 60)

    # Must use keyword arguments
    config = Config(api_key="secret-key-123")
    print(f"Created config: {config}")

    # Attempting to use positional arguments will fail
    try:
        Config("secret-key-123")  # type: ignore
    except TypeError as e:
        print(f"Positional arguments failed: {e}")

    # ========== 5. Type Validation ==========
    print("\n5. Type Validation")
    print("-" * 60)

    # Valid types
    valid_user = msgspec.json.decode('{"name":"David","age":35,"email":"david@example.com"}', type=User)
    print(f"Valid data: {valid_user}")

    # Invalid type will raise exception
    try:
        invalid_data = '{"name":"Eve","age":"not a number","email":"eve@example.com"}'
        msgspec.json.decode(invalid_data, type=User)
    except msgspec.ValidationError as e:
        print(f"Type validation failed: {e}")

    # Violating constraints (age out of range)
    try:
        invalid_age = '{"name":"Frank","age":200,"email":"frank@example.com"}'
        msgspec.json.decode(invalid_age, type=User)
    except msgspec.ValidationError as e:
        print(f"Constraint validation failed: {e}")

    # ========== 6. Multi-protocol Support ==========
    print("\n6. Multi-protocol Support")
    print("-" * 60)

    user_data = User(name="Grace", age=40, email="grace@example.com")

    # JSON
    json_data = msgspec.json.encode(user_data)
    print(f"JSON: {json_data.decode()}")

    # MessagePack
    msgpack_data = msgspec.msgpack.encode(user_data)
    print(f"MessagePack: {msgpack_data!r}")

    # YAML (requires PyYAML)
    try:
        yaml_data = msgspec.yaml.encode(user_data)
        print(f"YAML:\n{yaml_data.decode()}")
    except ImportError:
        print("YAML: Requires PyYAML (uv add msgspec[yaml])")

    # TOML (requires tomli/tomli-w)
    try:
        toml_data = msgspec.toml.encode(user_data)
        print(f"TOML:\n{toml_data.decode()}")
    except ImportError:
        print("TOML: Requires tomli/tomli-w (uv add msgspec[toml])")

    print("\n" + "=" * 60)
    print("Examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
