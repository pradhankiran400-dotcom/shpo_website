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
from typing import Optional
from data.settings_manager import load_settings, save_settings, get_effective_gemini_key

class SettingsUpdate(BaseModel):
    gemini_api_key: Optional[str] = None
    ai_verification_enabled: Optional[bool] = None
    store_upi_id: Optional[str] = None

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
                "fullname": user.fullname,
                "phone_number": user.phone_number
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
                "receipt_image_url": order.receipt_image_url,
                "phone_number": order.phone_number,
                "ai_forensics_json": order.ai_forensics_json,
                "delivery_lat": order.delivery_lat,
                "delivery_lng": order.delivery_lng
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
        # Check if products table is empty
        product_exists = db.execute(select(models.Product)).scalars().first()
        if not product_exists:
            print("Database is empty! Seeding products from products.json...")
            if os.path.exists("products.json"):
                try:
                    with open("products.json", "r", encoding="utf-8") as f:
                        products_data = json.load(f)
                        for p in products_data:
                            new_prod = models.Product(
                                name=p.get("name"),
                                category=p.get("category"),
                                description=p.get("description"),
                                price=p.get("price"),
                                unit=p.get("unit", "kg"),
                                image_url=p.get("image_path"),
                                in_stock=p.get("in_stock", True),
                                badge=p.get("badge")
                            )
                            db.add(new_prod)
                        db.commit()
                        print(f"Successfully seeded {len(products_data)} products to database!")
                except Exception as e:
                    print(f"Error seeding database: {e}")
        else:
            # Sync products to file only if database has products
            sync_products_to_file(db)
            
        # Also seed default users if users table is empty
        user_exists = db.execute(select(models.User)).scalars().first()
        if not user_exists:
            print("Users table is empty! Seeding users from users.json...")
            if os.path.exists("users.json"):
                try:
                    with open("users.json", "r", encoding="utf-8") as f:
                        users_data = json.load(f)
                        for u in users_data:
                            new_usr = models.User(
                                username=u.get("username"),
                                email=u.get("email"),
                                hashed_password=hash_password("MaaBankeswari@2026"), # Set a secure default passcode
                                fullname=u.get("fullname"),
                                phone_number=u.get("phone_number", "")
                            )
                            db.add(new_usr)
                        db.commit()
                        print(f"Successfully seeded {len(users_data)} users!")
                except Exception as e:
                    print(f"Error seeding users: {e}")
        else:
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


@app.get("/api/settings")
def get_settings():
    settings = load_settings()
    masked_key = ""
    raw_key = settings.get("gemini_api_key", "")
    if raw_key:
        if len(raw_key) > 8:
            masked_key = f"{raw_key[:4]}...{raw_key[-4:]}"
        else:
            masked_key = "****"
    return {
        "gemini_api_key": masked_key,
        "ai_verification_enabled": settings.get("ai_verification_enabled", True),
        "store_upi_id": settings.get("store_upi_id", "9078445116@ybl")
    }

@app.post("/api/settings")
def update_settings(settings_data: SettingsUpdate):
    success = save_settings(settings_data.dict(exclude_unset=True))
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save settings!")
    return {"message": "Settings saved successfully!"}


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
    db.commit()
    db.refresh(product)
    sync_products_to_file(db)
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
    sync_products_to_file(db)
    
    return new_product


def make_http_post(url: str, json_data: dict, headers: dict) -> bytes:
    import json
    data = json.dumps(json_data).encode("utf-8")
    try:
        import requests
        resp = requests.post(url, json=json_data, headers=headers, timeout=25)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        print(f"[SETTINGS HTTP POST WARNING]: Failed to use 'requests' library, falling back to 'urllib': {e}")
        import urllib.request
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=25) as response:
            return response.read()

