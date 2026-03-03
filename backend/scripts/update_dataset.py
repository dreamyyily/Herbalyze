import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
import shutil
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv

load_dotenv()

DB_USER     = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "12345")
DB_HOST     = os.getenv("DB_HOST", "localhost")
DB_PORT     = os.getenv("DB_PORT", "5433")
DB_NAME     = os.getenv("DB_NAME", "db_herbal_ta")
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

CHROMA_PATH = "./chroma_db"

def read_csv_robust(filepath):
    encodings = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
    separators = [',', ';', '\t']
    for enc in encodings:
        for sep in separators:
            try:
                df_preview = pd.read_csv(filepath, sep=sep, encoding=enc, nrows=5)
                if len(df_preview.columns) > 1:
                    df_full = pd.read_csv(filepath, sep=sep, encoding=enc)
                    print(f"   -> Encoding='{enc}', separator='{sep}', {len(df_full)} baris")
                    return df_full
            except Exception:
                continue
    raise ValueError(f"Gagal membaca file {filepath}")

def seed_postgresql():
    print("\n" + "="*55)
    print("STEP 1/2 - SEED DATA KE POSTGRESQL")
    print("="*55)

    try:
        engine = create_engine(DATABASE_URL)
        print(f"[OK] Terhubung ke database: {DB_NAME}")
    except Exception as e:
        print(f"[GAGAL] Koneksi database gagal: {e}")
        return False

    files_config = {
        "Herbal gejala (symptoms)": {
            "file": "datasets/Herbal gejala.csv",
            "table": "herbal_symptoms",
            "mapping": {
                'Gejala': 'symptom',
                'Herbal Tiap Gejala': 'herbal_name',
                'Nama Latin Herbal': 'latin_name',
                'Gambar Tanaman': 'image_url',
                'Bagian yang digunakan': 'part_used',
                'Gambar Bagian Herbal': 'part_image_url',
                'Cara Penyajian': 'preparation',
                'Sumber Label': 'source_label',
                'Sumber URL': 'source'
            }
        },
        "Herbal diagnosis": {
            "file": "datasets/Herbal diagnosis.csv",
            "table": "herbal_diagnoses",
            "mapping": {
                'Nama Diagnosis': 'diagnosis',
                'Herbal Diagnosis': 'herbal_name',
                'Nama Latin Herbal': 'latin_name',
                'Gambar Tanaman': 'image_url',
                'Bagian yang digunakan': 'part_used',
                'Gambar Bagian Herbal': 'part_image_url',
                'Cara Penyajian': 'preparation',
                'Sumber Label': 'source_label',
                'Sumber URL': 'source'
            }
        },
        "Kondisi khusus": {
            "file": "datasets/kondisi khusus.csv",
            "table": "herbal_special_conditions",
            "mapping": {
                'Nama Herbal': 'herbal_name',  
                'Nama Hebal': 'herbal_name',    
                'Nama Latin': 'latin_name',
                'kondisi khusus': 'special_condition',
                'deskripsi efek': 'description',
                'referensi': 'reference'
            }
        }
    }

    success_count = 0
    for label, info in files_config.items():
        print(f"\n--- Memproses: {label} ---")
        filepath = info['file']

        if not os.path.exists(filepath):
            print(f"[SKIP] File tidak ditemukan: {filepath}")
            continue

        try:
            df = read_csv_robust(filepath)
            df.columns = df.columns.astype(str).str.strip()

            df.columns = [
                'Nama Herbal' if col == 'Nama Hebal' else col
                for col in df.columns
            ]

            df = df.rename(columns=info['mapping'])
            valid_cols = [c for c in df.columns if c in info['mapping'].values()]
            df = df[valid_cols]
            df.fillna("", inplace=True)

            df.to_sql(info['table'], engine, if_exists='replace', index=True, index_label='index')
            print(f"[OK] {len(df)} baris berhasil masuk ke tabel '{info['table']}'")
            success_count += 1
        except Exception as e:
            print(f"[GAGAL] {label}: {e}")

    print(f"\n[SELESAI] {success_count}/3 tabel berhasil diperbarui di PostgreSQL")
    return success_count > 0

def reset_chromadb():
    print("\n" + "="*55)
    print("STEP 3 - HAPUS CHROMADB LAMA")
    print("="*55)

    if os.path.exists(CHROMA_PATH):
        shutil.rmtree(CHROMA_PATH)
        print(f"[OK] Folder ChromaDB lama dihapus: {CHROMA_PATH}")
    else:
        print(f"[INFO] Folder ChromaDB tidak ditemukan, skip.")

