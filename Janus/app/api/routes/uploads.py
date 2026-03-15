"""File upload routes for image attachments."""

import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.attachment import Attachment
from app.models.user import User
from app.schemas.attachment import AttachmentRead

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}


@router.post("/", response_model=AttachmentRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    """Upload an image file.

    Validates content type (jpeg, png, gif, webp) and enforces a size limit.
    Stores the file on disk and creates a database record.
    """
    # Validate content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {file.content_type}. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )

    # Read file content and check size
    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE_MB} MB.",
        )

    # Generate unique filename
    ext = os.path.splitext(file.filename or "image.png")[1] or ".png"
    storage_name = f"{uuid.uuid4()}{ext}"
    storage_path = os.path.join(settings.UPLOAD_DIR, storage_name)

    # Write to disk
    async with aiofiles.open(storage_path, "wb") as f:
        await f.write(content)

    # Create database record
    attachment = Attachment(
        filename=file.filename or "image.png",
        content_type=file.content_type or "image/png",
        size=len(content),
        storage_path=storage_name,
        uploader_id=current_user.id,
    )
    session.add(attachment)
    await session.commit()
    await session.refresh(attachment)

    return AttachmentRead(
        id=attachment.id,
        filename=attachment.filename,
        content_type=attachment.content_type,
        size=attachment.size,
        url=f"/uploads/{storage_name}",
        created_at=attachment.created_at,
    )
