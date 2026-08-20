"""msgspec Tagged Unions Example

Demonstrates how to use tagged unions to handle multiple possible data structures:
- API responses (success/failure)
- Event systems
- Polymorphic data structures
"""

from typing import Annotated, ClassVar, Literal
import msgspec


# ========== Example 1: API Response Handling ==========
class SuccessResponse(msgspec.Struct, tag="success"):
    """Success response"""

    type: ClassVar[Literal["success"]] = "success"
    data: Annotated[dict, msgspec.Meta(description="Response data")]
    message: Annotated[str, msgspec.Meta(description="Success message")] = "Operation successful"


class ErrorResponse(msgspec.Struct, tag="error"):
    """Error response"""

    type: ClassVar[Literal["error"]] = "error"
    message: Annotated[str, msgspec.Meta(description="Error message")]
    code: Annotated[int, msgspec.Meta(description="Error code")]
    details: dict | None = None


# Define union type
type APIResponse = SuccessResponse | ErrorResponse


# ========== Example 2: Event System ==========
class UserLoginEvent(msgspec.Struct, tag="user.login"):
    """User login event"""

    event_type: ClassVar[Literal["user.login"]] = "user.login"
    user_id: Annotated[int, msgspec.Meta(description="User ID")]
    timestamp: Annotated[float, msgspec.Meta(description="Timestamp")]
    ip_address: Annotated[str, msgspec.Meta(description="IP address")]


class UserLogoutEvent(msgspec.Struct, tag="user.logout"):
    """User logout event"""

    event_type: ClassVar[Literal["user.logout"]] = "user.logout"
    user_id: Annotated[int, msgspec.Meta(description="User ID")]
    timestamp: Annotated[float, msgspec.Meta(description="Timestamp")]
    session_duration: Annotated[int, msgspec.Meta(description="Session duration (seconds)")]


class OrderCreatedEvent(msgspec.Struct, tag="order.created"):
    """Order created event"""

    event_type: ClassVar[Literal["order.created"]] = "order.created"
    order_id: Annotated[str, msgspec.Meta(description="Order ID")]
    user_id: Annotated[int, msgspec.Meta(description="User ID")]
    amount: Annotated[float, msgspec.Meta(description="Order amount", gt=0)]
    timestamp: Annotated[float, msgspec.Meta(description="Timestamp")]


# Define event union type
type Event = UserLoginEvent | UserLogoutEvent | OrderCreatedEvent


# ========== Example 3: Geometric Shapes ==========
class Circle(msgspec.Struct, tag="circle"):
    """Circle shape"""

    shape_type: ClassVar[Literal["circle"]] = "circle"
    center_x: Annotated[float, msgspec.Meta(description="Center X coordinate")]
    center_y: Annotated[float, msgspec.Meta(description="Center Y coordinate")]
    radius: Annotated[float, msgspec.Meta(description="Radius", gt=0)]


class Rectangle(msgspec.Struct, tag="rectangle"):
    """Rectangle shape"""

    shape_type: ClassVar[Literal["rectangle"]] = "rectangle"
    x: Annotated[float, msgspec.Meta(description="Top-left X coordinate")]
    y: Annotated[float, msgspec.Meta(description="Top-left Y coordinate")]
    width: Annotated[float, msgspec.Meta(description="Width", gt=0)]
    height: Annotated[float, msgspec.Meta(description="Height", gt=0)]


class Triangle(msgspec.Struct, tag="triangle"):
    """Triangle shape"""

    shape_type: ClassVar[Literal["triangle"]] = "triangle"
    x1: float
    y1: float
    x2: float
    y2: float
    x3: float
    y3: float


# Define shape union type
type Shape = Circle | Rectangle | Triangle


# ========== Utility Functions ==========
def handle_api_response(response: APIResponse) -> None:
    """Handle API response"""
    match response:
        case SuccessResponse():
            print(f"[OK] Success: {response.message}")
            print(f"  Data: {response.data}")
        case ErrorResponse():
            print(f"[ERROR] Error [{response.code}]: {response.message}")
            if response.details:
                print(f"  Details: {response.details}")


def handle_event(event: Event) -> None:
    """Handle event"""
    match event:
        case UserLoginEvent():
            print(f"User {event.user_id} logged in from {event.ip_address}")
        case UserLogoutEvent():
            print(f"User {event.user_id} logged out (session duration: {event.session_duration}s)")
        case OrderCreatedEvent():
            print(f"User {event.user_id} created order {event.order_id}, amount: ${event.amount:.2f}")


