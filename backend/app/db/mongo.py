from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import get_settings

settings = get_settings()

class Database:
    client: AsyncIOMotorClient = None

    def connect_to_database(self):
        self.client = AsyncIOMotorClient(settings.MONGODB_URI)
        print("Connected to MongoDB")

    def close_database_connection(self):
        if self.client:
            self.client.close()
            print("MongoDB connection closed")

    def get_db(self):
        return self.client[settings.DATABASE_NAME]

db = Database()

async def get_database():
    return db.get_db()
