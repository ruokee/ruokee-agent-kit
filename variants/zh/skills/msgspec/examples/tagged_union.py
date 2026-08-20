"""msgspec 标签联合（Tagged Unions）示例

演示如何使用标签联合来处理多种可能的数据结构：
- API 响应（成功/失败）
- 事件系统
- 多态数据结构
"""

from typing import Annotated, ClassVar, Literal
import msgspec


# ========== 示例 1: API 响应处理 ==========
class SuccessResponse(msgspec.Struct, tag="success"):
    """成功响应"""

    type: ClassVar[Literal["success"]] = "success"
    data: Annotated[dict, msgspec.Meta(description="响应数据")]
    message: Annotated[str, msgspec.Meta(description="成功消息")] = "操作成功"


class ErrorResponse(msgspec.Struct, tag="error"):
    """错误响应"""

    type: ClassVar[Literal["error"]] = "error"
    message: Annotated[str, msgspec.Meta(description="错误消息")]
    code: Annotated[int, msgspec.Meta(description="错误代码")]
    details: dict | None = None


# 定义联合类型
type APIResponse = SuccessResponse | ErrorResponse


# ========== 示例 2: 事件系统 ==========
class UserLoginEvent(msgspec.Struct, tag="user.login"):
    """用户登录事件"""

    event_type: ClassVar[Literal["user.login"]] = "user.login"
    user_id: Annotated[int, msgspec.Meta(description="用户 ID")]
    timestamp: Annotated[float, msgspec.Meta(description="时间戳")]
    ip_address: Annotated[str, msgspec.Meta(description="IP 地址")]


class UserLogoutEvent(msgspec.Struct, tag="user.logout"):
    """用户登出事件"""

    event_type: ClassVar[Literal["user.logout"]] = "user.logout"
    user_id: Annotated[int, msgspec.Meta(description="用户 ID")]
    timestamp: Annotated[float, msgspec.Meta(description="时间戳")]
    session_duration: Annotated[int, msgspec.Meta(description="会话时长（秒）")]


class OrderCreatedEvent(msgspec.Struct, tag="order.created"):
    """订单创建事件"""

    event_type: ClassVar[Literal["order.created"]] = "order.created"
    order_id: Annotated[str, msgspec.Meta(description="订单 ID")]
    user_id: Annotated[int, msgspec.Meta(description="用户 ID")]
    amount: Annotated[float, msgspec.Meta(description="订单金额", gt=0)]
    timestamp: Annotated[float, msgspec.Meta(description="时间戳")]


# 定义事件联合类型
type Event = UserLoginEvent | UserLogoutEvent | OrderCreatedEvent


# ========== 示例 3: 几何图形 ==========
class Circle(msgspec.Struct, tag="circle"):
    """圆形"""

    shape_type: ClassVar[Literal["circle"]] = "circle"
    center_x: Annotated[float, msgspec.Meta(description="圆心 X 坐标")]
    center_y: Annotated[float, msgspec.Meta(description="圆心 Y 坐标")]
    radius: Annotated[float, msgspec.Meta(description="半径", gt=0)]


class Rectangle(msgspec.Struct, tag="rectangle"):
    """矩形"""

    shape_type: ClassVar[Literal["rectangle"]] = "rectangle"
    x: Annotated[float, msgspec.Meta(description="左上角 X 坐标")]
    y: Annotated[float, msgspec.Meta(description="左上角 Y 坐标")]
    width: Annotated[float, msgspec.Meta(description="宽度", gt=0)]
    height: Annotated[float, msgspec.Meta(description="高度", gt=0)]


class Triangle(msgspec.Struct, tag="triangle"):
    """三角形"""

    shape_type: ClassVar[Literal["triangle"]] = "triangle"
    x1: float
    y1: float
    x2: float
    y2: float
    x3: float
    y3: float


# 定义图形联合类型
type Shape = Circle | Rectangle | Triangle


# ========== 工具函数 ==========
def handle_api_response(response: APIResponse) -> None:
    """处理 API 响应"""
    match response:
        case SuccessResponse():
            print(f"[OK] 成功: {response.message}")
            print(f"  数据: {response.data}")
        case ErrorResponse():
            print(f"[ERROR] 错误 [{response.code}]: {response.message}")
            if response.details:
                print(f"  详情: {response.details}")


def handle_event(event: Event) -> None:
    """处理事件"""
    match event:
        case UserLoginEvent():
            print(f"用户 {event.user_id} 从 {event.ip_address} 登录")
        case UserLogoutEvent():
            print(f"用户 {event.user_id} 登出（会话时长: {event.session_duration}秒）")
        case OrderCreatedEvent():
            print(f"用户 {event.user_id} 创建订单 {event.order_id}，金额: {event.amount:.2f} 元")