def analyze_receipt_with_gemini(image_path: str, api_key: str) -> dict:
    import base64
    import json
    
    # Detect mime type
    mime_type = "image/png"
    if image_path.lower().endswith((".jpg", ".jpeg")):
        mime_type = "image/jpeg"
    elif image_path.lower().endswith(".webp"):
        mime_type = "image/webp"
        
    with open(image_path, "rb") as f:
        img_bytes = f.read()
        
    b64_data = base64.b64encode(img_bytes).decode("utf-8")
    
    # Call Gemini REST API
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    system_prompt = (
        "You are an expert digital forensics examiner specializing in identifying fake, forged, or edited "
        "mobile screenshots of UPI payment receipts (such as Google Pay, PhonePe, Paytm, BHIM, bank apps, etc.). "
        "Your task is to visually analyze the screenshot and determine if it has been manipulated (Photoshopped, "
        "digitally stitched, generated using a fake receipt app/website) or if it is an authentic original screenshot.\n\n"
        "Return a JSON object STRICTLY matching this schema:\n"
        "{\n"
        "  \"is_authentic\": boolean,\n"
        "  \"confidence_score\": float (between 0.0 and 1.0),\n"
        "  \"payment_app\": string (e.g. 'Google Pay', 'PhonePe', 'Paytm', 'BHIM', 'Unknown'),\n"
        "  \"detected_amount\": float,\n"
        "  \"detected_utr\": string (12-digit transaction ID or UTR number as a string),\n"
        "  \"detected_timestamp\": string (date and time formatted as standard text),\n"
        "  \"receiver_upi_id\": string (receiver UPI address if visible),\n"
        "  \"tampering_indicators\": [string] (list of specific visual anomalies, misalignments, abnormal text compression, font mismatches, etc.),\n"
        "  \"forensic_analysis_details\": string (clear detailed explanation of your visual scan findings)\n"
        "}\n\n"
        "Key aspects to visually evaluate:\n"
        "1. Font Consistency: Check if the transaction amount, UTR, and timestamp text match the exact font typeface, weight, size, and blurriness of surrounding text. Fake receipts generated by web generators or edit tools almost always show slight typeface/blur variations.\n"
        "2. Alignment & Spacing: Check for misalignment, crooked baseline angles, or inconsistent margins of text elements relative to the app UI lines.\n"
        "3. Compression Artifacts / Stitching: Scan closely for digital halos, blur blocks, pixelation differences, or color mismatches around numbers and text blocks (indicating copy-pasting or text erasing).\n"
        "4. Layout Legitimacy: Check if the layout perfectly conforms to real transaction receipt interfaces of Google Pay, PhonePe, Paytm, or BHIM. Spot fake layouts generated by known receipt mockups (which often miss dynamic elements, status ticks, or have incorrect headers).\n"
        "5. Transaction Success: Ensure the receipt clearly displays that the payment is successful/completed, not failed, pending, or in draft status."
    )
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": b64_data
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    response_bytes = make_http_post(url, payload, headers)
    response_json = json.loads(response_bytes.decode("utf-8"))
    
    if "error" in response_json:
        error_info = response_json["error"]
        raise Exception(f"Gemini API returned error: {error_info.get('message', 'Unknown error')} (code: {error_info.get('code')})")
        
    if "candidates" not in response_json or not response_json["candidates"]:
        raise Exception(f"Gemini response has no candidates: {json.dumps(response_json)}")
        
    # Parse text from candidate response
    candidate = response_json["candidates"][0]
    part_text = candidate["content"]["parts"][0]["text"]
    
    # Clean possible markdown wrapping blocks (like ```json ... ```)
    clean_text = part_text.strip()
    if clean_text.startswith("```"):
        # Strip starting block
        clean_text = clean_text.split("```", 1)[1]
        if clean_text.startswith("json"):
            clean_text = clean_text.split("json", 1)[1]
        # Strip ending block
        if clean_text.endswith("```"):
            clean_text = clean_text.rsplit("```", 1)[0]
    
    result = json.loads(clean_text.strip())
    return result


