"""
Script buat bikin database + tabel dari nol (untuk teman yang belum punya tabel).
Jalankan sekali saja: python init_db.py
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

load_dotenv()

db_user = os.getenv('DB_USER', 'postgres')
db_password = os.getenv('DB_PASSWORD', 'password')
db_host = os.getenv('DB_HOST', 'localhost')
db_port = os.getenv('DB_PORT', '5432')
db_name = os.getenv('DB_NAME', 'herbalyze_db')

def create_database_if_not_exists():
    """Buat database herbalyze_db kalau belum ada."""
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database='postgres',  # connect ke default db dulu
            user=db_user,
            password=db_password
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s;",
            (db_name,)
        )
        if cur.fetchone() is None:
            cur.execute(f'CREATE DATABASE "{db_name}";')
            print(f"✅ Database '{db_name}' dibuat.")
        else:
            print(f"✅ Database '{db_name}' sudah ada.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"❌ Gagal buat database: {e}")
        sys.exit(1)

def create_tables():
    """Buat semua tabel (users, dll) lewat Flask-SQLAlchemy."""
    from app import app
    from models import db
    with app.app_context():
        db.create_all()
        print("✅ Semua tabel (users, herbal_diagnoses, herbal_symptoms, dll) sudah dibuat.")

if __name__ == '__main__':
    print("=" * 50)
    print("Setup Database Herbalyze")
    print("=" * 50)
    create_database_if_not_exists()
    create_tables()
    print("=" * 50)
    print("Selesai. Sekarang jalankan: python app.py")
    print("=" * 50)
