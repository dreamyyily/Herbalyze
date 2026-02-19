import pandas as pd
from sqlalchemy import create_engine
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_NAME = os.getenv("DB_NAME")

# String koneksi
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def read_csv_robust(filepath):
    """
    Mencoba membaca CSV dengan berbagai kemungkinan format (koma, titik koma, encoding berbeda)
    """
    encodings = ['utf-8', 'latin1', 'iso-8859-1', 'cp1252']
    separators = [',', ';', '\t']
    
    for enc in encodings:
        for sep in separators:
            try:
                # Coba baca 5 baris pertama dulu untuk cek error
                df_preview = pd.read_csv(filepath, sep=sep, encoding=enc, nrows=5)
                # Jika kolomnya cuma 1, kemungkinan salah separator
                if len(df_preview.columns) > 1:
                    print(f"   -> Terbaca dengan encoding='{enc}' dan separator='{sep}'")
                    df_full = pd.read_csv(filepath, sep=sep, encoding=enc)
                    print(f"   -> Total baris terbaca: {len(df_full)}")
                    return df_full
            except Exception:
                continue
                
    raise ValueError(f"Gagal membaca file {filepath}. Pastikan formatnya CSV yang benar.")

def process_and_seed():
    try:
        engine = create_engine(DATABASE_URL)
        print(f"✅ Berhasil terhubung ke database: {DB_NAME}")
    except Exception as e:
        print(f"❌ Gagal koneksi ke database. Cek .env kamu.\nError: {e}")
        return

    # File target
    files_to_process = {
        "symptoms": {
            "file": "Herbal gejala.csv",
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
        "diagnoses": {
            "file": "Herbal diagnosis.csv",
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
        "special_conditions": {
            "file": "kondisi khusus.csv",
            "table": "herbal_special_conditions",
            "mapping": {
                'Nama Hebal': 'herbal_name',
                'Nama Latin': 'latin_name',
                'kondisi khusus': 'special_condition',
                'deskripsi efek': 'description',
                'referensi': 'reference'
            }
        }
    }

    current_dir = os.getcwd()
    print(f"\n📂 Folder Kerja saat ini: {current_dir}")
    files_in_dir = os.listdir(current_dir)

    for key, info in files_to_process.items():
        filename = info['file']
        table_name = info['table']
        
        print(f"\n---------------------------------------------------")
        print(f"Memproses: {filename}")
        
        if not os.path.exists(filename):
            print(f"⚠️  FILE TIDAK DITEMUKAN!")
            print(f"   Pastikan file '{filename}' ada di lokasi yang benar relative terhadap {current_dir}")
            continue
            
        try:
            # Baca CSV dengan fungsi robust
            df = read_csv_robust(filename)
            
            # Clean up column names (strip whitespace)
            df.columns = df.columns.astype(str).str.strip()
            print(f"   Kolom ditemukan: {list(df.columns)}")
            
            # Rename kolom
            df = df.rename(columns=info['mapping'])
            
            # Filter kolom valid
            valid_cols = [col for col in df.columns if col in list(info['mapping'].values())]
            df = df[valid_cols]
            
            # Masukkan ke database
            df.to_sql(table_name, engine, if_exists='replace', index=False)
            print(f"✅ SUKSES! {len(df)} data masuk ke tabel '{table_name}'")
            
        except Exception as e:
            print(f"❌ Gagal memproses {filename}: {e}")

if __name__ == "__main__":
    process_and_seed()