@app.post("/api/orders/", response_model=OrderResponse)
def create_new_order(order_data: OrderCreate, db: Session = Depends(get_db)):
    if not order_data.user_id:
        raise HTTPException(status_code=401, detail="Please sign in or register to place your order! 🌾")
    
    # Verify user exists in the database
    user = db.execute(select(models.User).where(models.User.id == order_data.user_id)).scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user session. Please sign in or register to place your order! 🌾")

    # ----------------------------------------------------
    # LOCAL PYTHON OCR RECEIPT AMOUNT VALIDATION
    # ----------------------------------------------------
    ai_forensics_json_str = None

    # ----------------------------------------------------
    # UPI RECEIPT FORENSICS & VERIFICATION (GEMINI AI + FALLBACK)
    # ----------------------------------------------------
    if order_data.payment_method == "UPI" and order_data.receipt_image_url:
        relative_path = order_data.receipt_image_url.lstrip("/")
        if os.path.exists(relative_path):
            gemini_api_key = get_effective_gemini_key()
            settings = load_settings()
            ai_enabled = settings.get("ai_verification_enabled", True)
            
            gemini_verified = False
            
            # --- PHASE A: GEMINI AI VISUAL FORENSICS SCAN ---
            if gemini_api_key and ai_enabled:
                print(f"[AI RECEIPT FORENSICS]: Launching Gemini Visual Analysis on '{relative_path}'...")
                try:
                    report = analyze_receipt_with_gemini(relative_path, gemini_api_key)
                    print(f"[AI FORENSICS REPORT RECEIVED]: {json.dumps(report, indent=2)}")
                    
                    # 1. Verify visual authenticity
                    is_authentic = report.get("is_authentic", True)
                    confidence = report.get("confidence_score", 1.0)
                    
                    if not is_authentic and confidence > 0.65:
                        anomalies = report.get("tampering_indicators", [])
                        reason = report.get("forensic_analysis_details", "Image forgery detected by AI scan.")
                        error_msg = (
                            f"AI Forensics Alert: Digital manipulation or forgery detected in receipt screenshot! "
                            f"(Confidence: {int(confidence*100)}%). Anomalies found: {', '.join(anomalies) if anomalies else 'Edited text font/boundaries'}. "
                            f"Details: {reason}. Edited or mock receipts are strictly blocked! Please complete an authentic transaction and upload a fresh, unedited payment screenshot."
                        )
                        print(f"[AI SECURITY BLOCKED]: Forgery detected! Indicators: {anomalies}")
                        raise HTTPException(status_code=400, detail=error_msg)
                    
                    # 2. Extract and match amount
                    detected_amount = report.get("detected_amount")
                    target_amount = order_data.total_price
                    
                    if detected_amount is not None:
                        try:
                            amt_val = float(detected_amount)
                            if abs(amt_val - target_amount) > 1.00:
                                error_msg = (
                                    f"AI Verification Failed: The transaction amount extracted by AI (Rs. {amt_val:.2f}) "
                                    f"does not match your order total of Rs. {target_amount:.2f}! "
                                    f"Please upload the correct payment screenshot matching this order total."
                                )
                                print(f"[AI AMOUNT MISMATCH]: Extracted Rs. {amt_val:.2f} vs Order Rs. {target_amount:.2f}")
                                raise HTTPException(status_code=400, detail=error_msg)
                        except ValueError:
                            pass
                            
                    # 3. Check UTR deduplication
                    detected_utr = str(report.get("detected_utr") or "").strip()
                    if detected_utr and len(detected_utr) >= 8:
                        # Normalize UTR
                        import re
                        detected_utr = re.sub(r'\D', '', detected_utr)
                        if len(detected_utr) >= 12:
                            detected_utr = detected_utr[:12]
                            
                        print(f"[AI UTR EXTRACTED]: {detected_utr}")
                        registry_file = "used_utrs.txt"
                        used_utrs = []
                        if os.path.exists(registry_file):
                            with open(registry_file, "r", encoding="utf-8") as f:
                                used_utrs = [line.strip() for line in f.readlines() if line.strip()]
                                
                        if detected_utr in used_utrs:
                            error_msg = (
                                f"AI Security Alert: This transaction UTR / Ref ID: {detected_utr} has already "
                                f"been used for a prior order! Reusing transaction screenshots is strictly prohibited. "
                                f"Please upload a fresh, valid payment screenshot."
                            )
                            print(f"[AI UTR DUPLICATE]: Blocked reuse of UTR {detected_utr}")
                            raise HTTPException(status_code=400, detail=error_msg)
                            
                        # Save unique UTR to registry file
                        with open(registry_file, "a", encoding="utf-8") as f:
                            f.write(detected_utr + "\n")
                            
                    # Visual analysis successful!
                    ai_forensics_json_str = json.dumps(report)
                    gemini_verified = True
                    print("[AI FORENSICS VERIFICATION SUCCESSFUL]: Receipt verified authentic by Gemini.")
                    
                except HTTPException:
                    raise
                except Exception as gemini_err:
                    print(f"\n[AI FORENSICS ERROR]: Failed to analyze receipt with Gemini API: {gemini_err}")
                    print("Falling back to local OCR and metadata scan...\n")
            
            # --- PHASE B: LOCAL OCR & EXIF SCAN FALLBACK ---
            if not gemini_verified:
                try:
                    from PIL import Image
                    import re
                    import shutil

                    # Aspect Ratio check
                    img = Image.open(relative_path)
                    width, height = img.size
                    print(f"[LOCAL SECURITY FORENSICS]: Verifying image dimensions: {width}x{height}")
                    if width >= height:
                        error_msg = (
                            "Security Verification Failed: The uploaded receipt image appears to be in landscape or square format. "
                            "UPI payment screenshots (Google Pay, PhonePe, Paytm, etc.) must be vertical portrait mobile screenshots. "
                            "Please upload a full, unedited mobile screenshot of your payment receipt."
                        )
                        print(f"[LOCAL SECURITY ALERT]: Blocked receipt due to landscape dimensions ({width}x{height})")
                        raise HTTPException(status_code=400, detail=error_msg)

                    # Metadata Editor check
                    is_edited = False
                    editor_signature = ""
                    try:
                        exif_data = img._getexif()
                        if exif_data:
                            from PIL.ExifTags import TAGS
                            for tag, value in exif_data.items():
                                tag_name = TAGS.get(tag, tag)
                                if tag_name in ("Software", "ImageHistory", "ProcessingSoftware", "Artist"):
                                    val_str = str(value).lower()
                                    suspicious_editors = [
                                        "photoshop", "picsart", "pixellab", "canva", "gimp", 
                                        "lightroom", "snapseed", "phonto", "editor", "paint.net"
                                    ]
                                    for editor in suspicious_editors:
                                        if editor in val_str:
                                            is_edited = True
                                            editor_signature = f"{tag_name}: {value}"
                                            break
                    except Exception as ex_err:
                        print(f"[METADATA SCAN WARNING]: Could not read EXIF tags: {ex_err}")

                    if is_edited:
                        error_msg = (
                            f"Security Alert: Digital forensics scan detected that this receipt has been saved or modified "
                            f"using image editing software ({editor_signature}). "
                            f"To protect against fraud, edited receipts are strictly blocked! "
                            f"Please upload an authentic, direct, unedited screenshot of your UPI app transaction page."
                        )
                        print(f"[LOCAL SECURITY ALERT]: Blocked edited receipt. Editing signature: {editor_signature}")
                        raise HTTPException(status_code=400, detail=error_msg)

                    # Pytesseract OCR Verification
                    import pytesseract
                    if not shutil.which("tesseract"):
                        std_win_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
                        if os.path.exists(std_win_path):
                            pytesseract.pytesseract.tesseract_cmd = std_win_path

                    ocr_text = pytesseract.image_to_string(img)
                    print("\n[LOCAL OCR PROCESSING] UPI Receipt Screenshot:")
                    print("--------------------------------------------------")
                    print(ocr_text.strip()[:600])
                    print("--------------------------------------------------")

                    ocr_lower = ocr_text.lower()
                    upi_keywords = [
                        "upi", "transaction", "utr", "ref", "completed", "success", "paid",
                        "transferred", "google pay", "gpay", "phonepe", "paytm", "bhim", "sbi",
                        "hdfc", "icici", "sent", "successful", "debited", "bank", "payment"
                    ]
                    has_upi_keywords = any(kw in ocr_lower for kw in upi_keywords)
                    if not has_upi_keywords:
                        no_spaces_lower = re.sub(r'\s+', '', ocr_lower)
                        has_upi_keywords = any(kw in no_spaces_lower for kw in upi_keywords)

                    if not has_upi_keywords:
                        error_msg = (
                            "Security Verification Failed: The uploaded image does not appear to be a valid mobile "
                            "UPI payment receipt. No payment transaction markers (e.g. UPI, UTR, Success, PhonePe, Paytm, GPay) "
                            "were found in the image. Please upload an authentic, direct transaction status screenshot."
                        )
                        print("[LOCAL SECURITY ALERT]: Blocked image. No UPI payment receipt keywords found in OCR text.")
                        raise HTTPException(status_code=400, detail=error_msg)

                    # UTR deduplication
                    utrs = re.findall(r'\b\d{12}\b', ocr_text)
                    if not utrs:
                        no_spaces = re.sub(r'[\s\.\-]+', '', ocr_text)
                        utrs = re.findall(r'\b\d{12}\b', no_spaces)

                    detected_utr = None
                    if utrs:
                        detected_utr = utrs[0]
                        print(f"[LOCAL UTR DETECTED]: Found UPI Transaction ID / UTR: {detected_utr}")
                        
                        registry_file = "used_utrs.txt"
                        used_utrs = []
                        if os.path.exists(registry_file):
                            with open(registry_file, "r", encoding="utf-8") as f:
                                used_utrs = [line.strip() for line in f.readlines() if line.strip()]
                        
                        if detected_utr in used_utrs:
                            error_msg = (
                                f"Security Alert: This payment transaction (UTR / Ref ID: {detected_utr}) has already "
                                f"been used for a prior order! Reusing transaction receipts is strictly prohibited."
                            )
                            print(f"[LOCAL SECURITY ALERT]: Duplicate UTR attempt blocked: {detected_utr}")
                            raise HTTPException(status_code=400, detail=error_msg)

                    # Amount verification
                    target_amount = order_data.total_price
                    target_str = f"{target_amount:.2f}"
                    target_int = str(int(target_amount))

                    cleaned_text = ocr_text.replace(",", "")
                    cleaned_decimals = re.findall(r'\d+\.\d{2}', cleaned_text)
                    
                    matched = False
                    matched_val = ""

                    if target_str in ocr_text or target_str in cleaned_text:
                        matched = True
                        matched_val = target_str
                    else:
                        for dec_str in cleaned_decimals:
                            try:
                                val = float(dec_str)
                                if abs(val - target_amount) <= 1.00:
                                    matched = True
                                    matched_val = dec_str
                                    break
                            except ValueError:
                                continue

                    if not matched and len(target_int) >= 2:
                        if target_int in ocr_text or target_int in cleaned_text:
                            matched = True
                            matched_val = target_int

                    if not matched:
                        error_msg = (
                            f"Verification Failed: The transaction amount extracted from "
                            f"your uploaded UPI receipt does not match your order total of Rs. {target_amount:.2f}! "
                            f"Please ensure you uploaded the correct payment receipt screenshot and try again."
                        )
                        print(f"[LOCAL OCR MISMATCH]: Extracted text did not contain Rs. {target_amount:.2f}")
                        raise HTTPException(status_code=400, detail=error_msg)
                    
                    print(f"[LOCAL OCR VERIFICATION SUCCESSFUL]: Matched value {matched_val} with total Rs. {target_amount:.2f}\n")

                    if detected_utr:
                        registry_file = "used_utrs.txt"
                        with open(registry_file, "a", encoding="utf-8") as f:
                            f.write(detected_utr + "\n")
                        print(f"[LOCAL UTR REGISTERED]: Added transaction ID {detected_utr} to used_utrs.txt registry.")

                    # Build a structured JSON forensics block for the local OCR pass
                    local_report = {
                        "is_authentic": True,
                        "confidence_score": 1.0,
                        "payment_app": "Local OCR Verified",
                        "detected_amount": target_amount,
                        "detected_utr": detected_utr or "Unknown UTR",
                        "detected_timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "receiver_upi_id": "N/A",
                        "tampering_indicators": [],
                        "forensic_analysis_details": "Verified via standard local OCR. Configure Gemini API key for visual forensics scanner."
                    }
                    ai_forensics_json_str = json.dumps(local_report)

                except ImportError:
                    print("\n[LOCAL OCR WARNING]: 'pytesseract' or 'PIL' is not installed locally.")
                    print("Running in Smart Simulation Mode...\n")
                except pytesseract.TesseractNotFoundError:
                    print("\n[LOCAL OCR WARNING]: Tesseract OCR engine binaries are not installed on the system path.")
                    print("Running in Smart Simulation Mode...\n")
                except HTTPException:
                    raise
                except Exception as e:
                    print(f"\n[LOCAL OCR ERROR]: Unexpected error parsing receipt screenshot: {e}")
                    print("Running in Smart Simulation Mode...\n")
        else:
            print(f"\n[LOCAL OCR WARNING]: Uploaded receipt path '{relative_path}' not found on disk.")

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
        receipt_image_url=order_data.receipt_image_url,
        phone_number=order_data.phone_number,
        ai_forensics_json=ai_forensics_json_str,
        delivery_lat=order_data.delivery_lat,
        delivery_lng=order_data.delivery_lng
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
    print(f"Customer Phone Number: {new_order.phone_number}")
    print(f"Items Details: {new_order.items_json}\n")
    
    return new_order


