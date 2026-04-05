import os
from dotenv import load_dotenv
import psycopg2

load_dotenv()

db_user = os.getenv('DB_USER', 'postgres')
db_password = os.getenv('DB_PASSWORD', 'password')
db_host = os.getenv('DB_HOST', 'localhost')
db_port = os.getenv('DB_PORT', '5432')
db_name = os.getenv('DB_NAME', 'herbalyze_db')

def migrate_users_table():
    try:
        conn = psycopg2.connect(
            host=db_host,
            port=db_port,
            database=db_name,
            user=db_user,
            password=db_password
        )
        cursor = conn.cursor()
        
        print("=" * 60)
        print("Migrating users table - Adding IPFS CID columns...")
        print("=" * 60)

        cid_columns = [
            ("dokumen_str_path", "TEXT"),     
            ("dokumen_sip_path", "TEXT"),    
            ("dokumen_verified", "BOOLEAN DEFAULT FALSE"),
            ("dokumen_verified_at", "TIMESTAMP"),
        ]

        for nama_kolom, tipe in cid_columns:
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name='users' AND column_name=%s
            """, (nama_kolom,))
            
            if cursor.fetchone():
                print(f"✅ Kolom '{nama_kolom}' sudah ada.")
            else:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {nama_kolom} {tipe};")
                print(f"✅ Kolom '{nama_kolom}' berhasil ditambahkan.")

        kolom_lama = [
            ("password_hash",       "VARCHAR(256)"),
            ("created_at",          "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("is_profile_complete", "BOOLEAN DEFAULT FALSE"),
            ("role",                "VARCHAR(50) DEFAULT 'Pending'"),
            ("nonce",               "VARCHAR(255)"),
        ]

        kolom_baru = [
            ("nik",           "VARCHAR(20)"),
            ("tempat_lahir",  "VARCHAR(100)"),
            ("tanggal_lahir", "VARCHAR(20)"),
            ("nomor_hp",      "VARCHAR(20)"),
            ("jenis_kelamin", "VARCHAR(20)"),
            ("alergi_herbal", "JSON"),
            ("foto_profil",   "TEXT"),
            ("instansi_lama", "VARCHAR(255)"),
            ("instansi_baru", "VARCHAR(255)"),
        ]

        for nama_kolom, tipe in kolom_lama + kolom_baru:
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name='users' AND column_name=%s
            """, (nama_kolom,))
            
            if cursor.fetchone():
                print(f"✅ Kolom '{nama_kolom}' sudah ada.")
            else:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {nama_kolom} {tipe};")
                print(f"✅ Kolom '{nama_kolom}' berhasil ditambahkan.")

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