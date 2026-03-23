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
    INSTANCE_NAME: str = "Bergamot"
    INSTANCE_TAGLINE: str = "Polyglot communities, chat, and calls across the Bergamot ecosystem."

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

    # Public runtime endpoints
    PUBLIC_BASE_URL: str | None = None
    HERMES_PUBLIC_URL: str | None = None
    HERMES_INTERNAL_URL: str | None = None
    HERMES_INTERNAL_PUBLISH_URL: str | None = None
    HERMES_INTERNAL_SECRET: str = "bergamot-hermes-internal-dev"
    MEILISEARCH_ENABLED: bool = False
    MEILISEARCH_URL: str | None = None
    MEILISEARCH_API_KEY: str | None = None
    MEILISEARCH_INDEX: str = "messages"
    LIVEKIT_PUBLIC_URL: str | None = None
    MEDIA_PUBLIC_URL: str | None = None
    ADMIN_PUBLIC_URL: str | None = None
    ADMIN_USERNAMES: str | None = None
    ADMIN_EMAILS: str | None = None
    ADMIN_USER_IDS: str | None = None
    WEBAUTHN_RP_ID: str | None = None
    WEBAUTHN_RP_NAME: str | None = None
    WEBAUTHN_ALLOWED_ORIGINS: str | None = None
    WEB_APP_URL: str = "http://localhost:3000"
    EMAIL_FROM: str = "noreply@bergamot.local"
    EMAIL_OUTBOX_DIR: str = "mail-outbox"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 465
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_USE_TLS: bool = False
    SMTP_USE_STARTTLS: bool = False
    AUTH_REQUIRE_EMAIL_VERIFICATION: bool = False
    AUTH_AUTHORIZE_NEW_IPS: bool = False
    AUTH_FLOW_EXPIRE_MINUTES: int = 60
    AUTH_LOGIN_RATE_LIMIT: int = 10
    AUTH_REGISTER_RATE_LIMIT: int = 5
    AUTH_RESET_RATE_LIMIT: int = 5
    AUTH_VERIFY_RATE_LIMIT: int = 5
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 300
    AUTH_LOGIN_FAILURE_LIMIT: int = 5
    AUTH_LOGIN_FAILURE_WINDOW_SECONDS: int = 900
    AUTH_LOGIN_LOCKOUT_SECONDS: int = 900

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
