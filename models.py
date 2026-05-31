from sqlalchemy import Column, Integer, String, Float, Boolean
from database import Base

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