"""User notes routes — private notes about other users."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.user import User
from app.models.user_note import UserNote

router = APIRouter(prefix="/notes", tags=["notes"])


class UserNoteRead(BaseModel):
    target_id: str
    content: str
    updated_at: str | None = None

    model_config = {"from_attributes": True}


class UserNoteUpdate(BaseModel):
    content: str = Field(max_length=2000)


@router.get("/{user_id}", response_model=UserNoteRead)
async def get_note(
    user_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Get the current user's note about another user."""
    result = await session.execute(
        select(UserNote).where(
            UserNote.owner_id == current_user.id,
            UserNote.target_id == user_id,
        )
    )
    note = result.scalar_one_or_none()
    if note is None:
        return UserNoteRead(target_id=user_id, content="")
    return UserNoteRead(
        target_id=str(note.target_id),
        content=note.content,
        updated_at=note.updated_at.isoformat() if note.updated_at else None,
    )


@router.put("/{user_id}", response_model=UserNoteRead)
async def set_note(
    user_id: str,
    body: UserNoteUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Set or update the current user's note about another user."""
    result = await session.execute(
        select(UserNote).where(
            UserNote.owner_id == current_user.id,
            UserNote.target_id == user_id,
        )
    )
    note = result.scalar_one_or_none()

    if body.content.strip() == "" and note is not None:
        await session.delete(note)
        await session.commit()
        return UserNoteRead(target_id=user_id, content="")

    if note is None:
        note = UserNote(
            owner_id=current_user.id,
            target_id=user_id,
            content=body.content,
        )
        session.add(note)
    else:
        note.content = body.content

    await session.commit()
    await session.refresh(note)
    return UserNoteRead(
        target_id=str(note.target_id),
        content=note.content,
        updated_at=note.updated_at.isoformat() if note.updated_at else None,
    )