def rebuild_chromadb():
    print("\n" + "="*55)
    print("STEP 4 - REBUILD CHROMADB DARI DATA TERBARU")
    print("="*55)

    try:
        from sentence_transformers import SentenceTransformer
        import chromadb

        engine = create_engine(DATABASE_URL)
        print("[OK] Terhubung ke PostgreSQL via SQLAlchemy")

        print("Membaca tabel herbal_symptoms...")
        df_symp = pd.read_sql_query(
            "SELECT symptom, herbal_name, latin_name, preparation, part_used FROM herbal_symptoms",
            engine
        )
        df_symp.fillna("", inplace=True)

        print("Membaca tabel herbal_diagnoses...")
        df_diag = pd.read_sql_query(
            "SELECT diagnosis, herbal_name, latin_name, preparation, part_used FROM herbal_diagnoses",
            engine
        )
        df_diag.fillna("", inplace=True)

        print("Membaca tabel herbal_special_conditions...")
        df_cond_preview = pd.read_sql_query(
            "SELECT * FROM herbal_special_conditions LIMIT 1", engine
        )
        print(f"   Kolom tersedia: {list(df_cond_preview.columns)}")

        herbal_col = None
        for col in df_cond_preview.columns:
            if 'herbal' in col.lower() or 'hebal' in col.lower():
                herbal_col = col
                break

        if herbal_col:
            select_herbal = f'"{herbal_col}" as herbal_name' if herbal_col != 'herbal_name' else 'herbal_name'
            df_cond = pd.read_sql_query(
                f"SELECT {select_herbal}, special_condition, description FROM herbal_special_conditions",
                engine
            )
        else:
            print("   [WARN] Kolom herbal tidak ditemukan di tabel kondisi khusus, di-skip.")
            df_cond = pd.DataFrame(columns=['herbal_name', 'special_condition', 'description'])
        df_cond.fillna("", inplace=True)

        print(f"[OK] Data: {len(df_symp)} symptoms, {len(df_diag)} diagnoses, {len(df_cond)} kondisi khusus")

        records = []
        for _, row in df_symp.iterrows():
            records.append({
                "symptom": row.get('symptom',''), "diagnosis": "", "description": "",
                "herbal_name": row.get('herbal_name',''), "latin_name": row.get('latin_name',''),
                "preparation": row.get('preparation',''), "part_used": row.get('part_used',''),
                "special_condition": ""
            })
        for _, row in df_diag.iterrows():
            records.append({
                "symptom": "", "diagnosis": row.get('diagnosis',''), "description": "",
                "herbal_name": row.get('herbal_name',''), "latin_name": row.get('latin_name',''),
                "preparation": row.get('preparation',''), "part_used": row.get('part_used',''),
                "special_condition": ""
            })
        for _, row in df_cond.iterrows():
            records.append({
                "symptom": "", "diagnosis": "", "description": row.get('description',''),
                "herbal_name": row.get('herbal_name',''), "latin_name": "",
                "preparation": "", "part_used": "",
                "special_condition": row.get('special_condition','')
            })

        df = pd.DataFrame(records)
        df['combined_text'] = df.apply(
            lambda r: ". ".join(filter(None, [r['symptom'], r['diagnosis'], r['description']])).strip() or r['herbal_name'],
            axis=1
        )
        print(f"[OK] Total {len(df)} dokumen siap di-embed")

        print("Memuat model embedding SBERT (all-MiniLM-L6-v2)...")
        model = SentenceTransformer('all-MiniLM-L6-v2')
        print(f"Proses embedding {len(df)} teks... (sabar ya)")
        embeddings = model.encode(df['combined_text'].tolist(), show_progress_bar=True).tolist()
        print("[OK] Embedding selesai!")

        print("Menyimpan ke ChromaDB baru...")
        chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        collection = chroma_client.get_or_create_collection(name="herbal_collection")

        documents, metadatas, ids = [], [], []
        for idx, row in df.iterrows():
            documents.append(row['combined_text'])
            metadatas.append({
                "herbal_name":       str(row['herbal_name']),
                "latin_name":        str(row['latin_name']),
                "preparation":       str(row['preparation']),
                "part_used":         str(row['part_used']),
                "special_condition": str(row['special_condition'])
            })
            fmt = str(row['herbal_name']).lower().replace(" ", "_")
            ids.append(f"{fmt}_{idx + 1}")
        batch_size = 500
        for i in range(0, len(ids), batch_size):
            collection.add(
                documents=documents[i:i+batch_size],
                embeddings=embeddings[i:i+batch_size],
                metadatas=metadatas[i:i+batch_size],
                ids=ids[i:i+batch_size]
            )
            print(f"   Batch {i//batch_size + 1}: {min(i+batch_size, len(ids))}/{len(ids)} tersimpan")

        total = collection.count()
        print(f"[OK] ChromaDB berhasil dibangun ulang! Total entri: {total}")
        return True

    except Exception as e:
        print(f"[GAGAL] Rebuild ChromaDB gagal: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("="*55)
    print("  HERBALYZE - UPDATE DATASET & CHROMADB")
    print("="*55)
    print(f"Database: {DB_NAME} @ {DB_HOST}:{DB_PORT}")
    print(f"ChromaDB: {CHROMA_PATH}")

    ok = seed_postgresql()
    if not ok:
        print("\n[BERHENTI] Seed PostgreSQL gagal, proses dihentikan.")
        sys.exit(1)

    reset_chromadb()

    ok = rebuild_chromadb()

    print("\n" + "="*55)
    if ok:
        print("SELESAI! Dataset dan ChromaDB sudah diperbarui.")
        print("Restart server backend (uvicorn) agar perubahan aktif.")
    else:
        print("Ada masalah saat rebuild ChromaDB. Cek pesan error di atas.")
    print("="*55)
