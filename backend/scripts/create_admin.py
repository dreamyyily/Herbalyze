import psycopg2
from passlib.context import CryptContext
from dotenv import load_dotenv
import os

load_dotenv()
DB_USER = os.getenv('DB_USER', 'postgres')
DB_PASSWORD = os.getenv('DB_PASSWORD', '12345')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'db_herbal_ta')

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
pw_hash = pwd_context.hash('admin123')

try:
    conn = psycopg2.connect(f'dbname={DB_NAME} user={DB_USER} password={DB_PASSWORD} host={DB_HOST} port={DB_PORT}')
    cur = conn.cursor()
    # Check if admin already exists
    cur.execute("SELECT id FROM users WHERE email = 'admin@herbalyze.com'")
    result = cur.fetchone()
    if result:
        cur.execute("UPDATE users SET role = 'Admin', password_hash = %s WHERE email = 'admin@herbalyze.com'", (pw_hash,))
    else:
        cur.execute("INSERT INTO users (name, email, password_hash, role) VALUES ('Administrator', 'admin@herbalyze.com', %s, 'Admin')", (pw_hash,))
    
    conn.commit()
    print('Admin user inserted and ready. Email: admin@herbalyze.com | Password: admin123')
    cur.close()
    conn.close()
except Exception as e:
    print('Error:', e)
