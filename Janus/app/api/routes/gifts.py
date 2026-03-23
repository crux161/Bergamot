"""Gift link creation, preview, and claim routes."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import get_current_user
from app.core.security import generate_secure_token
from app.models.gift_code import GiftCode
from app.models.user import User
from app.schemas.gift import GiftClaimRead, GiftCodeCreate, GiftCodePreviewRead, GiftCodeRead

router = APIRouter(prefix="/gifts", tags=["gifts"])


def _is_valid(gift: GiftCode | None) -> bool:
    if gift is None:
        return False
    if gift.disabled_at is not None:
        return False
    if gift.expires_at is not None and gift.expires_at <= datetime.now(timezone.utc):
        return False
    if gift.claimed_at is not None:
        return False
    return True


def _build_gift_url(code: str) -> str:
    return f"{settings.WEB_APP_URL.rstrip('/')}/#/gift?token={code}"


def _to_read(gift: GiftCode) -> GiftCodeRead:
    return GiftCodeRead(
        id=gift.id,
        code=gift.code,
        title=gift.title,
        description=gift.description,
        claim_message=gift.claim_message,
        theme=gift.theme,
        expires_at=gift.expires_at,
        claimed_at=gift.claimed_at,
        created_at=gift.created_at,
        claimed_by_user_id=gift.claimed_by_user_id,
        gift_url=_build_gift_url(gift.code),
    )


def _to_preview(gift: GiftCode | None, code: str) -> GiftCodePreviewRead:
    return GiftCodePreviewRead(
        code=code,
        valid=_is_valid(gift),
        title=gift.title if gift is not None else "Claim Gift",
        description=gift.description if gift is not None else "Authenticate to attach this gift to your Bergamot account.",
        claim_message=gift.claim_message if gift is not None else None,
        theme=gift.theme if gift is not None else None,
        expires_at=gift.expires_at if gift is not None else None,
        claimed=gift.claimed_at is not None if gift is not None else False,
        claimed_by_user_id=gift.claimed_by_user_id if gift is not None else None,
    )


@router.get("/created", response_model=list[GiftCodeRead])
async def list_created_gifts(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(GiftCode)
        .where(GiftCode.created_by_user_id == current_user.id)
        .order_by(GiftCode.created_at.desc())
    )
    return [_to_read(gift) for gift in result.scalars().all()]


@router.get("/claimed", response_model=list[GiftCodeRead])
async def list_claimed_gifts(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(GiftCode)
        .where(GiftCode.claimed_by_user_id == current_user.id)
        .order_by(GiftCode.claimed_at.desc())
    )
    return [_to_read(gift) for gift in result.scalars().all()]


@router.post("/", response_model=GiftCodeRead, status_code=status.HTTP_201_CREATED)
async def create_gift(
    body: GiftCodeCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    gift = GiftCode(
        created_by_user_id=current_user.id,
        code=generate_secure_token()[:12],
        title=body.title,
        description=body.description,
        claim_message=body.claim_message,
        theme=body.theme,
        expires_at=(
            datetime.now(timezone.utc) + timedelta(hours=body.expires_in_hours)
            if body.expires_in_hours is not None
            else None
        ),
    )
    session.add(gift)
    await session.commit()
    await session.refresh(gift)
    return _to_read(gift)


@router.get("/{code}", response_model=GiftCodePreviewRead)
async def preview_gift(
    code: str,
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(GiftCode).where(GiftCode.code == code))
    gift = result.scalar_one_or_none()
    return _to_preview(gift, code)


@router.post("/{code}/claim", response_model=GiftClaimRead)
async def claim_gift(
    code: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(select(GiftCode).where(GiftCode.code == code))
    gift = result.scalar_one_or_none()
    if gift is None:
        raise HTTPException(status_code=404, detail="Gift not found")
    if gift.claimed_by_user_id == current_user.id:
        return GiftClaimRead(
            ok=True,
            already_claimed=True,
            title=gift.title,
            description=gift.description,
            claim_message=gift.claim_message,
            theme=gift.theme,
        )
    if not _is_valid(gift):
        raise HTTPException(status_code=400, detail="Gift is invalid or already claimed")

    gift.claimed_by_user_id = current_user.id
    gift.claimed_at = datetime.now(timezone.utc)
    await session.commit()
    return GiftClaimRead(
        ok=True,
        already_claimed=False,
        title=gift.title,
        description=gift.description,
        claim_message=gift.claim_message,
        theme=gift.theme,
    )
