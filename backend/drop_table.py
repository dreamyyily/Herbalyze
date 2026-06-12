from db import engine
from sqlalchemy import text

def drop_search_history_table():
    print("Mencoba drop tabel search_history...")
    try:
        with engine.connect() as conn:
            conn.execute(text("DROP TABLE IF EXISTS search_history"))
            conn.commit()
        print("✅ Tabel search_history berhasil dihapus dari database.")
    except Exception as e:
        print(f"❌ Gagal drop tabel: {e}")

if __name__ == "__main__":
    drop_search_history_table()
