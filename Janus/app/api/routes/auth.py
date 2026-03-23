"""Authentication routes: registration, login, recovery, and auth entry flows."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.mailer import deliver_email
from app.core.rate_limit import clear_failures, enforce_lockout, enforce_rate_limit, record_failure
from app.core.realtime_bridge import emit_relationship_presence_updated
from app.core.security import create_access_token, generate_secure_token, hash_password, verify_password
from app.core.totp import verify_totp
from app.models.auth_flow_ticket import AuthFlowTicket
from app.models.auth_session import AuthSession
from app.models.external_connection import ExternalConnection
from app.models.gift_code import GiftCode
from app.models.server import Server
from app.models.server_invite import ServerInvite
from app.models.server_member import ServerMember
from app.models.trusted_ip import TrustedIP
from app.models.user import User
from app.schemas.auth_flow import (
    AuthEntryPreviewRead,
    AuthorizeIPRead,
    AuthorizeIPRequest,
    PendingAccountStatusRead,
    SsoCallbackRequest,
)
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    Token,
    UserCreate,
    UserRead,
    UserUpdate,
    VerifyEmailRequest,
)
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])
FLOW_PASSWORD_RESET = "password_reset"
FLOW_EMAIL_VERIFICATION = "email_verification"
FLOW_AUTHORIZE_IP = "authorize_ip"
FLOW_INVITE_AUTH = "invite_auth"
FLOW_GIFT_AUTH = "gift_auth"
FLOW_THEME_ENTRY = "theme_entry"
ENTRY_FLOW_TYPES = {
    "invite": FLOW_INVITE_AUTH,
    "gift": FLOW_GIFT_AUTH,
    "theme": FLOW_THEME_ENTRY,
}


def _theme_entry_copy(theme: str | None) -> tuple[str, str]:
    normalized = (theme or "").strip().lower()
    if normalized == "amoled":
        return (
            "AMOLED Entry",
            "Start Bergamot with a deeper dark theme before you finish signing in.",
        )
    if normalized == "light":
        return (
            "Light Entry",
            "Continue with a brighter sign-in presentation tuned for daytime use.",
        )
    if normalized:
        return (
            "Themed Entry",
            f"This entry link carries the '{normalized}' theme context. Continue signing in to keep that visual context attached.",
        )
    return (
        "Themed Entry",
        "A custom Bergamot theme link brought you here. Continue signing in to finish setup.",
    )


def _describe_auth_entry(
    entry_kind: str,
    *,
    token: str | None,
    payload: dict | None,
    theme: str | None = None,
    valid: bool,
) -> tuple[str, str]:
    payload = payload or {}
    if entry_kind == "invite":
        guild_name = payload.get("server_name") or payload.get("guild_name") or "a Bergamot community"
        inviter = payload.get("inviter_username") or payload.get("inviter_display_name")
        if valid and inviter:
            return (
                f"Join {guild_name}",
                f"{inviter} invited you to join {guild_name}. Sign in to continue with this invite.",
            )
        if valid:
            return (
                f"Join {guild_name}",
                f"Sign in or create an account to continue into {guild_name}.",
            )
        if token:
            return (
                "Server Invite",
                "This invite is missing, expired, or has already been used.",
            )
        return (
            "Server Invite",
            "Sign in or create an account to continue with this invite.",
        )

    if entry_kind == "gift":
        gift_name = payload.get("gift_name") or payload.get("sku_name") or "this Bergamot gift"
        giver = payload.get("giver_username") or payload.get("giver_display_name")
        if valid and giver:
            return (
                "Claim Gift",
                f"{giver} sent you {gift_name}. Authenticate to attach it to your Bergamot account.",
            )
        if valid:
            return (
                "Claim Gift",
                f"Authenticate to attach {gift_name} to your Bergamot account.",
            )
        if token:
            return (
                "Claim Gift",
                "This gift link is missing, expired, or has already been claimed.",
            )
        return (
            "Claim Gift",
            "Authenticate to attach this gift to your Bergamot account.",
        )

    return _theme_entry_copy(theme or payload.get("theme"))


def _derive_client_name(request: Request) -> str:
    explicit = request.headers.get("x-bergamot-client")
    if explicit:
        return explicit[:160]

    user_agent = (request.headers.get("user-agent") or "").lower()
    if "electron" in user_agent:
        return "Proteus Desktop"
    if "mobile" in user_agent or "android" in user_agent or "iphone" in user_agent:
        return "Proteus Mobile Web"
    if user_agent:
        return "Proteus Web"
    return "Unknown client"


def _derive_ip_address(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


def _auth_base_url() -> str:
    return settings.WEB_APP_URL.rstrip("/")


def _build_hash_link(hash_path: str) -> str:
    return f"{_auth_base_url()}/#/{hash_path.lstrip('#/')}"


async def _create_flow_ticket(
    session: AsyncSession,
    *,
    flow_type: str,
    user: User | None = None,
    email: str | None = None,
    payload: dict | None = None,
    expires_in: timedelta | None = None,
) -> AuthFlowTicket:
    ticket = AuthFlowTicket(
        flow_type=flow_type,
        token=generate_secure_token(),
        user_id=user.id if user is not None else None,
        email=email or (user.email if user is not None else None),
        payload=payload,
        expires_at=datetime.now(timezone.utc) + (expires_in or timedelta(minutes=settings.AUTH_FLOW_EXPIRE_MINUTES)),
    )
    session.add(ticket)
    await session.flush()
    return ticket


async def _send_verification_email(session: AsyncSession, user: User) -> None:
    ticket = await _create_flow_ticket(
        session,
        flow_type=FLOW_EMAIL_VERIFICATION,
        user=user,
        payload={"email": user.email},
        expires_in=timedelta(hours=24),
    )
    link = _build_hash_link(f"verify?token={ticket.token}")
    await session.commit()
    await deliver_email(
        user.email,
        "Verify your Bergamot email address",
        text_body=(
            f"Hi {user.display_name or user.username},\n\n"
            f"Use this link to verify your email address:\n{link}\n\n"
            "If you did not create this account, you can ignore this message."
        ),
    )


async def _send_password_reset_email(session: AsyncSession, user: User) -> None:
    ticket = await _create_flow_ticket(
        session,
        flow_type=FLOW_PASSWORD_RESET,
        user=user,
        payload={"email": user.email},
        expires_in=timedelta(hours=1),
    )
    link = _build_hash_link(f"reset?token={ticket.token}")
    await session.commit()
    await deliver_email(
        user.email,
        "Reset your Bergamot password",
        text_body=(
            f"Hi {user.display_name or user.username},\n\n"
            f"Use this link to reset your password:\n{link}\n\n"
            "If you did not request a reset, you can ignore this message."
        ),
    )


async def _send_authorize_ip_email(
    session: AsyncSession,
    *,
    user: User,
    ip_address: str | None,
    client_name: str,
) -> None:
    ticket = await _create_flow_ticket(
        session,
        flow_type=FLOW_AUTHORIZE_IP,
        user=user,
        payload={"ip_address": ip_address, "client_name": client_name},
        expires_in=timedelta(minutes=30),
    )
    link = _build_hash_link(f"authorize-ip?token={ticket.token}")
    await session.commit()
    await deliver_email(
        user.email,
        "Authorize a new sign-in location for Bergamot",
        text_body=(
            f"Hi {user.display_name or user.username},\n\n"
            f"We noticed a sign-in attempt from {ip_address or 'an unknown IP'} using {client_name}.\n"
            f"If this was you, approve the sign-in here:\n{link}\n\n"
            "If this was not you, you can ignore this message."
        ),
    )


async def _get_valid_flow_ticket(
    session: AsyncSession,
    *,
    token: str,
    flow_type: str,
) -> AuthFlowTicket:
    result = await session.execute(
        select(AuthFlowTicket).where(
            AuthFlowTicket.token == token,
            AuthFlowTicket.flow_type == flow_type,
        )
    )
    ticket = result.scalar_one_or_none()
    if ticket is None or ticket.consumed_at is not None or ticket.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    return ticket


async def _find_entry_ticket(
    session: AsyncSession,
    *,
    token: str | None,
    flow_type: str,
) -> AuthFlowTicket | None:
    if not token:
        return None

    result = await session.execute(
        select(AuthFlowTicket).where(
            AuthFlowTicket.token == token,
            AuthFlowTicket.flow_type == flow_type,
        )
    )
    ticket = result.scalar_one_or_none()
    if ticket is None:
        return None
    if ticket.consumed_at is not None or ticket.expires_at < datetime.now(timezone.utc):
        return None
    return ticket


async def _trust_ip(
    session: AsyncSession,
    *,
    user: User,
    ip_address: str | None,
    client_name: str,
) -> None:
    if not ip_address:
        return

    result = await session.execute(
        select(TrustedIP).where(
            TrustedIP.user_id == user.id,
            TrustedIP.ip_address == ip_address,
        )
    )
    trusted = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if trusted is None:
        trusted = TrustedIP(
            user_id=user.id,
            ip_address=ip_address,
            client_name=client_name,
            authorized_at=now,
            last_seen_at=now,
        )
        session.add(trusted)
    else:
        trusted.client_name = client_name
        trusted.last_seen_at = now
    await session.flush()


async def _ip_is_trusted(
    session: AsyncSession,
    *,
    user: User,
    ip_address: str | None,
) -> bool:
    if not ip_address:
        return True
    result = await session.execute(
        select(TrustedIP).where(
            TrustedIP.user_id == user.id,
            TrustedIP.ip_address == ip_address,
        )
    )
    return result.scalar_one_or_none() is not None


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    body: UserCreate,
    session: AsyncSession = Depends(get_session),
):
    """Register a new user account.

    Raises:
        HTTPException: 409 if the username or email is already taken.
    """
    ip_address = _derive_ip_address(request) or "unknown"
    enforce_rate_limit(
        f"register:{ip_address}",
        limit=settings.AUTH_REGISTER_RATE_LIMIT,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        detail="Too many registration attempts. Please try again later.",
    )

    # Check for existing username or email
    existing = await session.execute(
        select(User).where((User.username == body.username) | (User.email == body.email))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email already registered",
        )

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        display_name=body.display_name,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    await _send_verification_email(session, user)
    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    otp_code: str | None = Form(default=None),
    session: AsyncSession = Depends(get_session),
):
    """Authenticate a user and return a JWT access token.

    Raises:
        HTTPException: 401 if the credentials are invalid.
    """
    ip_address = _derive_ip_address(request) or "unknown"
    lockout_key = f"login-lockout:{ip_address}:{username.lower()}"
    enforce_rate_limit(
        f"login:{ip_address}:{username.lower()}",
        limit=settings.AUTH_LOGIN_RATE_LIMIT,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        detail="Too many login attempts. Please wait before trying again.",
    )
    enforce_lockout(
        lockout_key,
        detail="Too many failed sign-in attempts. Please wait before trying again.",
    )

    result = await session.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(password, user.password_hash):
        record_failure(
            lockout_key,
            failure_limit=settings.AUTH_LOGIN_FAILURE_LIMIT,
            failure_window_seconds=settings.AUTH_LOGIN_FAILURE_WINDOW_SECONDS,
            lockout_seconds=settings.AUTH_LOGIN_LOCKOUT_SECONDS,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.suspended_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=user.suspension_reason or "Account suspended",
        )
    if settings.AUTH_REQUIRE_EMAIL_VERIFICATION and not user.email_verified:
        await _send_verification_email(session, user)
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "detail": "Verify your email address before logging in",
                "error_code": "pending_account",
                "email": user.email,
            },
        )
    if user.mfa_enabled and user.mfa_secret:
        if not otp_code:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "MFA code required", "error_code": "mfa_required"},
            )
        if not verify_totp(user.mfa_secret, otp_code):
            record_failure(
                lockout_key,
                failure_limit=settings.AUTH_LOGIN_FAILURE_LIMIT,
                failure_window_seconds=settings.AUTH_LOGIN_FAILURE_WINDOW_SECONDS,
                lockout_seconds=settings.AUTH_LOGIN_LOCKOUT_SECONDS,
            )
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Invalid MFA code", "error_code": "invalid_mfa_code"},
            )
    client_name = _derive_client_name(request)
    if settings.AUTH_AUTHORIZE_NEW_IPS and not await _ip_is_trusted(session, user=user, ip_address=ip_address):
        await _send_authorize_ip_email(session, user=user, ip_address=ip_address, client_name=client_name)
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "detail": "Authorize this sign-in from your email before continuing",
                "error_code": "authorize_ip_required",
            },
        )
    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = datetime.now(timezone.utc) + expires_delta
    auth_session = AuthSession(
        user_id=user.id,
        client_name=client_name,
        user_agent=(request.headers.get("user-agent") or None),
        ip_address=ip_address,
        expires_at=expires_at,
        last_seen_at=datetime.now(timezone.utc),
    )
    session.add(auth_session)
    await _trust_ip(session, user=user, ip_address=ip_address, client_name=client_name)
    await session.commit()
    await session.refresh(auth_session)

    token = create_access_token(
        subject=str(user.id),
        session_id=str(auth_session.id),
        expires_delta=expires_delta,
    )
    clear_failures(lockout_key)
    return Token(access_token=token, session_id=auth_session.id, expires_at=expires_at)


@router.get("/me", response_model=UserRead)
async def me(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Return the currently authenticated user's profile."""
    current_session_id = getattr(request.state, "current_session_id", None)
    if current_session_id is not None:
        result = await session.execute(
            select(AuthSession).where(
                AuthSession.id == current_session_id,
                AuthSession.user_id == current_user.id,
            )
        )
        auth_session = result.scalar_one_or_none()
        if auth_session is not None:
            auth_session.last_seen_at = datetime.now(timezone.utc)
            await session.commit()
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_me(
    body: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Update the currently authenticated user's profile.

    Only non-None fields in the request body are applied.
    """
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)
    if "status" in update_data or "status_message" in update_data or "display_name" in update_data or "avatar_url" in update_data:
        await emit_relationship_presence_updated(session, user=current_user)
    return current_user


@router.post("/forgot-password")
async def forgot_password(
    request: Request,
    body: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_session),
):
    """Generate a password reset token for the given email.

    Always returns 200 to avoid leaking whether the email exists.
    """
    ip_address = _derive_ip_address(request) or "unknown"
    enforce_rate_limit(
        f"forgot-password:{ip_address}:{body.email.lower()}",
        limit=settings.AUTH_RESET_RATE_LIMIT,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        detail="Too many password reset attempts. Please try again later.",
    )

    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if user is None:
        return {"ok": True}

    await _send_password_reset_email(session, user)
    return {"ok": True}


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
):
    """Reset a user's password using a valid reset token."""
    ticket = await _get_valid_flow_ticket(session, token=body.token, flow_type=FLOW_PASSWORD_RESET)
    if ticket.user_id is None:
        raise HTTPException(status_code=400, detail="Invalid reset ticket")
    result = await session.execute(select(User).where(User.id == ticket.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=400, detail="User not found")
    user.password_hash = hash_password(body.new_password)
    ticket.consumed_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()

    return {"ok": True}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Change the authenticated user's password after verifying the current one."""
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(body.new_password)
    session.add(current_user)
    await session.commit()
    return {"ok": True}


@router.post("/verify-email")
async def verify_email(
    request: Request,
    body: VerifyEmailRequest,
    session: AsyncSession = Depends(get_session),
):
    """Mark a user's email as verified using the verification token."""
    ip_address = _derive_ip_address(request) or "unknown"
    enforce_rate_limit(
        f"verify-email:{ip_address}",
        limit=settings.AUTH_VERIFY_RATE_LIMIT,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        detail="Too many verification attempts. Please try again later.",
    )
    ticket = await _get_valid_flow_ticket(session, token=body.token, flow_type=FLOW_EMAIL_VERIFICATION)
    if ticket.user_id is None:
        raise HTTPException(status_code=400, detail="Invalid verification ticket")
    result = await session.execute(select(User).where(User.id == ticket.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=400, detail="User not found")
    user.email_verified = True
    ticket.consumed_at = datetime.now(timezone.utc)
    session.add(user)
    await session.commit()

    return {"ok": True}


@router.post("/resend-verification")
async def resend_verification(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Generate a new email verification token for the current user."""
    if current_user.email_verified:
        return {"ok": True, "already_verified": True}

    await _send_verification_email(session, current_user)
    return {"ok": True}


@router.post("/resend-verification-email")
async def resend_verification_email(
    request: Request,
    body: ResendVerificationRequest,
    session: AsyncSession = Depends(get_session),
):
    ip_address = _derive_ip_address(request) or "unknown"
    enforce_rate_limit(
        f"resend-verification:{ip_address}:{body.email.lower()}",
        limit=settings.AUTH_VERIFY_RATE_LIMIT,
        window_seconds=settings.AUTH_RATE_LIMIT_WINDOW_SECONDS,
        detail="Too many verification attempts. Please try again later.",
    )

    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if user is None or user.email_verified:
        return {"ok": True}

    await _send_verification_email(session, user)
    return {"ok": True}


@router.get("/entry/{entry_kind}", response_model=AuthEntryPreviewRead)
async def preview_auth_entry(
    entry_kind: str,
    token: str | None = Query(default=None),
    theme: str | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
):
    flow_type = ENTRY_FLOW_TYPES.get(entry_kind.lower())
    if flow_type is None:
        raise HTTPException(status_code=404, detail="Unknown auth entry flow")

    payload: dict | None = None
    expires_at = None
    valid = False
    resolved_theme = theme

    if entry_kind.lower() == "invite" and token:
        invite_result = await session.execute(select(ServerInvite).where(ServerInvite.code == token))
        invite = invite_result.scalar_one_or_none()
        if invite is not None:
            server_result = await session.execute(select(Server).where(Server.id == invite.server_id))
            server = server_result.scalar_one_or_none()
            inviter_result = await session.execute(select(User).where(User.id == invite.inviter_user_id))
            inviter = inviter_result.scalar_one_or_none()
            member_count = int((await session.scalar(
                select(func.count(ServerMember.id)).where(ServerMember.server_id == invite.server_id)
            )) or 0)
            payload = {
                "server_id": str(invite.server_id),
                "server_name": server.name if server is not None else None,
                "member_count": member_count,
                "inviter_username": inviter.username if inviter is not None else None,
                "inviter_display_name": inviter.display_name if inviter is not None else None,
                "label": invite.label,
                "notes": invite.notes,
                "code": invite.code,
                "max_uses": invite.max_uses,
                "use_count": invite.use_count,
            }
            expires_at = invite.expires_at
            valid = (
                server is not None
                and invite.revoked_at is None
                and (invite.expires_at is None or invite.expires_at > datetime.now(timezone.utc))
                and (invite.max_uses is None or invite.use_count < invite.max_uses)
            )
    elif entry_kind.lower() == "gift" and token:
        gift_result = await session.execute(select(GiftCode).where(GiftCode.code == token))
        gift = gift_result.scalar_one_or_none()
        if gift is not None:
            creator_result = await session.execute(select(User).where(User.id == gift.created_by_user_id))
            creator = creator_result.scalar_one_or_none()
            payload = {
                "gift_name": gift.title,
                "gift_description": gift.description,
                "giver_username": creator.username if creator is not None else None,
                "giver_display_name": creator.display_name if creator is not None else None,
                "theme": gift.theme,
                "claim_message": gift.claim_message,
                "claimed": gift.claimed_at is not None,
            }
            resolved_theme = theme or gift.theme
            expires_at = gift.expires_at
            valid = (
                gift.disabled_at is None
                and gift.claimed_at is None
                and (gift.expires_at is None or gift.expires_at > datetime.now(timezone.utc))
            )
    else:
        ticket = await _find_entry_ticket(session, token=token, flow_type=flow_type)
        payload = ticket.payload if ticket is not None else None
        resolved_theme = theme or (payload or {}).get("theme")
        expires_at = ticket.expires_at if ticket is not None else None
        valid = ticket is not None or (entry_kind.lower() == "theme" and bool(resolved_theme))

    title, description = _describe_auth_entry(
        entry_kind.lower(),
        token=token,
        payload=payload,
        theme=resolved_theme,
        valid=valid,
    )

    return AuthEntryPreviewRead(
        flow=entry_kind.lower(),
        valid=valid,
        title=title,
        description=description,
        token=token,
        theme=resolved_theme,
        expires_at=expires_at,
        payload=payload,
    )


@router.get("/pending-account/status", response_model=PendingAccountStatusRead)
async def pending_account_status(
    current_user: User = Depends(get_current_user),
):
    return PendingAccountStatusRead(
        email=current_user.email,
        email_verified=current_user.email_verified,
        verification_required=settings.AUTH_REQUIRE_EMAIL_VERIFICATION,
    )


@router.post("/authorize-ip", response_model=AuthorizeIPRead)
async def authorize_ip(
    body: AuthorizeIPRequest,
    session: AsyncSession = Depends(get_session),
):
    ticket = await _get_valid_flow_ticket(session, token=body.token, flow_type=FLOW_AUTHORIZE_IP)
    if ticket.user_id is None:
        raise HTTPException(status_code=400, detail="Invalid authorize-IP ticket")
    result = await session.execute(select(User).where(User.id == ticket.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=400, detail="User not found")

    payload = ticket.payload or {}
    ip_address = payload.get("ip_address")
    client_name = payload.get("client_name") or "Authorized client"
    await _trust_ip(session, user=user, ip_address=ip_address, client_name=client_name)
    ticket.consumed_at = datetime.now(timezone.utc)
    await session.commit()
    return AuthorizeIPRead(ok=True, ip_address=ip_address)


@router.post("/sso/callback", response_model=Token)
async def complete_sso_callback(
    body: SsoCallbackRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ExternalConnection).where(
            ExternalConnection.provider == body.provider.lower(),
            (
                (ExternalConnection.provider_account_id == body.code)
                | (ExternalConnection.username == body.code)
            ),
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        raise HTTPException(status_code=404, detail="No linked account matches this SSO callback")

    user_result = await session.execute(select(User).where(User.id == connection.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.suspended_at is not None:
        raise HTTPException(status_code=403, detail=user.suspension_reason or "Account suspended")

    connection.last_used_at = datetime.now(timezone.utc)
    client_name = f"{body.provider.title()} SSO"
    ip_address = _derive_ip_address(request) or "unknown"
    await _trust_ip(session, user=user, ip_address=ip_address, client_name=client_name)

    expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    expires_at = datetime.now(timezone.utc) + expires_delta
    auth_session = AuthSession(
        user_id=user.id,
        client_name=client_name,
        user_agent=(request.headers.get("user-agent") or None),
        ip_address=ip_address,
        expires_at=expires_at,
        last_seen_at=datetime.now(timezone.utc),
    )
    session.add(auth_session)
    await session.commit()
    await session.refresh(auth_session)

    token = create_access_token(
        subject=str(user.id),
        session_id=str(auth_session.id),
        expires_delta=expires_delta,
    )
    return Token(access_token=token, session_id=auth_session.id, expires_at=expires_at)
