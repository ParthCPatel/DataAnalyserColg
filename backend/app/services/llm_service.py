from langchain_google_genai import ChatGoogleGenerativeAI
from app.core.config import get_settings

settings = get_settings()

if not settings.GOOGLE_API_KEY:
    print("WARNING: GOOGLE_API_KEY is not set. LLM features will fail.")

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash-exp",
    google_api_key=settings.GOOGLE_API_KEY,
    temperature=0
)

def get_llm():
    return llm
