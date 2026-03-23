"""Minimal email delivery service with SMTP and file-outbox support."""

from __future__ import annotations

import asyncio
import json
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

from app.core.config import settings


def _render_email(recipient: str, subject: str, *, text_body: str, html_body: str | None = None) -> EmailMessage:
    message = EmailMessage()
    message["From"] = settings.EMAIL_FROM
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")
    return message


def _write_outbox_message(recipient: str, subject: str, *, text_body: str, html_body: str | None = None) -> str:
    outbox_dir = Path(settings.EMAIL_OUTBOX_DIR)
    outbox_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    safe_recipient = recipient.replace("@", "_at_").replace("/", "_")
    outbox_path = outbox_dir / f"{timestamp}_{safe_recipient}.json"
    outbox_path.write_text(
        json.dumps(
            {
                "to": recipient,
                "from": settings.EMAIL_FROM,
                "subject": subject,
                "text": text_body,
                "html": html_body,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return str(outbox_path)


def _send_via_smtp(message: EmailMessage) -> None:
    if not settings.SMTP_HOST:
        return

    if settings.SMTP_USE_TLS:
        server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)

    with server:
        if settings.SMTP_USE_STARTTLS and not settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
        server.send_message(message)


async def deliver_email(recipient: str, subject: str, *, text_body: str, html_body: str | None = None) -> dict:
    message = _render_email(recipient, subject, text_body=text_body, html_body=html_body)
    outbox_path = await asyncio.to_thread(
        _write_outbox_message,
        recipient,
        subject,
        text_body=text_body,
        html_body=html_body,
    )
    if settings.SMTP_HOST:
        await asyncio.to_thread(_send_via_smtp, message)
    return {"delivered": True, "outbox_path": outbox_path, "smtp_enabled": bool(settings.SMTP_HOST)}
