
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from app.config import settings

client = MongoClient(
    settings.mongodb_url,
    serverSelectionTimeoutMS=10000,
)

try:
    result = client.admin.command("ping")
    print("MongoDB connection successful:", result)
except PyMongoError as error:
    print("MongoDB connection failed:", error)
finally:
    client.close()
