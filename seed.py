
import asyncio
from datetime import datetime, timezone

from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError

from app.config import settings
from app.security import hash_password


def get_timestamp():
    return datetime.now(timezone.utc)


async def main():
    client = AsyncIOMotorClient(settings.mongodb_url)

    try:
        # 1. Check MongoDB connection
        await client.admin.command("ping")
        print("MongoDB connection successful.")

        db = client[settings.mongodb_db]
        now = get_timestamp()

        # 2. Find existing demo users
        demo_emails = [
            "seller@example.com",
            "buyer@example.com",
        ]

        old_users = await db.users.find(
            {"email": {"$in": demo_emails}},
            {"_id": 1},
        ).to_list(length=None)

        old_ids = [user["_id"] for user in old_users]

        # 3. Remove data belonging to these demo users
        # WARNING: This deletes existing demo users, their products,
        # and their requirements before recreating the demo data.
        if old_ids:
            await db.products.delete_many(
                {"seller_id": {"$in": old_ids}}
            )

            await db.requirements.delete_many(
                {"buyer_id": {"$in": old_ids}}
            )

        await db.users.delete_many(
            {"email": {"$in": demo_emails}}
        )

        # 4. Create demo seller
        seller_result = await db.users.insert_one({
            "name": "Demo Seller - Belagavi Supplies",
            "email": "seller@example.com",
            "password_hash": hash_password("SellerDemo123!"),
            "role": "seller",
            "phone": "+91-9000000001",
            "reliability_score": 92,
            "verified": True,
            "created_at": now,
        })

        seller_id = seller_result.inserted_id

        # 5. Create demo buyer
        await db.users.insert_one({
            "name": "Demo Buyer",
            "email": "buyer@example.com",
            "password_hash": hash_password("BuyerDemo123!"),
            "role": "buyer",
            "phone": "+91-9000000002",
            "reliability_score": 65,
            "verified": False,
            "created_at": now,
        })

        # 6. Sample marketplace products
        products = [
            {
                "name": "Wireless Bluetooth Headphones",
                "description": (
                    "Over-ear Bluetooth headphones with microphone "
                    "and USB-C charging."
                ),
                "category": "Electronics",
                "brand": "SoundPeak",
                "model": "SP-500",
                "specifications": {
                    "connectivity": "Bluetooth",
                    "charging_port": "USB-C",
                    "color": "Black",
                    "noise_cancellation": True,
                },
                "price": 1499,
                "currency": "INR",
                "stock": 35,
                "condition": "new",
                "quality_score": 88,
                "warranty_months": 12,
                "return_available": True,
                "delivery_days": 2,
                "minimum_order_quantity": 1,
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1505740420928-5e560c06d30e?w=800"
                ),
                "city": "Belagavi",
                "latitude": 15.8497,
                "longitude": 74.4977,
                "active": True,
            },
            {
                "name": "USB-C Wireless Headphones",
                "description": (
                    "Wireless over-ear headphones, USB-C charging, black."
                ),
                "category": "Electronics",
                "brand": "AudioNest",
                "model": "AN-20",
                "specifications": {
                    "connectivity": "Bluetooth",
                    "charging_port": "USB-C",
                    "color": "Black",
                    "noise_cancellation": False,
                },
                "price": 1199,
                "currency": "INR",
                "stock": 18,
                "condition": "new",
                "quality_score": 78,
                "warranty_months": 6,
                "return_available": True,
                "delivery_days": 3,
                "minimum_order_quantity": 1,
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1505740420928-5e560c06d30e?w=800"
                ),
                "city": "Belagavi",
                "latitude": 15.86,
                "longitude": 74.51,
                "active": True,
            },
            {
                "name": "Stainless Steel Hex Bolt M8",
                "description": (
                    "M8 stainless steel hex bolt for general "
                    "mechanical fastening."
                ),
                "category": "Industrial",
                "brand": "FixRight",
                "model": "SS-M8",
                "specifications": {
                    "material": "Stainless Steel",
                    "diameter": "M8",
                    "grade": "A2-70",
                    "length_mm": 40,
                },
                "price": 18,
                "currency": "INR",
                "stock": 1200,
                "condition": "new",
                "quality_score": 91,
                "warranty_months": 0,
                "return_available": False,
                "delivery_days": 1,
                "minimum_order_quantity": 10,
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1586864387967-d02ef85d93e8?w=800"
                ),
                "city": "Belagavi",
                "latitude": 15.8497,
                "longitude": 74.4977,
                "active": True,
            },
            {
                "name": "Ergonomic Office Chair",
                "description": (
                    "Adjustable mesh office chair with lumbar support."
                ),
                "category": "Home & Office",
                "brand": "WorkEase",
                "model": "WE-3",
                "specifications": {
                    "material": "Mesh",
                    "adjustable_height": True,
                    "color": "Black",
                    "max_load_kg": 120,
                },
                "price": 5499,
                "currency": "INR",
                "stock": 12,
                "condition": "new",
                "quality_score": 86,
                "warranty_months": 24,
                "return_available": True,
                "delivery_days": 4,
                "minimum_order_quantity": 1,
                # Replace with a verified chair image URL if needed.
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1505843490538-5133c6c7d0e?w=800"
                ),
                "city": "Belagavi",
                "latitude": 15.8497,
                "longitude": 74.4977,
                "active": True,
            },
            {
                "name": "USB-C 65W Laptop Charger",
                "description": (
                    "65 watt USB-C power adapter compatible with "
                    "supported USB-C laptops."
                ),
                "category": "Electronics",
                "brand": "VoltEdge",
                "model": "VE-65",
                "specifications": {
                    "power_w": 65,
                    "connector": "USB-C",
                    "color": "White",
                    "fast_charging": True,
                },
                "price": 1799,
                "currency": "INR",
                "stock": 0,
                "condition": "new",
                "quality_score": 80,
                "warranty_months": 12,
                "return_available": True,
                "delivery_days": 2,
                "minimum_order_quantity": 1,
                "image_url": (
                    "https://images.unsplash.com/"
                    "photo-1583863788434-e58a36330cf0?w=800"
                ),
                "city": "Belagavi",
                "latitude": 15.8497,
                "longitude": 74.4977,
                "active": True,
            },
        ]

        # 7. Add seller ID, GeoJSON location, and timestamps
        for product in products:
            product.update({
                "seller_id": seller_id,
                "location": {
                    "type": "Point",
                    "coordinates": [
                        product["longitude"],
                        product["latitude"],
                    ],
                },
                "created_at": now,
                "updated_at": now,
            })

        # 8. Save products to MongoDB
        result = await db.products.insert_many(products)

        print("\nDemo data seeded successfully.")
        print(f"Database: {settings.mongodb_db}")
        print(f"Products inserted: {len(result.inserted_ids)}")
        print("Seller login: seller@example.com / SellerDemo123!")
        print("Buyer login: buyer@example.com / BuyerDemo123!")

    except PyMongoError as exc:
        print(f"MongoDB error: {exc}")
        raise

    except Exception as exc:
        print(f"Seed script failed: {exc}")
        raise

    finally:
        # Always close the MongoDB client
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
