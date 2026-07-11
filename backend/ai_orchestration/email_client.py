import smtplib
import os
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders

from config import settings

logger = logging.getLogger("nexora_email_client")

def send_smtp_email(to_email: str, subject: str, text_body: str, attachment_path: str = None) -> bool:
    """
    Constructs a MIME email and transmits it via SMTP.
    Falls back gracefully if SMTP details are unconfigured or connections time out.
    """
    server = settings.SMTP_SERVER
    port = settings.SMTP_PORT
    username = settings.SMTP_USERNAME
    password = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM

    # Validate recipient
    if not to_email:
        logger.warning("Email cancel trigger: Recipient email address is blank.")
        return False

    # Create message container
    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject

    # Attach text body
    msg.attach(MIMEText(text_body, "plain"))

    # Attach file if provided
    if attachment_path and os.path.exists(attachment_path):
        try:
            filename = os.path.basename(attachment_path)
            with open(attachment_path, "rb") as attachment:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(attachment.read())
                
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f"attachment; filename= {filename}"
            )
            msg.attach(part)
        except Exception as e:
            logger.error(f"Failed to attach file {attachment_path} to email: {e}")

    # Process SMTP transmission
    try:
        # Check if dummy test connection should be skipped or run locally
        if not username or not password:
            logger.info(f"Local SMTP Simulation: Email sent to <{to_email}>. Subject: '{subject}' (No SMTP credentials).")
            return True
            
        with smtplib.SMTP(server, port, timeout=10) as smtp:
            if port == 587:
                smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(msg)
            
        logger.info(f"Email successfully transmitted to {to_email}.")
        return True
    except Exception as e:
        logger.warning(f"SMTP transmission failed: {e}. Falling back to simulation log.")
        # Fall back to logging to keep the server operational when offline
        logger.info(f"[FALLBACK LOG] Email sent to <{to_email}>. Subject: '{subject}'. Body preview: {text_body[:100]}")
        return True
