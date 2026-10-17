from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from bson import ObjectId
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import DuplicateKeyError
from .config import settings
from .database import connect_db, close_db, get_db
from .schemas import SignupIn, LoginIn, TokenOut, UserOut, ProductIn, RequirementIn
from .security import hash_password, verify_password, create_access_token, current_user, require_role
from .matching import rank_products
from bson import ObjectId
from fastapi.encoders import jsonable_encoder
from .ai_service import generate_product_advice
def now():
    return datetime.now(timezone.utc)

def serialize_doc(doc: dict) -> dict:
    if not doc:
        return doc

    data = dict(doc)

    # Convert MongoDB IDs to JSON-compatible strings
    for key, value in data.items():
        if isinstance(value, ObjectId):
            data[key] = str(value)

    if "_id" in data:
        data["id"] = data.pop("_id")

    return jsonable_encoder(data)

def public_product(product: dict, seller_name: str | None = None) -> dict:
    data = serialize_doc(product)
    data["seller_name"] = seller_name
    return data

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await close_db()

app = FastAPI(title="MatchMart API", version="1.0.0", description="Smart buyer-seller matching marketplace API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://192.168.1.34:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"name": "MatchMart API", "docs": "/docs", "status": "ok"}

@app.get("/api/health")
async def health():
    db = get_db()
    await db.command("ping")
    return {"status": "ok", "database": "connected"}

@app.post("/api/auth/signup", response_model=TokenOut, status_code=201)
async def signup(payload: SignupIn):
    db = get_db()
    email = str(payload.email).lower()
    user = {
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "role": payload.role,
        "phone": payload.phone,
        "reliability_score": 65,
        "verified": False,
        "created_at": now(),
    }
    try:
        result = await db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user_id = str(result.inserted_id)
    safe_user = {"id": user_id, "name": user["name"], "email": email, "role": user["role"], "phone": user["phone"]}
    return {"access_token": create_access_token(user_id, user["role"]), "user": safe_user}

@app.post("/api/auth/login", response_model=TokenOut)
async def login(payload: LoginIn):
    db = get_db()
    user = await db.users.find_one({"email": str(payload.email).lower()})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    user_id = str(user["_id"])
    safe_user = {"id": user_id, "name": user["name"], "email": user["email"], "role": user["role"], "phone": user.get("phone")}
    return {"access_token": create_access_token(user_id, user["role"]), "user": safe_user}

@app.get("/api/auth/me")
async def me(user=Depends(current_user)):
    return user

@app.get("/api/products")
async def list_products(category: str | None = None, search: str | None = None, limit: int = 100):
    db = get_db()
    query: dict[str, Any] = {"active": True}
    if category:
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}
    if search:
        query["$or"] = [
            {"name": {"$regex": search[:80], "$options": "i"}},
            {"description": {"$regex": search[:120], "$options": "i"}},
            {"brand": {"$regex": search[:80], "$options": "i"}},
        ]
    docs = await db.products.find(query).sort("created_at", -1).limit(max(1, min(limit, 200))).to_list(length=max(1, min(limit, 200)))
    output = []
    for p in docs:
        seller = await db.users.find_one({"_id": p["seller_id"]}, {"name": 1})
        output.append(public_product(p, seller.get("name") if seller else "Seller"))
    return output

@app.post("/api/products", status_code=201)
async def create_product(payload: ProductIn, user=Depends(require_role("seller"))):
    db = get_db()
    doc = payload.model_dump()
    doc.update({"seller_id": ObjectId(user["id"]), "location": {"type": "Point", "coordinates": [payload.longitude, payload.latitude]}, "created_at": now(), "updated_at": now()})
    result = await db.products.insert_one(doc)
    doc["_id"] = result.inserted_id
    return public_product(doc, user["name"])


