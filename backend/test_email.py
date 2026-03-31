import smtplib
from email.message import EmailMessage
import os

SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USERNAME = "datanlyser@gmail.com"
SMTP_PASSWORD = "moaqdpoorzglinvk"
SENDER_EMAIL = SMTP_USERNAME

msg = EmailMessage()
msg.set_content("Test")
msg["Subject"] = "Test"
msg["From"] = SENDER_EMAIL
msg["To"] = "datanlyser@gmail.com"

try:
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.set_debuglevel(1)
        server.starttls()
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(msg)
    print("Success")
except Exception as e:
    print("Error:", e)
