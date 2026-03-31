import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import os
import shutil
import pandas as pd
from sqlalchemy import create_engine
from dotenv import load_dotenv
import warnings

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
        },
        "Kamus medis": {
            "file": "datasets/Kamus_Medis.csv",
            "table": "kamus_medis",
            "mapping": {
                'Nama Diagnosis/Gejala': 'istilah_baku',
                'Sinonim': 'sinonim_awam'
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

            df.columns = ['Nama Herbal' if col == 'Nama Hebal' else col for col in df.columns]

            # Khusus untuk Kamus Medis: Kita perlu memecah sinonim yang dipisahkan newline (\n)
            if label == "Kamus medis":
                # Lakukan rename dulu sesuai mapping
                df = df.rename(columns=info['mapping'])
                
                if 'sinonim_awam' in df.columns:
                    # 1. BERSIHKAN ISTILAH BAKU (PENTING!)
                    # Ini agar 'Mual ' menjadi 'Mual'
                    df['istilah_baku'] = df['istilah_baku'].astype(str).str.strip()
                    
                    # 2. BERSIHKAN SINONIM
                    df['sinonim_awam'] = df['sinonim_awam'].astype(str)
                    
                    # Pecah kolom sinonim_awam berdasarkan newline menjadi list
                    df['sinonim_awam'] = df['sinonim_awam'].str.split('\n')
                    
                    # Gunakan fungsi explode
                    df = df.explode('sinonim_awam')
                    
                    # Bersihkan spasi di tiap sinonim hasil pecahan
                    df['sinonim_awam'] = df['sinonim_awam'].str.strip()
                    
                    # Hapus baris yang kosong atau "nan"
                    df = df[~df['sinonim_awam'].isin(["", "nan", "None", "NaN"])]
            else:
                # Untuk tabel Herbal Gejala & Diagnosis, bersihkan juga kolom kuncinya
                df = df.rename(columns=info['mapping'])
                if 'symptom' in df.columns: df['symptom'] = df['symptom'].astype(str).str.strip()
                if 'diagnosis' in df.columns: df['diagnosis'] = df['diagnosis'].astype(str).str.strip()

            # Filter hanya kolom yang ada di mapping values
            valid_cols = [c for c in df.columns if c in info['mapping'].values()]
            df = df[valid_cols]
            df.fillna("", inplace=True)

            # Masukkan ke database (ganti tabel yang lama)
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
        try:
            shutil.rmtree(CHROMA_PATH)
            print(f"[OK] Folder ChromaDB lama dihapus: {CHROMA_PATH}")
        except Exception as e:
            print(f"[WARN] Tidak bisa menghapus {CHROMA_PATH}: {e}")
    else:
        print(f"[INFO] Folder ChromaDB tidak ditemukan, skip.")

def rebuild_chromadb():
    print("\n" + "="*55)
    print("STEP 4 - REBUILD CHROMADB (DATA HERBAL)")
    print("="*55)

    try:
        from sentence_transformers import SentenceTransformer
        import chromadb

        engine = create_engine(DATABASE_URL)
        print("[OK] Terhubung ke PostgreSQL")

        df_symp = pd.read_sql_query("SELECT symptom, herbal_name, latin_name, preparation, part_used FROM herbal_symptoms", engine)
        df_symp.fillna("", inplace=True)

        df_diag = pd.read_sql_query("SELECT diagnosis, herbal_name, latin_name, preparation, part_used FROM herbal_diagnoses", engine)
        df_diag.fillna("", inplace=True)

        df_cond_preview = pd.read_sql_query("SELECT * FROM herbal_special_conditions LIMIT 1", engine)
        herbal_col = next((col for col in df_cond_preview.columns if 'herbal' in col.lower() or 'hebal' in col.lower()), None)

        if herbal_col:
            select_herbal = f'"{herbal_col}" as herbal_name' if herbal_col != 'herbal_name' else 'herbal_name'
            df_cond = pd.read_sql_query(f"SELECT {select_herbal}, special_condition, description FROM herbal_special_conditions", engine)
        else:
            df_cond = pd.DataFrame(columns=['herbal_name', 'special_condition', 'description'])
        df_cond.fillna("", inplace=True)

        records = []
        for _, row in df_symp.iterrows():
            records.append({"symptom": row.get('symptom',''), "diagnosis": "", "description": "", "herbal_name": row.get('herbal_name',''), "latin_name": row.get('latin_name',''), "preparation": row.get('preparation',''), "part_used": row.get('part_used',''), "special_condition": ""})
        for _, row in df_diag.iterrows():
            records.append({"symptom": "", "diagnosis": row.get('diagnosis',''), "description": "", "herbal_name": row.get('herbal_name',''), "latin_name": row.get('latin_name',''), "preparation": row.get('preparation',''), "part_used": row.get('part_used',''), "special_condition": ""})
        for _, row in df_cond.iterrows():
            records.append({"symptom": "", "diagnosis": "", "description": row.get('description',''), "herbal_name": row.get('herbal_name',''), "latin_name": "", "preparation": "", "part_used": "", "special_condition": row.get('special_condition','')})

        df = pd.DataFrame(records)
        df['combined_text'] = df.apply(lambda r: ". ".join(filter(None, [r['symptom'], r['diagnosis'], r['description']])).strip() or r['herbal_name'], axis=1)

        print("Memuat model embedding (intfloat/multilingual-e5-small)...")
        model = SentenceTransformer('intfloat/multilingual-e5-small')
        
        # WAJIB UNTUK MODEL E5: Tambahkan prefix "query: "
        texts_to_embed = [f"query: {text}" for text in df['combined_text'].tolist()]
        
        print(f"Proses embedding {len(df)} teks... (sabar ya)")
        embeddings = model.encode(texts_to_embed, show_progress_bar=True).tolist()

        chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        collection = chroma_client.get_or_create_collection(name="herbal_collection", metadata={"hnsw:space": "cosine"})

        documents, metadatas, ids = [], [], []
        for idx, row in df.iterrows():
            documents.append(row['combined_text'])
            metadatas.append({"herbal_name": str(row['herbal_name']), "latin_name": str(row['latin_name']), "preparation": str(row['preparation']), "part_used": str(row['part_used']), "special_condition": str(row['special_condition'])})
            fmt = str(row['herbal_name']).lower().replace(" ", "_")
            ids.append(f"herbal_{fmt}_{idx + 1}")
            
        batch_size = 500
        for i in range(0, len(ids), batch_size):
            collection.add(documents=documents[i:i+batch_size], embeddings=embeddings[i:i+batch_size], metadatas=metadatas[i:i+batch_size], ids=ids[i:i+batch_size])
            print(f"   Batch {i//batch_size + 1}: {min(i+batch_size, len(ids))}/{len(ids)} tersimpan")

        print(f"[OK] Koleksi herbal_collection berhasil dibangun! Total: {collection.count()}")
        return True
    except Exception as e:
        print(f"[GAGAL] Rebuild ChromaDB gagal: {e}")
        return False

def rebuild_kamus_medis_chromadb(mode="pure_sbert"):
    """
    mode="pure_sbert" → hanya label dari tabel diagnosis & gejala
    mode="rag"        → label diagnosis & gejala + sinonim dari kamus_medis
    """
    print("\n" + "="*55)
    print(f"STEP 5 - REBUILD MED_LABELS (MODE: {mode.upper()})")
    print("="*55)
    try:
        from sentence_transformers import SentenceTransformer
        import chromadb
        engine = create_engine(DATABASE_URL)

        # Ambil label baku dari tabel utama (SELALU dipakai di kedua mode)
        df_dasar = pd.read_sql_query("""
            SELECT DISTINCT diagnosis as label FROM herbal_diagnoses WHERE diagnosis != ''
            UNION
            SELECT DISTINCT symptom as label FROM herbal_symptoms WHERE symptom != ''
        """, engine)

        model = SentenceTransformer('intfloat/multilingual-e5-small')
        documents, metadatas, ids = [], [], []

        # Daftarkan label baku
        for idx, label in enumerate(df_dasar['label'].tolist()):
            documents.append(label.strip().lower())
            metadatas.append({"baku": label.strip()})
            ids.append(f"db_{idx}")

        # Tambah sinonim dari kamus_medis HANYA jika mode RAG
        if mode == "rag":
            df_kamus = pd.read_sql_query(
                "SELECT istilah_baku, sinonim_awam FROM kamus_medis", engine
            )
            for idx, row in df_kamus.iterrows():
                documents.append(str(row['sinonim_awam']).lower())
                metadatas.append({"baku": str(row['istilah_baku'])})
                ids.append(f"syn_{idx}")
            print(f"[INFO] Mode RAG: {len(df_dasar)} label baku + {len(df_kamus)} sinonim kamus")
        else:
            print(f"[INFO] Mode Pure SBERT: {len(df_dasar)} label baku saja (tanpa kamus sinonim)")

        texts = [f"query: {doc}" for doc in documents]
        embeddings = model.encode(texts, show_progress_bar=True).tolist()

        chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        
        # Hapus collection lama kalau ada, biar fresh
        try:
            chroma_client.delete_collection(name="med_labels")
            print("[OK] Collection med_labels lama dihapus")
        except:
            pass
        
        collection = chroma_client.get_or_create_collection(
            name="med_labels", 
            metadata={"hnsw:space": "cosine"}
        )
        collection.add(
            documents=documents, 
            embeddings=embeddings, 
            metadatas=metadatas, 
            ids=ids
        )

        print(f"[OK] med_labels berhasil dibangun: {collection.count()} entri.")
        return True
    except Exception as e:
        print(f"[GAGAL] Rebuild Kamus: {e}")
        return False

if __name__ == "__main__":
    print("="*55)
    print("  HERBALYZE - UPDATE DATASET")
    print("="*55)

    # ✅ GANTI DI SINI untuk memilih mode
    # "pure_sbert" → hanya label baku dari diagnosis & gejala
    # "rag"        → label baku + sinonim kamus medis
    ACTIVE_MODE = "pure_sbert"  # Ubah ke "rag" jika ingin mode RAG dengan sinonim kamus

    print(f"\n🔧 Mode aktif: {ACTIVE_MODE.upper()}")

    if not seed_postgresql():
        sys.exit(1)

    reset_chromadb()
    ok_herbal = rebuild_chromadb()
    ok_kamus = rebuild_kamus_medis_chromadb(mode=ACTIVE_MODE)

    if ok_herbal and ok_kamus:
        print(f"\n✅ SELESAI! Mode {ACTIVE_MODE} aktif.")
    else:
        print("\n⚠️ Selesai dengan catatan error.")