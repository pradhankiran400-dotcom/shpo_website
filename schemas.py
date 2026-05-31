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

