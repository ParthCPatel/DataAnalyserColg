import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

SMTP_SERVER = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USERNAME = os.environ.get("SMTP_USERNAME", "datanlyser@gmail.com")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "moaqdpoorzglinvk")
SENDER_EMAIL = SMTP_USERNAME

print(f"Testing SMTP with {SMTP_USERNAME} on port {SMTP_PORT}")

try:
    msg = EmailMessage()
    msg.set_content("Test email from DataAnalyser")
    msg["Subject"] = "Test Email"
    msg["From"] = SENDER_EMAIL
    msg["To"] = SMTP_USERNAME

    if str(SMTP_PORT) == "465":
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=10) as server:
            server.set_debuglevel(1)
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    print("✅ SUCCESS!")
except Exception as e:
    print(f"❌ ERROR: {e}")
