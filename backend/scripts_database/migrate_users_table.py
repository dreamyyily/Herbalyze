"""
Migration script to add missing columns to users table
Run this once to update your existing users table schema
"""

import os
from dotenv import load_dotenv
from flask import Flask
from models import db
import psycopg2

load_dotenv()

app = Flask(__name__)

# Database configuration
db_user = os.getenv('DB_USER', 'postgres')
db_password = os.getenv('DB_PASSWORD', 'password')
db_host = os.getenv('DB_HOST', 'localhost')
db_port = os.getenv('DB_PORT', '5432')
db_name = os.getenv('DB_NAME', 'herbalyze_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def migrate_users_table():
    """Add missing columns to users table if they don't exist"""
    try:
        with app.app_context():
            # Connect directly to PostgreSQL to run ALTER TABLE commands
            conn = psycopg2.connect(
                host=db_host,
                port=db_port,
                database=db_name,
                user=db_user,
                password=db_password
            )
            cursor = conn.cursor()
            
            print("=" * 60)
            print("Migrating users table...")
            print("=" * 60)
            
            # Fix: If old 'password' column exists and is NOT NULL, make it nullable
            # (App uses password_hash only; 'password' causes NotNullViolation)
            cursor.execute("""
                SELECT column_name, is_nullable 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='password';
            """)
            row = cursor.fetchone()
            if row:
                print("Found 'password' column, making it nullable (app uses password_hash)...")
                cursor.execute("""
                    ALTER TABLE users 
                    ALTER COLUMN password DROP NOT NULL;
                """)
                print("✅ password column is now nullable")
            
            # Check and add password_hash column
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='password_hash';
            """)
            if not cursor.fetchone():
                print("Adding password_hash column...")
                cursor.execute("""
                    ALTER TABLE users 
                    ADD COLUMN password_hash VARCHAR(256);
                """)
                print("✅ password_hash column added")
            else:
                print("✅ password_hash column already exists")
            
            # Check and add created_at column
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='created_at';
            """)
            if not cursor.fetchone():
                print("Adding created_at column...")
                cursor.execute("""
                    ALTER TABLE users 
                    ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
                """)
                print("✅ created_at column added")
            else:
                print("✅ created_at column already exists")
            
            # Check and add is_profile_complete column
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='is_profile_complete';
            """)
            if not cursor.fetchone():
                print("Adding is_profile_complete column...")
                cursor.execute("""
                    ALTER TABLE users 
                    ADD COLUMN is_profile_complete BOOLEAN DEFAULT FALSE;
                """)
                print("✅ is_profile_complete column added")
            else:
                print("✅ is_profile_complete column already exists")
            
            # Check and add role column
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='role';
            """)
            if not cursor.fetchone():
                print("Adding role column...")
                cursor.execute("""
                    ALTER TABLE users 
                    ADD COLUMN role VARCHAR(50) DEFAULT 'Pending';
                """)
                print("✅ role column added")
            else:
                print("✅ role column already exists")

            # Check and add nonce column
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='users' AND column_name='nonce';
            """)
            if not cursor.fetchone():
                print("Adding nonce column...")
                cursor.execute("""
                    ALTER TABLE users 
                    ADD COLUMN nonce VARCHAR(255);
                """)
                print("✅ nonce column added")
            else:
                print("✅ nonce column already exists")
            
            # Commit changes
            conn.commit()
            cursor.close()
            conn.close()
            
            print("=" * 60)
            print("✅ Migration completed successfully!")
            print("=" * 60)
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        if 'conn' in locals():
            conn.rollback()
            conn.close()

if __name__ == '__main__':
    migrate_users_table()
