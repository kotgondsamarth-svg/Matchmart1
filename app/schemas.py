from typing import Any, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from datetime import datetime

Role = Literal["buyer", "seller"]
Condition = Literal["new", "used", "refurbished"]

class SignupIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    role: Role
    phone: str | None = Field(default=None, max_length=25)

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        return value.strip()

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class ProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=3000)
    category: str = Field(min_length=2, max_length=80)
    brand: str | None = Field(default=None, max_length=100)
    model: str | None = Field(default=None, max_length=100)
    specifications: dict[str, str | int | float | bool] = Field(default_factory=dict)
    price: float = Field(gt=0, le=100000000)
    currency: str = Field(default="INR", pattern="^INR$")
    stock: int = Field(ge=0, le=10000000)
    condition: Condition = "new"
    quality_score: int = Field(default=75, ge=0, le=100)
    warranty_months: int = Field(default=0, ge=0, le=120)
    return_available: bool = True
    delivery_days: int = Field(default=3, ge=0, le=365)
    minimum_order_quantity: int = Field(default=1, ge=1, le=10000000)
    image_url: str | None = Field(default=None, max_length=1000)
    city: str = Field(min_length=2, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    active: bool = True

class RequirementIn(BaseModel):
    product_name: str = Field(min_length=2, max_length=160)
    category: str = Field(min_length=2, max_length=80)
    quantity: int = Field(ge=1, le=10000000)
    max_budget: float | None = Field(default=None, gt=0, le=1000000000)
    city: str = Field(min_length=2, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    max_distance_km: float | None = Field(default=None, gt=0, le=50000)
    mandatory_specs: dict[str, str | int | float | bool] = Field(default_factory=dict)
    preferred_specs: dict[str, str | int | float | bool] = Field(default_factory=dict)
    allow_alternatives: bool = True
    max_delivery_days: int | None = Field(default=None, ge=0, le=365)

class UserOut(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    phone: str | None = None

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ProductOut(BaseModel):
    id: str
    seller_id: str
    seller_name: str | None = None
    name: str
    description: str
    category: str
    brand: str | None = None
    model: str | None = None
    specifications: dict[str, Any]
    price: float
    currency: str = "INR"
    stock: int
    condition: Condition
    quality_score: int
    warranty_months: int
    return_available: bool
    delivery_days: int
    minimum_order_quantity: int
    image_url: str | None = None
    city: str
    latitude: float
    longitude: float
    active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

class RequirementOut(BaseModel):
    id: str
    buyer_id: str
    product_name: str
    category: str
    quantity: int
    max_budget: float | None = None
    city: str
    latitude: float
    longitude: float
    max_distance_km: float | None = None
    mandatory_specs: dict[str, Any]
    preferred_specs: dict[str, Any]
    allow_alternatives: bool
    max_delivery_days: int | None = None
    created_at: datetime