def calculate_area(shape: Shape) -> float:
    """Calculate shape area"""
    import math

    match shape:
        case Circle():
            return math.pi * shape.radius**2
        case Rectangle():
            return shape.width * shape.height
        case Triangle():
            # Using Heron's formula
            a = math.sqrt((shape.x2 - shape.x1) ** 2 + (shape.y2 - shape.y1) ** 2)
            b = math.sqrt((shape.x3 - shape.x2) ** 2 + (shape.y3 - shape.y2) ** 2)
            c = math.sqrt((shape.x1 - shape.x3) ** 2 + (shape.y1 - shape.y3) ** 2)
            s = (a + b + c) / 2
            return math.sqrt(s * (s - a) * (s - b) * (s - c))


def main() -> None:
    print("=" * 60)
    print("msgspec Tagged Unions Example")
    print("=" * 60)

    # ========== 1. API Response Handling ==========
    print("\n1. API Response Handling")
    print("-" * 60)

    # Success response
    success_json = '{"type":"success","data":{"id":123,"name":"test"},"message":"Data retrieved successfully"}'
    success_response = msgspec.json.decode(success_json, type=APIResponse)
    handle_api_response(success_response)

    print()

    # Error response
    error_json = '{"type":"error","message":"User not found","code":404,"details":{"user_id":999}}'
    error_response = msgspec.json.decode(error_json, type=APIResponse)
    handle_api_response(error_response)

    # Serialization
    print("\nSerialize response:")
    new_response = SuccessResponse(data={"result": "ok"})
    encoded = msgspec.json.encode(new_response)
    print(f"  {encoded.decode()}")

    # ========== 2. Event System ==========
    print("\n2. Event System")
    print("-" * 60)

    events_json = [
        b'{"type":"user.login","user_id":1001,"timestamp":1234567890.0,"ip_address":"192.168.1.100"}',
        b'{"type":"order.created","order_id":"ORD-001","user_id":1001,"amount":299.99,"timestamp":1234567900.0}',
        b'{"type":"user.logout","user_id":1001,"timestamp":1234568000.0,"session_duration":110}',
    ]

    print("Processing event stream:")
    for event_data in events_json:
        event = msgspec.json.decode(event_data, type=Event)
        print("  ", end="")
        handle_event(event)

    # ========== 3. Geometric Shapes ==========
    print("\n3. Geometric Shape Calculation")
    print("-" * 60)

    shapes: list[Shape] = [
        Circle(center_x=0, center_y=0, radius=5),
        Rectangle(x=0, y=0, width=10, height=5),
        Triangle(x1=0, y1=0, x2=4, y2=0, x3=2, y3=3),
    ]

    print("Calculate shape areas:")
    for shape in shapes:
        area = calculate_area(shape)
        shape_name = shape.__class__.__name__
        print(f"  {shape_name}: {area:.2f}")

    # Serialize shapes
    print("\nSerialize shapes:")
    for shape in shapes:
        encoded = msgspec.json.encode(shape)
        print(f"  {shape.__class__.__name__}: {encoded.decode()}")

    # Deserialize mixed shapes
    print("\nDeserialize mixed shapes:")
    mixed_shapes_json = b'[{"type":"circle","center_x":1,"center_y":2,"radius":3},{"type":"rectangle","x":0,"y":0,"width":4,"height":5}]'
    decoded_shapes = msgspec.json.decode(mixed_shapes_json, type=list[Shape])
    for shape in decoded_shapes:
        print(f"  Parsed {shape.__class__.__name__}: area = {calculate_area(shape):.2f}")

    # ========== 4. Type Safety Demonstration ==========
    print("\n4. Type Safety Validation")
    print("-" * 60)

    # Data missing tag will fail to decode
    print("Try to decode invalid response:")
    try:
        invalid_json = '{"message":"No type field","code":500}'
        msgspec.json.decode(invalid_json, type=APIResponse)
    except msgspec.ValidationError as e:
        print(f"  [X] Validation failed: {e}")

    # Incorrect tag value
    print("\nTry to decode unknown event type:")
    try:
        unknown_event = b'{"type":"user.unknown","user_id":123,"timestamp":123.0}'
        msgspec.json.decode(unknown_event, type=Event)
    except msgspec.ValidationError as e:
        print(f"  [X] Validation failed: {e}")

    # Field type error
    print("\nTry to decode data with wrong field type:")
    try:
        invalid_circle = b'{"shape_type":"circle","center_x":"not a number","center_y":0,"radius":5}'
        msgspec.json.decode(invalid_circle, type=Shape)
    except msgspec.ValidationError as e:
        print(f"  [X] Validation failed: {e}")

    print("\n" + "=" * 60)
    print("Examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