@app.get("/api/orders/")
def get_all_orders(db: Session = Depends(get_db)):
    result = db.execute(select(models.Order))
    return result.scalars().all()


@app.get("/api/users/")
def get_all_users(db: Session = Depends(get_db)):
    result = db.execute(select(models.User))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "email": u.email, "fullname": u.fullname, "phone_number": u.phone_number} for u in users]


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
        fullname=user_data.fullname,
        phone_number=user_data.phone_number
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


class ChatMessage(BaseModel):
    role: str
    parts: str

class ChatbotInput(BaseModel):
    message: str
    history: list[ChatMessage] = []

def get_products_context(db: Session) -> str:
    result = db.execute(select(models.Product))
    products = result.scalars().all()
    lines = []
    for p in products:
        stock_status = "In Stock" if p.in_stock else "Out of Stock"
        badge_str = f" ({p.badge})" if p.badge else ""
        lines.append(f"- {p.name}{badge_str}: ₹{p.price} per {p.unit} ({stock_status}) - {p.description}")
    return "\n".join(lines)

@app.post("/api/chatbot")
def chatbot_endpoint(chat_input: ChatbotInput, db: Session = Depends(get_db)):
    api_key = get_effective_gemini_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Gemini API key not configured.")
        
    products_context = get_products_context(db)
    
    system_prompt = (
        "You are Laxmi, the friendly, helpful, and smart store assistant for 'Maa Bankeswari Rice Store'. "
        "Your goal is to guide customers, help them choose the perfect grains/dals, explain the ordering process, "
        "and provide accurate store details.\n\n"
        "Store Information:\n"
        "- Name: Maa Bankeswari Rice Store\n"
        "- Location: Indradhanu Market, IRC Village, Nayapalli, Bhubaneswar, Odisha 751015\n"
        "- Contact: +91 9776400523 (Call) / +91 9078445116 (WhatsApp)\n"
        "- Delivery Charge: ₹2.00 per kilometer (Calculated dynamically using Leaflet Map at checkout, max 20 km radius)\n"
        "- Payment Options: Cash on Delivery (COD) and UPI Online Payment. If UPI is selected, the customer scans the dynamic QR code and uploads a receipt screenshot. Our AI scanner verifies the receipt for authenticity and matches the order amount to prevent fraud.\n"
        "- Ordering Process: 1. Add items to cart. 2. Click 'My Cart' at the top right. 3. Click 'Proceed to Checkout'. 4. Pin delivery location on the Map. 5. Choose Payment Method (UPI/COD). 6. Click 'Verify & Place Order'.\n\n"
        "Here is the list of products currently available in our database:\n"
        f"{products_context}\n\n"
        "Instructions:\n"
        "1. Keep your answers concise, sweet, and helpful. Use polite greetings (e.g. Namaste! 🙏).\n"
        "2. Bold key terms using standard markdown (e.g. **basmati rice**).\n"
        "3. If a product is not in the list, politely say we don't stock it currently, but recommend the closest alternative.\n"
        "4. Be ready to answer questions about grain selection, cooking tips, or store policies.\n"
        "5. Respond in clear, readable language. Do NOT use overly formal or robotic words."
    )
    
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
    headers = {"Content-Type": "application/json"}
    
    # Format contents for Gemini API (user/model turn structure)
    contents = []
    # Add history
    for item in chat_input.history:
        role = "user" if item.role == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": item.parts}]
        })
    # Add current message
    contents.append({
        "role": "user",
        "parts": [{"text": chat_input.message}]
    })
    
    payload = {
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": system_prompt}]
        },
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 350
        }
    }
    
    try:
        response_bytes = make_http_post(url, payload, headers)
        response_json = json.loads(response_bytes.decode("utf-8"))
        
        if "error" in response_json:
            raise Exception(response_json["error"].get("message", "Unknown error"))
            
        candidate = response_json["candidates"][0]
        reply = candidate["content"]["parts"][0]["text"]
        return {"reply": reply}
    except Exception as e:
        print(f"[CHATBOT API ERROR]: {e}")
        raise HTTPException(status_code=500, detail=str(e))





