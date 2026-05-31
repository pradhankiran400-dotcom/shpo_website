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
            print(f"  ✓ SKIP   — '{m['label']}' already exists")
        else:
            cur.execute(m["sql"])
            conn.commit()
            print(f"  ✔ ADDED  — '{m['label']}' column added successfully")

    print("\nAll migrations complete.")
    conn.close()

if __name__ == "__main__":
    run_migrations()
