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
    """Buat semua tabel lewat Flask-SQLAlchemy tanpa butuh app.py"""
    from flask import Flask
    from models import db
    
    # Bikin aplikasi Flask "bohongan" (dummy) khusus untuk menjalankan SQLAlchemy
    dummy_app = Flask(__name__)
    dummy_app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    dummy_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(dummy_app)
    
    with dummy_app.app_context():
        db.create_all()
        print("✅ Semua tabel (termasuk search_history) sudah dibuat secara mandiri.")
        
if __name__ == '__main__':
    print("=" * 50)
    print("Setup Database Herbalyze")
    print("=" * 50)
    create_database_if_not_exists()
    create_tables()
    print("=" * 50)