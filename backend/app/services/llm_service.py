from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import get_settings
from dotenv import load_dotenv
import os
load_dotenv()

settings = get_settings()

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0
)

def get_llm():
    return llm
