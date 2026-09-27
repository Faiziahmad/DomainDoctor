"""Send reports over SMTP. Settings come from environment variables:

DD_SMTP_HOST, DD_SMTP_PORT (default 587), DD_SMTP_USER, DD_SMTP_PASS, DD_FROM
"""
from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage


def send(to: str, subject: str, text: str, html: str) -> None:
    host = os.environ.get("DD_SMTP_HOST")
    sender = os.environ.get("DD_FROM") or os.environ.get("DD_SMTP_USER")
    if not host or not sender:
        raise RuntimeError("Set DD_SMTP_HOST and DD_FROM (or DD_SMTP_USER) to send email.")
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = sender, to, subject
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    port = int(os.environ.get("DD_SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=30) as s:
        s.starttls()
        if os.environ.get("DD_SMTP_USER"):
            s.login(os.environ["DD_SMTP_USER"], os.environ.get("DD_SMTP_PASS", ""))
        s.send_message(msg)