@app.post("/api/ai/advice")
async def ai_product_advice(payload: RequirementIn):
    db = get_db()

    # Get currently active marketplace products.
    docs = await (
        db.products.find({"active": True})
        .sort("created_at", -1)
        .limit(10)
        .to_list(length=10)
    )

    products = []
    for product in docs:
        products.append({
            "name": product.get("name"),
            "category": product.get("category"),
            "brand": product.get("brand"),
            "price": product.get("price"),
            "description": product.get("description"),
            "city": product.get("city"),
            "stock": product.get("stock"),
        })

    try:
        advice = await generate_product_advice(
            requirement=payload.model_dump(),
            products=products,
        )
        return {
            "success": True,
            "model": "gemini-3.8-flash",
            "advice": advice,
        }

    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc),
        )

    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Gemini AI is unavailable. Please try again later.",
        )

@app.get("/api/products/mine")
async def my_products(user=Depends(require_role("seller"))):
    db = get_db()
    docs = await db.products.find({"seller_id": ObjectId(user["id"])}).sort("updated_at", -1).to_list(length=300)
    return [public_product(p, user["name"]) for p in docs]

@app.put("/api/products/{product_id}")
async def update_product(product_id: str, payload: ProductIn, user=Depends(require_role("seller"))):
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    db = get_db()
    oid = ObjectId(product_id)
    existing = await db.products.find_one({"_id": oid, "seller_id": ObjectId(user["id"])})
    if not existing:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = payload.model_dump()
    updates["location"] = {"type": "Point", "coordinates": [payload.longitude, payload.latitude]}
    updates["updated_at"] = now()
    await db.products.update_one({"_id": oid}, {"$set": updates})
    updated = await db.products.find_one({"_id": oid})
    return public_product(updated, user["name"])

@app.delete("/api/products/{product_id}", status_code=204)
async def delete_product(product_id: str, user=Depends(require_role("seller"))):
    if not ObjectId.is_valid(product_id):
        raise HTTPException(status_code=404, detail="Product not found")
    db = get_db()
    result = await db.products.delete_one({"_id": ObjectId(product_id), "seller_id": ObjectId(user["id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return None

@app.post("/api/requirements", status_code=201)
async def create_requirement(payload: RequirementIn, user=Depends(require_role("buyer"))):
    db = get_db()
    doc = payload.model_dump()
    doc.update({"buyer_id": ObjectId(user["id"]), "created_at": now()})
    result = await db.requirements.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_doc(doc)

@app.get("/api/requirements/mine")
async def my_requirements(user=Depends(require_role("buyer"))):
    db = get_db()
    docs = await db.requirements.find({"buyer_id": ObjectId(user["id"])}).sort("created_at", -1).to_list(length=100)
    return [serialize_doc(d) for d in docs]

@app.post("/api/match")
async def match(payload: RequirementIn, user=Depends(require_role("buyer"))):
    db = get_db()
    requirement = payload.model_dump()
    products = await db.products.find({"active": True}).to_list(length=2000)
    sellers = {}
    for p in products:
        sid = str(p["seller_id"])
        if sid not in sellers:
            seller = await db.users.find_one({"_id": p["seller_id"]})
            sellers[sid] = seller or {}
    results = rank_products(products, sellers, requirement)
    # Remove database-specific values and private seller fields before returning.
    def clean(item):
        p = dict(item["product"])
        p["id"] = str(p.pop("_id"))
        p["seller_id"] = str(p["seller_id"])
        p.pop("latitude", None)
        p.pop("longitude", None)
        seller = item["seller"]
        return {
            "product": p,
            "seller": seller,
            "score": item["score"],
            "score_breakdown": item["score_breakdown"],
            "distance_km": item["distance_km"],
            "total_cost": item["total_cost"],
            "exact_mandatory_match": item["exact_mandatory_match"],
            "mandatory_mismatches": item["mandatory_mismatches"],
            "missing_mandatory": item["missing_mandatory"],
            "explanation": item["explanation"],
            "warnings": item["warnings"],
        }
    return {
        "weights": results["weights"],
        "eligible": [clean(x) for x in results["eligible"]],
        "alternatives": [clean(x) for x in results["alternatives"]],
        "rejected_count": results["rejected_count"],
        "message": results["message"],
    }