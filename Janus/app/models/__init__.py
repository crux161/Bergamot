# Import all models so Base.metadata picks them up
from app.models.channel import Channel  # noqa: F401
from app.models.server import Server  # noqa: F401
from app.models.server_member import ServerMember  # noqa: F401
from app.models.user import User  # noqa: F401