def calculate_area(shape: Shape) -> float:
    """计算图形面积"""
    import math

    match shape:
        case Circle():
            return math.pi * shape.radius**2
        case Rectangle():
            return shape.width * shape.height
        case Triangle():
            # 使用海伦公式
            a = math.sqrt((shape.x2 - shape.x1) ** 2 + (shape.y2 - shape.y1) ** 2)
            b = math.sqrt((shape.x3 - shape.x2) ** 2 + (shape.y3 - shape.y2) ** 2)
            c = math.sqrt((shape.x1 - shape.x3) ** 2 + (shape.y1 - shape.y3) ** 2)
            s = (a + b + c) / 2
            return math.sqrt(s * (s - a) * (s - b) * (s - c))


def main() -> None:
    print("=" * 60)
    print("msgspec 标签联合示例")
    print("=" * 60)

    # ========== 1. API 响应处理 ==========
    print("\n1. API 响应处理")
    print("-" * 60)

    # 成功响应
    success_json = '{"type":"success","data":{"id":123,"name":"测试"},"message":"数据获取成功"}'
    success_response = msgspec.json.decode(success_json, type=APIResponse)
    handle_api_response(success_response)

    print()

    # 错误响应
    error_json = '{"type":"error","message":"未找到用户","code":404,"details":{"user_id":999}}'
    error_response = msgspec.json.decode(error_json, type=APIResponse)
    handle_api_response(error_response)

    # 序列化
    print("\n序列化响应:")
    new_response = SuccessResponse(data={"result": "ok"})
    encoded = msgspec.json.encode(new_response)
    print(f"  {encoded.decode()}")

    # ========== 2. 事件系统 ==========
    print("\n2. 事件系统")
    print("-" * 60)

    events_json = [
        b'{"type":"user.login","user_id":1001,"timestamp":1234567890.0,"ip_address":"192.168.1.100"}',
        b'{"type":"order.created","order_id":"ORD-001","user_id":1001,"amount":299.99,"timestamp":1234567900.0}',
        b'{"type":"user.logout","user_id":1001,"timestamp":1234568000.0,"session_duration":110}',
    ]

    print("处理事件流:")
    for event_data in events_json:
        event = msgspec.json.decode(event_data, type=Event)
        print("  ", end="")
        handle_event(event)

    # ========== 3. 几何图形 ==========
    print("\n3. 几何图形计算")
    print("-" * 60)

    shapes: list[Shape] = [
        Circle(center_x=0, center_y=0, radius=5),
        Rectangle(x=0, y=0, width=10, height=5),
        Triangle(x1=0, y1=0, x2=4, y2=0, x3=2, y3=3),
    ]

    print("计算图形面积:")
    for shape in shapes:
        area = calculate_area(shape)
        shape_name = shape.__class__.__name__
        print(f"  {shape_name}: {area:.2f}")

    # 序列化图形
    print("\n序列化图形:")
    for shape in shapes:
        encoded = msgspec.json.encode(shape)
        print(f"  {shape.__class__.__name__}: {encoded.decode()}")

    # 反序列化混合图形
    print("\n反序列化混合图形:")
    mixed_shapes_json = b'[{"type":"circle","center_x":1,"center_y":2,"radius":3},{"type":"rectangle","x":0,"y":0,"width":4,"height":5}]'
    decoded_shapes = msgspec.json.decode(mixed_shapes_json, type=list[Shape])
    for shape in decoded_shapes:
        print(f"  解析到 {shape.__class__.__name__}: 面积 = {calculate_area(shape):.2f}")

    # ========== 4. 类型安全演示 ==========
    print("\n4. 类型安全验证")
    print("-" * 60)

    # 缺少 tag 的数据会解码失败
    print("尝试解码无效的响应:")
    try:
        invalid_json = '{"message":"没有 type 字段","code":500}'
        msgspec.json.decode(invalid_json, type=APIResponse)
    except msgspec.ValidationError as e:
        print(f"  [X] 验证失败: {e}")

    # 错误的 tag 值
    print("\n尝试解码未知的事件类型:")
    try:
        unknown_event = b'{"type":"user.unknown","user_id":123,"timestamp":123.0}'
        msgspec.json.decode(unknown_event, type=Event)
    except msgspec.ValidationError as e:
        print(f"  [X] 验证失败: {e}")

    # 字段类型错误
    print("\n尝试解码字段类型错误的数据:")
    try:
        invalid_circle = b'{"shape_type":"circle","center_x":"not a number","center_y":0,"radius":5}'
        msgspec.json.decode(invalid_circle, type=Shape)
    except msgspec.ValidationError as e:
        print(f"  [X] 验证失败: {e}")

    print("\n" + "=" * 60)
    print("示例运行完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
