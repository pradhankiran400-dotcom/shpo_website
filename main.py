from fastapi import FastAPI, Request,Depends,HTTPException
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from sqlalchemy import select
from schemas import PriceUpdate,ProductBase,ProductResponse,ProductCreate
import json
from database import engine,SessionLocal
import models


models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maa Bankeswari Rice Store")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

import json # File ke top par yeh hona zaroori hai

def sync_products_to_file(db: Session):
    try:

        result = db.execute(select(models.Product))
        products_from_db = result.scalars().all()

        products_list = []
        
        for product in products_from_db:
            products_list.append({
                "name": product.name,
                "category": product.category,
                "description": product.description,
                "price": product.price,
                "unit": product.unit,
                "image_path": product.image_path,
                "in_stock": product.in_stock,
                "badge": product.badge
            })
        
        with open("products.json", "w", encoding="utf-8") as f:
            json.dump(products_list, f, indent=4, ensure_ascii=False)
            
        print("Data successfully synced to products.json! 🚀")
        
    except Exception as e:
        print(f"Error syncing products to file: {e}")

@app.on_event("startup")
def startup_event():
    with SessionLocal() as db:
        sync_products_to_file(db)



# Mount directories for static files and product media
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/media", StaticFiles(directory="media"), name="media")

# Setup template engine
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
def read_home(request:Request , db:Session = Depends(get_db)):
    result = db.execute(select(models.Product))
    products_form_db = result.scalars().all()
    return templates.TemplateResponse(
        request=request,          
        name="home.html",         
        context={                 
            "shop_name": "Maa Bankeswari Rice Store", 
            "products": products_form_db
        }
    )

@app.put("/api/products/{product_id}/price")
def update_products(product_id:int, price_data: PriceUpdate,db: Session = Depends(get_db)):
    result = db.execute(select(models.Product).where(models.Product.id == product_id))
    product = result.scalars().first()

    if not product:
        raise HTTPException(status_code=404, detail="Product nahi mila!")
    
    product.price = price_data.price
    db .commit()
    db.refresh(product)
    return {"message": f"Price updated to ₹{product.price} successfully!"}

@app.post("/api/products/", response_model=ProductResponse)
def add_new_product(product_data: ProductCreate, db: Session = Depends(get_db)):
    

    new_product = models.Product(
        name=product_data.name,
        category=product_data.category,
        description=product_data.description,
        price=product_data.price,
        unit=product_data.unit,
        image_url=product_data.image_path,
        in_stock=product_data.in_stock,
        badge=product_data.badge
    )
    
    db.add(new_product)      
    db.commit()              
    db.refresh(new_product)  
    
    return new_product




