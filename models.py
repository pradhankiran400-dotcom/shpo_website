from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True)
    hashed_password = Column(String)
    fullname = Column(String)


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    category = Column(String)
    description = Column(String)
    price = Column(Float)
    unit = Column(String, default="kg")
    image_url = Column(String) 
    in_stock = Column(Boolean, default=True)
    badge = Column(String, nullable=True)


    @property
    def image_path(self) -> str:
        if self.image_url:
            if self.image_url.startswith(("http://", "https://", "/", "static/", "media/")):
                return self.image_url
            return f"/media/profile_pics/{self.image_url}"
        return "media\profile_pics\premium_toor_dal.png"


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    items_json = Column(String)  # JSON formatted list of products
    total_price = Column(Float)
    created_at = Column(String)  # Timestamp
    delivery_address = Column(String, nullable=True)
    distance_km = Column(Float, nullable=True)
    delivery_charge = Column(Float, nullable=True)
    payment_method = Column(String, default="COD")
    order_status = Column(String, default="Pending Approval")