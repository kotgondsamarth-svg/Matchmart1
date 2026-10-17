from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

client: AsyncIOMotorClient | None = None
db = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=5000)
    await client.admin.command("ping")
    db = client[settings.mongodb_db]
    await db.users.create_index("email", unique=True)
    await db.products.create_index([("category", 1), ("active", 1)])
    await db.products.create_index([("seller_id", 1)])
    await db.requirements.create_index([("buyer_id", 1), ("created_at", -1)])
    await db.products.create_index([("location", "2dsphere")])

async def close_db():
    global client
    if client:
        client.close()
        client = None

def get_db():
    if db is None:
        raise RuntimeError("Database has not been initialized")
    return db
