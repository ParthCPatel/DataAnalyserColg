import smtplib
from email.message import EmailMessage
import os
import logging
from typing import Optional

logger = logging.getLogger(__name__)

SMTP_SERVER = os.getenv("SMTP_SERVER", "").strip()
SMTP_PORT_RAW = os.getenv("SMTP_PORT", "587").strip()
SMTP_PORT = int(SMTP_PORT_RAW) if SMTP_PORT_RAW.isdigit() else 587
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SENDER_EMAIL = os.getenv("SENDER_EMAIL", SMTP_USERNAME).strip()

def send_otp_email(recipient_email: str, otp: str, is_reset: bool = False):
    """
    Sends an OTP to the specified email. 
    If SMTP credentials are not configured, it will log the OTP to the console.
    """
    subject = "Your Verification Code"
    if is_reset:
        subject = "Password Reset Code"

    body = f"""
    Hello,
    
    Your One-Time Password (OTP) is: {otp}
    
    This code is valid for 10 minutes. Please do not share this code with anyone.
    
    If you did not request this, please ignore this email.
    
    Regards,
    Data Analyser Team
    """

    if not SMTP_SERVER or not SMTP_USERNAME or not SMTP_PASSWORD:
        logger.warning(f"SMTP is not configured! OTP for {recipient_email} is: {otp}")
        print(f"\n========== MOCK EMAIL ==========\nTo: {recipient_email}\nSubject: {subject}\n{body}\n================================\n")
        return True

    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = subject
    msg["From"] = SENDER_EMAIL
    msg["To"] = recipient_email

    try:
        if str(SMTP_PORT) == "465":
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.send_message(msg)
        print(f"✅ OTP email sent successfully to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {e}")
        print(f"❌ SMTP ERROR for {recipient_email}: {str(e)}")
        # If it's a login error, help the user
        if "authentication failed" in str(e).lower():
            print("💡 HINT: Check your Gmail App Password. Make sure it's 16 characters and has no spaces.")
        return False
