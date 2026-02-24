import pandas as pd
import psycopg2
from sentence_transformers import SentenceTransformer
import chromadb
import os
from dotenv import load_dotenv

# Membaca variabel koneksi dari file .env
load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "12345")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_NAME = os.getenv("DB_NAME", "db_herbal_ta")

def extract_data_from_postgres():
    """
    (Extract) Mengekstrak data dari PostgreSQL dan mengubahnya menjadi Pandas DataFrame.
    Juga menangani missing values (NaN/Null).
    """
    conn = None
    try:
        print(f"Mencoba terhubung ke PostgreSQL ({DB_NAME} di {DB_HOST}:{DB_PORT})...")
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        
        # Script Query
        # Karena di instruksi disebutkan bahwa data "merupakan hasil JOIN dari 3 tabel",
        # kita bisa mengambil data ini menggunakan Query Aggregation (agar tidak terjadi redudansi row)
        # Atau mengubah kata "vw_herbal_joined_data" jika Anda sudah membuat View-nya di PGAdmin.
        query = """
            SELECT 
                COALESCE(s.symptom, '') as symptom, 
                COALESCE(d.diagnosis, '') as diagnosis, 
                COALESCE(c.description, '') as description, 
                COALESCE(s.herbal_name, d.herbal_name, c.herbal_name) as herbal_name, 
                COALESCE(s.latin_name, d.latin_name, c.latin_name) as latin_name, 
                COALESCE(s.preparation, d.preparation, '') as preparation, 
                COALESCE(s.part_used, d.part_used, '') as part_used, 
                COALESCE(c.special_condition, '') as special_condition
            FROM herbal_symptoms s
            FULL OUTER JOIN herbal_diagnoses d ON s.herbal_name = d.herbal_name
            FULL OUTER JOIN herbal_special_conditions c ON COALESCE(s.herbal_name, d.herbal_name) = c.herbal_name
            -- Karena bisa terdapat banyak varian untuk 1 herbal, kita pastikan data ditarik
            -- Jika Query ini berjalan sangat lama atau menghasilkan duplikasi berlebih, 
            -- pertimbangkan membuat VIEW secara khusus di database.
        """
        
        # Opsi mudah jika Anda SUDAH punya view atau tabel gabungan tinggal dicomment out query di atas, dan gunakan yang ini:
        # query = "SELECT symptom, diagnosis, description, herbal_name, latin_name, preparation, part_used, special_condition FROM nama_tabel_join_anda;"
        
        df = pd.read_sql_query(query, conn)
        print(f"Berhasil mengekstrak {len(df)} baris data dari PostgreSQL!")
        
        # Menghandle Missing Values (Mengisi NaN/Null dengan string kosong "")
        df.fillna("", inplace=True)
        
        return df

    except psycopg2.Error as e:
        print(f"Error Database PostgreSQL saat Extract: {e}")
        return None
    except Exception as e:
        print(f"Terjadi error tidak terduga saat Extract: {e}")
        return None
    finally:
        if conn:
            conn.close()
            print("Koneksi PostgreSQL telah ditutup.")

def main_etl():
    # ==========================================
    # 1. TAHAP EKSTRAKSI (EXTRACT)
    # ==========================================
    print("\n--- Memulai Proses Ekstraksi (Extract) ---")
    df = extract_data_from_postgres()
    
    if df is None or df.empty:
        print("Data kosong atau proses ekstraksi gagal. Proses ETL dihentikan.")
        return

    # ==========================================
    # 2. TAHAP TRANSFORMASI (TRANSFORM)
    # ==========================================
    print("\n--- Memulai Proses Transformasi Teks (Transform) ---")
    try:
        # Menggabungkan kolom string menjadi satu kesatuan teks,
        # memisahkannya dengan titik dan spasi untuk membentuk string paragraf
        df['combined_text'] = df.apply(
            lambda raw: f"{raw['symptom']}. {raw['diagnosis']}. {raw['description']}".strip(), 
            axis=1
        )
        print("Kolom 'combined_text' berhasil dibuat.")
        
    except Exception as e:
        print(f"Gagal saat proses Transform: {e}")
        return

    # ==========================================
    # 3. PROSES VEKTORISASI (EMBEDDING)
    # ==========================================
    print("\n--- Memulai Proses Vektorisasi (Embedding) ---")
    try:
        print("Melakukan load model SBERT (all-MiniLM-L6-v2) - (Bisa memakan waktu saat run pertama)...")
        model = SentenceTransformer('all-MiniLM-L6-v2')
        
        texts_to_embed = df['combined_text'].tolist()
        
        print(f"Sedang melakukan proses embedding untuk {len(texts_to_embed)} teks...")
        embeddings = model.encode(texts_to_embed, show_progress_bar=True).tolist()
        print("Proses vektorisasi berhasil!")

    except Exception as e:
        print(f"Gagal saat proses Embedding: {e}")
        return

    # ==========================================
    # 4. TAHAP PENYIMPANAN KE CHROMADB (LOAD)
    # ==========================================
    print("\n--- Memulai Proses Penyimpanan ke ChromaDB (Load) ---")
    try:
        # Menghubungkan client Chroma pada folder lokal
        chroma_client = chromadb.PersistentClient(path="./chroma_db")
        
        collection_name = "herbal_collection"
        # Dapatkan collection jika sudah ada, atau buat baru
        collection = chroma_client.get_or_create_collection(name=collection_name)
        
        list_documents = []
        list_metadatas = []
        list_ids = []
        
        # Looping DataFrame
        for idx, row in df.iterrows():
            # a. Documents
            list_documents.append(row['combined_text'])
            
            # b. Metadatas
            metadata = {
                "herbal_name": str(row['herbal_name']),
                "latin_name": str(row['latin_name']),
                "preparation": str(row['preparation']),
                "part_used": str(row['part_used']),
                "special_condition": str(row['special_condition'])
            }
            list_metadatas.append(metadata)
            
            # c. IDs
            # Menghapus spasi karakter yang aneh dan mengubah jadi lowercase + index
            format_name = str(row['herbal_name']).lower().replace(" ", "_")
            unique_id = f"{format_name}_{idx + 1}"
            list_ids.append(unique_id)
        
        print(f"Menyisipkan total {len(list_ids)} entri data ke collection '{collection_name}'...")
        
        # Karena batas API parameter mungkin membuat memori besar jika data Anda ribuan,
        # ChromaDB `collection.add()` sudah menangani batching, tapi kita panggil add() langsung
        collection.add(
            documents=list_documents,
            embeddings=embeddings,     
            metadatas=list_metadatas,
            ids=list_ids
        )
        
        total_items = collection.count()
        print(f"✅ Yess! Proses Pipeline ETL Selesai.")
        print(f"Total entries tersimpan di ChromaDB '{collection_name}' saat ini: {total_items}")
        
    except Exception as e:
        print(f"Terjadi error saat Load ke ChromaDB: {e}")

if __name__ == "__main__":
    main_etl()
