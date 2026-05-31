from fastapi import FastAPI, Request,Depends,HTTPException, File, UploadFile
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from sqlalchemy import select
from schemas import PriceUpdate,ProductBase,ProductResponse,ProductCreate,OrderCreate,OrderResponse,UserCreate,UserResponse,UserLogin
import json
from database import engine,SessionLocal
import models
from datetime import datetime
import hashlib
import os
import shutil


models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Maa Bankeswari Rice Store")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    salt = "maa_bankeswari_salt_2026"
    return hashlib.sha256((password + salt).encode("utf-8")).hexdigest()

def sync_users_to_file(db: Session):
    try:
        result = db.execute(select(models.User))
        users_from_db = result.scalars().all()
        users_list = []
        for user in users_from_db:
            users_list.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "fullname": user.fullname
            })
        with open("users.json", "w", encoding="utf-8") as f:
            json.dump(users_list, f, indent=4, ensure_ascii=False)
        print("Users successfully synced to users.json!")
    except Exception as e:
        print(f"Error syncing users to file: {e}")

def sync_orders_to_file(db: Session):
    try:
        result = db.execute(select(models.Order))
        orders_from_db = result.scalars().all()
        orders_list = []
        for order in orders_from_db:
            orders_list.append({
                "id": order.id,
                "user_id": order.user_id,
                "items": json.loads(order.items_json) if order.items_json else [],
                "total_price": order.total_price,
                "created_at": order.created_at,
                "delivery_address": order.delivery_address,
                "distance_km": order.distance_km,
                "delivery_charge": order.delivery_charge,
                "payment_method": order.payment_method,
                "order_status": order.order_status,
                "receipt_image_url": order.receipt_image_url
            })
        with open("orders.json", "w", encoding="utf-8") as f:
            json.dump(orders_list, f, indent=4, ensure_ascii=False)
        print("Orders successfully synced to orders.json!")
    except Exception as e:
        print(f"Error syncing orders to file: {e}")

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
        print("Products successfully synced to products.json!")
    except Exception as e:
        print(f"Error syncing products to file: {e}")

@app.on_event("startup")
def startup_event():
    with SessionLocal() as db:
        sync_products_to_file(db)
        sync_users_to_file(db)
        sync_orders_to_file(db)



# Mount directories for static files and product media
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/media", StaticFiles(directory="media"), name="media")

# Setup template engine
templates = Jinja2Templates(directory="templates")

from starlette.exceptions import HTTPException as StarletteHTTPException

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    title = f"Oops! Error {exc.status_code}"
    message = exc.detail
    
    if exc.status_code == 404:
        title = "Grain Variety Not Found!"
        message = "The requested kitchen counter or grain variety could not be found. Let's get you back to the main catalog!"
    elif exc.status_code == 500:
        title = "Internal Harvest Error!"
        message = "An unexpected error occurred in our systems. Please reload or go back to browse our catalog!"
        
    return templates.TemplateResponse(
        request=request,
        name="error.html",
        context={
            "status_code": exc.status_code,
            "error_title": title,
            "error_message": message
        },
        status_code=exc.status_code
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    print(f"[UNHANDLED EXCEPTION]: {str(exc)}")
    return templates.TemplateResponse(
        request=request,
        name="error.html",
        context={
            "status_code": 500,
            "error_title": "Internal Harvest Error!",
            "error_message": "An unexpected error occurred in our systems. Please reload or go back to browse our catalog!"
        },
        status_code=500
    )


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


@app.post("/api/orders/", response_model=OrderResponse)
def create_new_order(order_data: OrderCreate, db: Session = Depends(get_db)):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    new_order = models.Order(
        user_id=order_data.user_id,
        items_json=order_data.items_json,
        total_price=order_data.total_price,
        created_at=timestamp,
        delivery_address=order_data.delivery_address,
        distance_km=order_data.distance_km,
        delivery_charge=order_data.delivery_charge,
        payment_method=order_data.payment_method,
        order_status=order_data.order_status,
        receipt_image_url=order_data.receipt_image_url
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    
    # Sync SQLite to orders.json file
    sync_orders_to_file(db)
    
    # Print neat logs to local terminal for the shop administrator
    print(f"\n[NEW ORDER RECEIVED] (ID: {new_order.id}) at {timestamp}")
    print(f"Payment Method: {new_order.payment_method}")
    print(f"Order Status: {new_order.order_status}")
    if new_order.receipt_image_url:
        print(f"Receipt Image URL: {new_order.receipt_image_url}")
    print(f"Total Amount: Rs. {new_order.total_price:.2f}")
    if new_order.delivery_address:
        print(f"Delivery Address: {new_order.delivery_address}")
        print(f"Distance: {new_order.distance_km:.2f} km (Charge: Rs. {new_order.delivery_charge:.2f})")
    print(f"Items Details: {new_order.items_json}\n")
    
    return new_order


@app.get("/api/orders/")
def get_all_orders(db: Session = Depends(get_db)):
    result = db.execute(select(models.Order))
    return result.scalars().all()


@app.post("/api/register", response_model=UserResponse)
def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if username already exists
    existing_username = db.execute(select(models.User).where(models.User.username == user_data.username)).scalars().first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username is already taken!")
        
    # Check if email already exists
    existing_email = db.execute(select(models.User).where(models.User.email == user_data.email)).scalars().first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email is already registered!")

    # Salt and hash the password
    hashed_pwd = hash_password(user_data.password)

    new_user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=hashed_pwd,
        fullname=user_data.fullname
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Sync to users.json
    sync_users_to_file(db)

    return new_user


@app.post("/api/login", response_model=UserResponse)
def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.execute(select(models.User).where(models.User.username == login_data.username)).scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password!")

    # Check hashed password
    hashed_pwd = hash_password(login_data.password)
    if user.hashed_password != hashed_pwd:
        raise HTTPException(status_code=401, detail="Invalid username or password!")

    return user


@app.get("/api/users/{user_id}/orders", response_model=list[OrderResponse])
def get_user_orders(user_id: int, db: Session = Depends(get_db)):
    result = db.execute(select(models.Order).where(models.Order.user_id == user_id))
    return result.scalars().all()


class StatusUpdate(BaseModel):
    order_status: str


@app.put("/api/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status(order_id: int, status_data: StatusUpdate, db: Session = Depends(get_db)):
    result = db.execute(select(models.Order).where(models.Order.id == order_id))
    order = result.scalars().first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found!")
        
    order.order_status = status_data.order_status
    db.commit()
    db.refresh(order)
    
    # Sync to JSON
    sync_orders_to_file(db)
    
    print(f"[ORDER STATUS UPDATED] (ID: {order.id}) to {order.order_status}")
    return order


@app.post("/api/orders/upload-receipt")
def upload_receipt(file: UploadFile = File(...)):
    # Verify file is an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed!")
    
    # Save file in static/uploads/receipts/
    upload_dir = "static/uploads/receipts"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Clean/unique filename to prevent collision
    filename = f"{int(datetime.now().timestamp())}_{file.filename.replace(' ', '_')}"
    file_path = os.path.join(upload_dir, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
        
    return {"receipt_image_url": f"/static/uploads/receipts/{filename}"}


@app.get("/admin", response_class=HTMLResponse)
def get_admin_dashboard(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="admin.html",
        context={"shop_name": "Maa Bankeswari Rice Store - Admin Dashboard"}
    )





