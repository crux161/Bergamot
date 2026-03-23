"""OAuth2 application, consent, and authorization routes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Form, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.security import create_access_token, generate_secure_token, hash_password, verify_password
from app.models.oauth_application import OAuthApplication
from app.models.oauth_authorization_code import OAuthAuthorizationCode
from app.models.oauth_consent_grant import OAuthConsentGrant
from app.models.user import User
from app.schemas.oauth import (
    OAuthApplicationCreate,
    OAuthApplicationRead,
    OAuthApplicationUpdate,
    OAuthAuthorizationResult,
    OAuthAuthorizedAppRead,
    OAuthAuthorizeDecision,
    OAuthAuthorizePreviewRead,
    OAuthBotProvisionRead,
    OAuthClientSecretRead,
    OAuthTokenRead,
)

router = APIRouter(prefix="/oauth2", tags=["oauth2"])


def _split_scopes(value: str | list[str] | None, *, fallback: list[str] | None = None) -> list[str]:
    if isinstance(value, list):
        scopes = value
    elif isinstance(value, str):
        scopes = value.replace(",", " ").split()
    else:
        scopes = fallback or []
    return [scope for scope in dict.fromkeys(scope.strip() for scope in scopes if scope and scope.strip())]


def _application_read(application: OAuthApplication, *, client_secret: str | None = None) -> OAuthApplicationRead:
    return OAuthApplicationRead(
        id=application.id,
        name=application.name,
        description=application.description,
        redirect_uri=application.redirect_uri,
        client_id=application.client_id,
        client_secret=client_secret,
        scopes=_split_scopes(application.scopes),
        bot_user_id=application.bot_user_id,
        bot_username=None,
        has_bot=application.bot_user_id is not None,
        created_at=application.created_at,
    )


async def _application_read_with_bot(
    session: AsyncSession,
    application: OAuthApplication,
    *,
    client_secret: str | None = None,
) -> OAuthApplicationRead:
    bot_username = None
    if application.bot_user_id is not None:
        result = await session.execute(select(User).where(User.id == application.bot_user_id))
        bot = result.scalar_one_or_none()
        bot_username = bot.username if bot is not None else None
    return OAuthApplicationRead(
        id=application.id,
        name=application.name,
        description=application.description,
        redirect_uri=application.redirect_uri,
        client_id=application.client_id,
        client_secret=client_secret,
        scopes=_split_scopes(application.scopes),
        bot_user_id=application.bot_user_id,
        bot_username=bot_username,
        has_bot=application.bot_user_id is not None,
        created_at=application.created_at,
    )


async def _get_owned_application(
    session: AsyncSession,
    *,
    application_id: str,
    owner_user_id,
) -> OAuthApplication:
    result = await session.execute(
        select(OAuthApplication).where(
            OAuthApplication.id == application_id,
            OAuthApplication.owner_user_id == owner_user_id,
        )
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=404, detail="OAuth application not found")
    return application


def _build_bot_username(application_name: str) -> str:
    base = "".join(ch.lower() if ch.isalnum() else "_" for ch in application_name).strip("_") or "bergabot"
    base = base[:20]
    return f"{base}_bot_{generate_secure_token()[:6].lower()}"


@router.get("/apps", response_model=list[OAuthApplicationRead])
async def list_oauth_applications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(OAuthApplication).where(
            OAuthApplication.owner_user_id == current_user.id,
            OAuthApplication.disabled_at.is_(None),
        )
    )
    return [await _application_read_with_bot(session, application) for application in result.scalars().all()]


@router.post("/apps", response_model=OAuthApplicationRead, status_code=status.HTTP_201_CREATED)
async def create_oauth_application(
    body: OAuthApplicationCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    client_id = generate_secure_token()[:32]
    client_secret = generate_secure_token()
    application = OAuthApplication(
        owner_user_id=current_user.id,
        name=body.name,
        description=body.description,
        redirect_uri=str(body.redirect_uri),
        client_id=client_id,
        client_secret_hash=hash_password(client_secret),
        scopes=" ".join(_split_scopes(body.scopes)),
    )
    session.add(application)
    await session.commit()
    await session.refresh(application)
    return await _application_read_with_bot(session, application, client_secret=client_secret)


@router.patch("/apps/{application_id}", response_model=OAuthApplicationRead)
async def update_oauth_application(
    application_id: str,
    body: OAuthApplicationUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    application = await _get_owned_application(
        session,
        application_id=application_id,
        owner_user_id=current_user.id,
    )
    update_data = body.model_dump(exclude_unset=True)
    if "name" in update_data:
        application.name = update_data["name"]
    if "description" in update_data:
        application.description = update_data["description"]
    if "redirect_uri" in update_data and update_data["redirect_uri"] is not None:
        application.redirect_uri = str(update_data["redirect_uri"])
    if "scopes" in update_data and update_data["scopes"] is not None:
        application.scopes = " ".join(_split_scopes(update_data["scopes"]))
    await session.commit()
    await session.refresh(application)
    return await _application_read_with_bot(session, application)


@router.post("/apps/{application_id}/rotate-secret", response_model=OAuthClientSecretRead)
async def rotate_oauth_application_secret(
    application_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    application = await _get_owned_application(
        session,
        application_id=application_id,
        owner_user_id=current_user.id,
    )
    client_secret = generate_secure_token()
    application.client_secret_hash = hash_password(client_secret)
    await session.commit()
    return OAuthClientSecretRead(client_secret=client_secret)


@router.post("/apps/{application_id}/bot", response_model=OAuthBotProvisionRead)
async def provision_oauth_application_bot(
    application_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    application = await _get_owned_application(
        session,
        application_id=application_id,
        owner_user_id=current_user.id,
    )
    bot = None
    if application.bot_user_id is not None:
        result = await session.execute(select(User).where(User.id == application.bot_user_id))
        bot = result.scalar_one_or_none()

    if bot is None:
        username = _build_bot_username(application.name)
        bot = User(
            username=username,
            email=f"{username}@bots.bergamot.local",
            password_hash=hash_password(generate_secure_token()),
            display_name=f"{application.name} Bot",
            is_bot=True,
        )
        session.add(bot)
        await session.flush()
        application.bot_user_id = bot.id

    token = create_access_token(subject=str(bot.id), expires_delta=timedelta(days=365))
    application.bot_token_hash = hash_password(token)
    await session.commit()
    return OAuthBotProvisionRead(
        bot_user_id=bot.id,
        bot_username=bot.username,
        token=token,
    )


@router.delete("/apps/{application_id}")
async def delete_oauth_application(
    application_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(OAuthApplication).where(
            OAuthApplication.id == application_id,
            OAuthApplication.owner_user_id == current_user.id,
        )
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=404, detail="OAuth application not found")

    application.disabled_at = datetime.now(timezone.utc)
    await session.commit()
    return {"ok": True}


@router.get("/authorized-apps", response_model=list[OAuthAuthorizedAppRead])
async def list_authorized_apps(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(OAuthConsentGrant, OAuthApplication)
        .join(OAuthApplication, OAuthApplication.id == OAuthConsentGrant.application_id)
        .where(
            OAuthConsentGrant.user_id == current_user.id,
            OAuthConsentGrant.revoked_at.is_(None),
            OAuthApplication.disabled_at.is_(None),
        )
    )
    return [
        OAuthAuthorizedAppRead(
            id=grant.id,
            application_id=application.id,
            application_name=application.name,
            description=application.description,
            redirect_uri=application.redirect_uri,
            scopes=_split_scopes(grant.scopes),
            created_at=grant.created_at,
            last_used_at=grant.last_used_at,
        )
        for grant, application in result.all()
    ]


@router.delete("/authorized-apps/{grant_id}")
async def revoke_authorized_app(
    grant_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(OAuthConsentGrant).where(
            OAuthConsentGrant.id == grant_id,
            OAuthConsentGrant.user_id == current_user.id,
            OAuthConsentGrant.revoked_at.is_(None),
        )
    )
    grant = result.scalar_one_or_none()
    if grant is None:
        raise HTTPException(status_code=404, detail="Authorized app not found")

    grant.revoked_at = datetime.now(timezone.utc)
    await session.commit()
    return {"ok": True}


@router.get("/authorize", response_model=OAuthAuthorizePreviewRead)
async def preview_authorization_request(
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    scope: str | None = Query(default=None),
    state: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(OAuthApplication).where(
            OAuthApplication.client_id == client_id,
            OAuthApplication.disabled_at.is_(None),
        )
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=404, detail="OAuth application not found")
    if application.redirect_uri != redirect_uri:
        raise HTTPException(status_code=400, detail="Redirect URI does not match registered application")

    requested_scopes = _split_scopes(scope, fallback=_split_scopes(application.scopes))
    grant_result = await session.execute(
        select(OAuthConsentGrant).where(
            OAuthConsentGrant.user_id == current_user.id,
            OAuthConsentGrant.application_id == application.id,
            OAuthConsentGrant.revoked_at.is_(None),
        )
    )
    existing_grant = grant_result.scalar_one_or_none()
    granted_scopes = set(_split_scopes(existing_grant.scopes)) if existing_grant is not None else set()

    return OAuthAuthorizePreviewRead(
        application_id=application.id,
        client_id=application.client_id,
        application_name=application.name,
        description=application.description,
        redirect_uri=application.redirect_uri,
        requested_scopes=requested_scopes,
        state=state,
        already_authorized=set(requested_scopes).issubset(granted_scopes),
    )


@router.post("/authorize", response_model=OAuthAuthorizationResult)
async def create_authorization_code(
    body: OAuthAuthorizeDecision,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(OAuthApplication).where(
            OAuthApplication.client_id == body.client_id,
            OAuthApplication.disabled_at.is_(None),
        )
    )
    application = result.scalar_one_or_none()
    if application is None:
        raise HTTPException(status_code=404, detail="OAuth application not found")
    if application.redirect_uri != str(body.redirect_uri):
        raise HTTPException(status_code=400, detail="Redirect URI does not match registered application")
    if not body.approve:
        raise HTTPException(status_code=400, detail="Authorization request denied")

    scopes = _split_scopes(body.scopes, fallback=_split_scopes(application.scopes))

    grant_result = await session.execute(
        select(OAuthConsentGrant).where(
            OAuthConsentGrant.user_id == current_user.id,
            OAuthConsentGrant.application_id == application.id,
        )
    )
    grant = grant_result.scalar_one_or_none()
    if grant is None:
        grant = OAuthConsentGrant(
            user_id=current_user.id,
            application_id=application.id,
            scopes=" ".join(scopes),
        )
        session.add(grant)
    else:
        grant.scopes = " ".join(scopes)
        grant.revoked_at = None

    code = generate_secure_token()
    auth_code = OAuthAuthorizationCode(
        application_id=application.id,
        user_id=current_user.id,
        code=code,
        redirect_uri=application.redirect_uri,
        scopes=" ".join(scopes),
        state=body.state,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )
    session.add(auth_code)
    await session.commit()

    query_string = urlencode({"code": code, **({"state": body.state} if body.state else {})})
    redirect_uri = f"{application.redirect_uri}{'&' if '?' in application.redirect_uri else '?'}{query_string}"
    return OAuthAuthorizationResult(redirect_uri=redirect_uri, code=code, state=body.state)


@router.post("/token", response_model=OAuthTokenRead)
async def exchange_authorization_code(
    grant_type: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(...),
    code: str = Form(...),
    redirect_uri: str = Form(...),
    session: AsyncSession = Depends(get_session),
):
    if grant_type != "authorization_code":
        raise HTTPException(status_code=400, detail="Unsupported grant_type")

    application_result = await session.execute(
        select(OAuthApplication).where(
            OAuthApplication.client_id == client_id,
            OAuthApplication.disabled_at.is_(None),
        )
    )
    application = application_result.scalar_one_or_none()
    if application is None or not verify_password(client_secret, application.client_secret_hash):
        raise HTTPException(status_code=401, detail="Invalid client credentials")
    if application.redirect_uri != redirect_uri:
        raise HTTPException(status_code=400, detail="Redirect URI does not match registered application")

    code_result = await session.execute(
        select(OAuthAuthorizationCode).where(OAuthAuthorizationCode.code == code)
    )
    auth_code = code_result.scalar_one_or_none()
    if (
        auth_code is None
        or auth_code.application_id != application.id
        or auth_code.redirect_uri != redirect_uri
        or auth_code.consumed_at is not None
        or auth_code.expires_at <= datetime.now(timezone.utc)
    ):
        raise HTTPException(status_code=400, detail="Invalid or expired authorization code")

    auth_code.consumed_at = datetime.now(timezone.utc)
    grant_result = await session.execute(
        select(OAuthConsentGrant).where(
            OAuthConsentGrant.user_id == auth_code.user_id,
            OAuthConsentGrant.application_id == application.id,
            OAuthConsentGrant.revoked_at.is_(None),
        )
    )
    grant = grant_result.scalar_one_or_none()
    if grant is not None:
        grant.last_used_at = datetime.now(timezone.utc)

    await session.commit()

    token = generate_secure_token()
    scope = auth_code.scopes or application.scopes or ""
    return OAuthTokenRead(access_token=token, scope=scope, expires_in=3600)
