import pandas as pd
import psycopg2
from sentence_transformers import SentenceTransformer
import chromadb
import os
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "12345")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5433") # Sesuaikan port Anda
DB_NAME = os.getenv("DB_NAME", "db_herbal_ta")

# ==========================================================
# KAMUS MEDIS PINTAR (Bisa ditambah terus tanpa perlu melatih AI!)
# ==========================================================
kamus_medis = {
    "Gula darah tinggi": ["kencing manis", "diabetes", "dm tipe 2", "hiperglikemia", "sering haus", "gampang lelah", "luka susah kering", "luka diabetes"],
    "Demam": ["badan panas", "febris", "suhu tubuh naik", "panas dingin", "meriang", "suhu tubuh fluktuatif"],
    "Bisul": ["bentolan bernanah", "furunkel", "infeksi furunkel" "abses", "infeksi kulit bernanah", "bengkak bernanah"],
    "Obesitas": ["berat badan berlebih", "kegemukan", "overweight", "obesitas sentral", "imt tinggi", "berat badan berlebihan"],
    "Batuk": ["tussis", "batuk berdahak", "batuk rejan", "batuk kering", "dada sakit saat batuk", "dahak susah keluar"],
    "Asam Urat": ["gout arthritis", "sendi bengkak kemerahan", "nyeri sendi jempol", "asam urat tinggi", "nyeri sendi"],
    "Tekanan darah tinggi": ["hipertensi", "darah tinggi", "sakit kepala belakang", "tengkuk terasa berat"]
}

def main():
    print("Mencoba terhubung ke PostgreSQL...")
    conn = psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASSWORD, port=DB_PORT)
    
    query = """
        SELECT DISTINCT diagnosis as label FROM herbal_diagnoses WHERE diagnosis IS NOT NULL AND diagnosis != ''
        UNION
        SELECT DISTINCT symptom as label FROM herbal_symptoms WHERE symptom IS NOT NULL AND symptom != ''
    """
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", UserWarning)
        df = pd.read_sql_query(query, conn)
    conn.close()

    print("Memuat Model AI Pabrik...")
    model = SentenceTransformer('intfloat/multilingual-e5-small')
    
    # KITA SIAPKAN KERANJANG UNTUK CHROMA
    documents = []
    metadatas = []
    ids = []
    counter = 0

    # 1. Masukkan semua Penyakit Baku dari Database
    for label in df['label'].tolist():
        label_str = str(label).strip()
        documents.append(label_str.lower())
        metadatas.append({"baku": label_str}) # Menunjuk ke dirinya sendiri
        ids.append(f"db_{counter}")
        counter += 1

    # 2. Masukkan semua Sinonim dari Kamus Medis
    for label_baku, list_sinonim in kamus_medis.items():
        for sinonim in list_sinonim:
            documents.append(sinonim.lower())
            metadatas.append({"baku": label_baku}) # AJAIB: Sinonim menunjuk ke label baku!
            ids.append(f"syn_{counter}")
            counter += 1

    print(f"Total Kosakata Medis yang ditanamkan: {len(documents)} istilah.")

    # Vektorisasi
    texts = [f"query: {doc}" for doc in documents]
    embeddings = model.encode(texts, show_progress_bar=True).tolist()

    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    
    try:
        chroma_client.delete_collection("med_labels")
    except:
        pass

    collection = chroma_client.get_or_create_collection(name="med_labels", metadata={"hnsw:space": "cosine"})

    collection.add(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids
    )
    print("✅ Selesai! Kamus Sinonim & Terminologi berhasil ditanamkan ke ChromaDB.")

if __name__ == "__main__":
    main()