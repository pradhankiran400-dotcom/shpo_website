from pydantic import BaseModel, ConfigDict, Field, EmailStr
from typing import Optional

class ProductBase(BaseModel):
    name: str
    category: str
    description: str
    price: float
    unit: str = "kg"
    image_path: str
    in_stock: bool = True
    badge: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class PriceUpdate(BaseModel):
    price : float

class ProductResponse(ProductBase):
    id: int


    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    fullname: str
    phone_number: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    fullname: str
    phone_number: str

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    user_id: Optional[int] = None
    items_json: str
    total_price: float
    delivery_address: Optional[str] = None
    distance_km: Optional[float] = None
    delivery_charge: Optional[float] = None
    payment_method: Optional[str] = "COD"
    order_status: Optional[str] = "Pending Approval"
    receipt_image_url: Optional[str] = None
    phone_number: Optional[str] = ""

class OrderResponse(OrderCreate):
    id: int
    created_at: str

    class Config:
        from_attributes = True