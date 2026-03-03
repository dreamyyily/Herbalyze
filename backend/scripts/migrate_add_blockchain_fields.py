import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from db import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE search_history ADD COLUMN blockchain_tx_hash VARCHAR(66)"))
            print("[OK] Kolom blockchain_tx_hash berhasil ditambahkan")
        except Exception as e:
            print(f"[SKIP] blockchain_tx_hash sudah ada atau error: {e}")
        try:
            conn.execute(text("ALTER TABLE search_history ADD COLUMN blockchain_record_id INTEGER"))
            print("[OK] Kolom blockchain_record_id berhasil ditambahkan")
        except Exception as e:
            print(f"[SKIP] blockchain_record_id sudah ada atau error: {e}")
        try:
            conn.execute(text("ALTER TABLE search_history ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE"))
            print("[OK] Kolom is_deleted berhasil ditambahkan")
        except Exception as e:
            print(f"[SKIP] is_deleted sudah ada atau error: {e}")

        conn.commit()
        print("\n[DONE] Migrasi selesai! Tabel search_history sudah diperbarui.")

if __name__ == "__main__":
    migrate()
