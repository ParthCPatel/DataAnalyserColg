from app.services.llm_service import get_llm
from langchain_core.messages import HumanMessage
import asyncio

async def test():
    try:
        llm = get_llm()
        res = await llm.ainvoke([HumanMessage(content="Hello")])
        print("LLM Response:", res.content)
    except Exception as e:
        print("LLM Error:", e)

if __name__ == "__main__":
    asyncio.run(test())
