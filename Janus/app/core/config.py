"""Application configuration loaded from environment variables.

Uses pydantic-settings to parse ``.env`` files and environment variables
into a typed :class:`Settings` object exposed as the module-level
``settings`` singleton.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration for the Janus service.

    Attributes:
        PROJECT_NAME: Display name used in OpenAPI docs.
        API_V1_PREFIX: URL prefix for all v1 API routes.
        POSTGRES_USER: PostgreSQL connection user.
        POSTGRES_PASSWORD: PostgreSQL connection password.
        POSTGRES_HOST: PostgreSQL server hostname.
        POSTGRES_PORT: PostgreSQL server port.
        POSTGRES_DB: PostgreSQL database name.
        SECRET_KEY: Secret used for JWT signing.
        ALGORITHM: JWT signing algorithm.
        ACCESS_TOKEN_EXPIRE_MINUTES: Token lifetime in minutes.
    """
    PROJECT_NAME: str = "Janus"
    API_V1_PREFIX: str = "/api/v1"

    # PostgreSQL
    POSTGRES_USER: str = "janus"
    POSTGRES_PASSWORD: str = "janus_secret"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "janus"

    @property
    def database_url(self) -> str:
        """Build the async PostgreSQL connection URL."""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # File uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 10

    # JWT
    SECRET_KEY: str = "CHANGE-ME-in-production-use-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
