# Import all models so Base.metadata picks them up
from app.models.attachment import Attachment  # noqa: F401
from app.models.channel import Channel  # noqa: F401
from app.models.member_role import MemberRole  # noqa: F401
from app.models.message import Message  # noqa: F401
from app.models.role import Role  # noqa: F401
from app.models.server import Server  # noqa: F401
from app.models.server_member import ServerMember  # noqa: F401
from app.models.user import User  # noqa: F401
