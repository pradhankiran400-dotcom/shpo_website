"""
migrate.py — Maa Bankeswari Rice Store
Run once to bring your existing shop.db schema up to date.
Safe to run multiple times (skips already-existing columns).

Usage:
    python migrate.py
"""

import sqlite3

DB_PATH = "./shop.db"

MIGRATIONS = [
    # Add user_id to orders (missing from initial schema)
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='user_id'",
        "sql":   "ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id)",
        "label": "orders.user_id"
    },
    # Add delivery_address to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='delivery_address'",
        "sql":   "ALTER TABLE orders ADD COLUMN delivery_address TEXT",
        "label": "orders.delivery_address"
    },
    # Add distance_km to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='distance_km'",
        "sql":   "ALTER TABLE orders ADD COLUMN distance_km REAL",
        "label": "orders.distance_km"
    },
    # Add delivery_charge to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='delivery_charge'",
        "sql":   "ALTER TABLE orders ADD COLUMN delivery_charge REAL",
        "label": "orders.delivery_charge"
    },
    # Add payment_method to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='payment_method'",
        "sql":   "ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'COD'",
        "label": "orders.payment_method"
    },
    # Add order_status to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='order_status'",
        "sql":   "ALTER TABLE orders ADD COLUMN order_status TEXT DEFAULT 'Pending Approval'",
        "label": "orders.order_status"
    },
    # Add receipt_image_url to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='receipt_image_url'",
        "sql":   "ALTER TABLE orders ADD COLUMN receipt_image_url TEXT",
        "label": "orders.receipt_image_url"
    },
    # Add phone_number to users
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='phone_number'",
        "sql":   "ALTER TABLE users ADD COLUMN phone_number TEXT DEFAULT ''",
        "label": "users.phone_number"
    },
    # Add phone_number to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='phone_number'",
        "sql":   "ALTER TABLE orders ADD COLUMN phone_number TEXT DEFAULT ''",
        "label": "orders.phone_number"
    },
    # Add ai_forensics_json to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='ai_forensics_json'",
        "sql":   "ALTER TABLE orders ADD COLUMN ai_forensics_json TEXT",
        "label": "orders.ai_forensics_json"
    },
    # Add delivery_lat to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='delivery_lat'",
        "sql":   "ALTER TABLE orders ADD COLUMN delivery_lat REAL",
        "label": "orders.delivery_lat"
    },
    # Add delivery_lng to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='delivery_lng'",
        "sql":   "ALTER TABLE orders ADD COLUMN delivery_lng REAL",
        "label": "orders.delivery_lng"
    },
    # Add delivery_time_mins to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='delivery_time_mins'",
        "sql":   "ALTER TABLE orders ADD COLUMN delivery_time_mins INTEGER DEFAULT 10",
        "label": "orders.delivery_time_mins"
    },
    # Add delivery_boy_lat to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='delivery_boy_lat'",
        "sql":   "ALTER TABLE orders ADD COLUMN delivery_boy_lat REAL",
        "label": "orders.delivery_boy_lat"
    },
    # Add delivery_boy_lng to orders
    {
        "check": "SELECT COUNT(*) FROM pragma_table_info('orders') WHERE name='delivery_boy_lng'",
        "sql":   "ALTER TABLE orders ADD COLUMN delivery_boy_lng REAL",
        "label": "orders.delivery_boy_lng"
    },
]

def run_migrations():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print(f"Connected to {DB_PATH}")
    print("Running migrations...\n")

    for m in MIGRATIONS:
        cur.execute(m["check"])
        exists = cur.fetchone()[0]
        if exists:
            print(f"  SKIP: '{m['label']}' already exists")
        else:
            cur.execute(m["sql"])
            conn.commit()
            print(f"  ADDED: '{m['label']}' column added successfully")

    print("\nAll migrations complete.")
    conn.close()

if __name__ == "__main__":
    run_migrations()
