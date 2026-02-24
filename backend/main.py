import json  # <--- DITAMBAHKAN: Untuk memproses data JSON sebelum masuk database
from fastapi import FastAPI, Depends, HTTPException, Form, File, UploadFile, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from pydantic import BaseModel
from passlib.context import CryptContext
from eth_account import Account
from eth_account.messages import encode_defunct
import secrets
from typing import Optional
from fastapi.responses import JSONResponse
from fastapi import File, UploadFile, Form
import os
import shutil

from db import get_db, Base, engine
from models import User, HerbalDiagnosis, HerbalSymptom, HerbalSpecialCondition

# Buat tabel otomatis jika belum ada
Base.metadata.create_all(bind=engine)

app = FastAPI()

@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Mount Uploads Directory
import os
os.makedirs("uploads/str_documents", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def generate_random_nonce():
    return f"Herbalyze Authentication\n\nPlease sign this message to authenticate with your wallet.\n\nSecret Nonce: {secrets.token_hex(16)}"

# ======================== SCHEMA ========================

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ConnectWalletRequest(BaseModel):
    user_id: int
    wallet_address: str

class Web3AuthRequest(BaseModel):
    wallet_address: str
    signature: Optional[str] = None

# ======================== ROUTES ========================

@app.get("/")
def home():
    return {"message": "Welcome to Herbalyze FastAPI System RMP"}

# AUTH: Email Register
@app.post("/api/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = get_password_hash(req.password)
    new_user = User(
        name=req.name, 
        email=req.email, 
        password_hash=hashed_pw,
        role='Patient' # Default berstatus Patient
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "Registration successful", "user": new_user.to_dict()}

# AUTH: Email Login
@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {"message": "Login successful", "user": user.to_dict()}

# AUTH: Connect Wallet to Account
@app.post("/api/connect-wallet")
def connect_wallet(req: ConnectWalletRequest, db: Session = Depends(get_db)):
    wallet_addr = req.wallet_address.lower()

    existing_user = db.query(User).filter(User.wallet_address == wallet_addr).first()
    if existing_user and existing_user.id != req.user_id:
        raise HTTPException(status_code=400, detail="Wallet already linked to another account")

    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.wallet_address = wallet_addr
    user.role = 'Patient' if user.role == 'Pending' else user.role
    db.commit()
    db.refresh(user)

    return {"message": "Wallet linked successfully", "user": user.to_dict()}

# WEB3 AUTH: GENERATE NONCE
@app.post("/api/generate_nonce")
def generate_nonce(req: Web3AuthRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(User.wallet_address == wallet_address).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Wallet belum terdaftar. Silakan daftar terlebih dahulu di halaman Registrasi.")
    if user.role == 'Pending':
        raise HTTPException(status_code=403, detail="Akun Anda berstatus Pending. Mohon tunggu Administrator memverifikasi data Anda.")

    new_nonce = generate_random_nonce()
    user.nonce = new_nonce
    db.commit()

    return {"message": "Berhasil mengambil nonce.", "nonce": new_nonce}

# WEB3 AUTH: VERIFY SIGNATURE
@app.post("/api/verify_signature")
def verify_signature(req: Web3AuthRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    signature = req.signature

    user = db.query(User).filter(User.wallet_address == wallet_address).first()
    if not user:
        raise HTTPException(status_code=404, detail="User tidak terdaftar.")

    original_nonce = user.nonce
    if not original_nonce:
        raise HTTPException(status_code=400, detail="Sesi login tidak valid. Silakan tekan tombol Login ulang.")

    try:
        message_hash = encode_defunct(text=original_nonce)
        recovered_address = Account.recover_message(message_hash, signature=signature)
        
        if recovered_address.lower() == wallet_address:
            # CEGAH REPLAY ATTACK
            user.nonce = None 
            db.commit()
            return {"message": "Login Sukses! Signature Anda Valid.", "user": user.to_dict()}
        else:
            raise HTTPException(status_code=401, detail="Akses Ditolak: Signature palsu.")
    except Exception as e:
        print(f"Error kriptografi backend: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan internal saat memverifikasi signature.")

# AUTH: REQUEST DOCTOR ROLE
@app.post("/api/request_doctor")
async def request_doctor(
    wallet_address: str = Form(...),
    nomor_str: str = Form(...),
    nama_instansi: str = Form(...),
    file_dokumen: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address.lower()).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        os.makedirs("uploads/str_documents", exist_ok=True)
        
        file_path = f"uploads/str_documents/{wallet_address}_{file_dokumen.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file_dokumen.file, buffer)

        user.role = "Pending_Doctor"
        user.nomor_str = nomor_str
        user.nama_instansi = nama_instansi
        user.dokumen_str_path = file_path
        
        db.commit()
        db.refresh(user)
        
        return {"message": "Permintaan menjadi dokter berhasil diajukan. Menunggu verifikasi admin.", "user": user.to_dict()}
    except Exception as e:
        print(f"Error request doctor: {e}")
        raise HTTPException(status_code=500, detail="Gagal menyimpan permintaan verifikasi dokter.")

# ======================== ADMIN TOOLS ========================

@app.get("/api/admin/pending_doctors")
def get_pending_doctors(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == "Pending_Doctor").all()
    # Path dokumen perlu disesuaikan supaya bisa diakses di Frontend
    result = []
    for u in users:
        d = u.to_dict()
        d["nomor_str"] = u.nomor_str
        d["nama_instansi"] = u.nama_instansi
        # buat full URL relative untuk frontend file pdf
        d["dokumen_url"] = f"http://localhost:8000/{u.dokumen_str_path.replace('\\', '/')}" if u.dokumen_str_path else None
        result.append(d)
    return result

class ApproveDoctorRequest(BaseModel):
    wallet_address: str

@app.post("/api/admin/approve_doctor")
def approve_doctor(req: ApproveDoctorRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "Pending_Doctor":
        raise HTTPException(status_code=400, detail="User is not a Pending Doctor")
    
    # Secara teknis karena ini di blockchain, ini dipanggil SETELAH smart contract sukses.
    # Jika sistemnya full terdesentralisasi off-chain sinkron, ini jadi callback.
    user.role = "Doctor"
    db.commit()
    db.refresh(user)

    return {"message": "User berhasil diverifikasi menjadi Doctor di database.", "user": user.to_dict()}

# ======================== DATA HERBALS ========================

@app.get("/api/diagnoses")
def get_diagnoses(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT DISTINCT diagnosis
        FROM herbal_diagnoses
        ORDER BY diagnosis;
    """)).fetchall()
    
    cleaned = sorted(set(row[0].strip() for row in result if row[0]))
    return cleaned

@app.get("/api/symptoms")
def get_symptoms(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT DISTINCT symptom
        FROM herbal_symptoms
        ORDER BY symptom;
    """)).fetchall()
    
    cleaned = sorted(set(row[0].strip() for row in result if row[0]))
    return cleaned

@app.get("/api/special-conditions")
def get_special_conditions(herbal_name: Optional[str] = None, latin_name: Optional[str] = None, condition: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(HerbalSpecialCondition)
    
    if herbal_name:
        query = query.filter(HerbalSpecialCondition.herbal_name.ilike(f'%{herbal_name}%'))
    if latin_name:
        query = query.filter(HerbalSpecialCondition.latin_name.ilike(f'%{latin_name}%'))
    if condition:
        query = query.filter(HerbalSpecialCondition.special_condition.ilike(f'%{condition}%'))
        
    return [{
        'id': h.index,
        'herbal_name': h.herbal_name,
        'latin_name': h.latin_name,
        'special_condition': h.special_condition,
        'description': h.description,
        'reference': h.reference
    } for h in query.all()]

@app.get("/api/herbs")
def get_herbs(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT herbal_name FROM herbal_diagnoses
        UNION
        SELECT herbal_name FROM herbal_symptoms;
    """)).fetchall()

    filtered = []
    for row in result:
        if row[0]:
            names = [n.strip() for n in row[0].split("\n") if n.strip()]
            if len(names) > 1:
                main_name = names[0]
                aliases = ", ".join(names[1:])
                label = f"{main_name} ({aliases})"
            elif len(names) == 1:
                label = names[0]
            else:
                continue
                
            filtered.append(label)

    return sorted(filtered)

# =========================================================
# FUNGSI REKOMENDASI & PENCATATAN RIWAYAT
# =========================================================
@app.post("/api/recommend")
async def recommend_herbal(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        
        # Mengambil identitas & input pasien
        wallet_addr = data.get('wallet_address', 'guest_user') # <--- DITAMBAHKAN: Tangkap Wallet
        sel_diag = data.get('diagnosis', [])
        sel_symp = data.get('gejala', [])
        raw_cond = data.get('kondisi', [])
        obat_kimia = data.get('obat_kimia', [])                # <--- DITAMBAHKAN: Tangkap Obat Kimia

        # ---------------------------------------------------------
        # KAMUS PENERJEMAH (RULE-BASED MAPPING)
        # ---------------------------------------------------------
        condition_mapping = {
            "Ibu hamil": "hamil",
            "Ibu menyusui": "menyusui",
            "Anak di bawah lima tahun": "anak di bawah 5 tahun"
        }

        sel_cond = []
        for c in raw_cond:
            if c in condition_mapping:
                sel_cond.append(condition_mapping[c])
            elif c != "Tidak ada":
                sel_cond.append(c)
        # ---------------------------------------------------------

        # Helper 1: Saring Herbal yang Dilarang
        def get_safe_herbs(herb_names, conditions):
            if not herb_names: return []
            if not conditions: return list(herb_names)
            
            result = db.execute(text("""
                SELECT herbal_name FROM herbal_special_conditions 
                WHERE herbal_name = ANY(:names) AND special_condition = ANY(:conds)
            """), {"names": list(herb_names), "conds": list(conditions)}).fetchall()
            
            unsafe = {row[0] for row in result if row[0]}
            
            return [h for h in herb_names if h not in unsafe]

        # Helper 2: Ambil Detail Lengkap dengan UNION
        def get_details(herb_names):
            if not herb_names: return []
            result = db.execute(text("""
                SELECT herbal_name, latin_name, image_url, preparation, part_used, part_image_url, source_label, source
                FROM herbal_diagnoses WHERE herbal_name = ANY(:names1)
                UNION
                SELECT herbal_name, latin_name, image_url, preparation, part_used, part_image_url, source_label, source
                FROM herbal_symptoms WHERE herbal_name = ANY(:names2)
            """), {"names1": list(herb_names), "names2": list(herb_names)}).fetchall()
            
            res = []
            seen = set()
            for r in result:
                h_name = r[0]
                if h_name not in seen:
                    res.append({
                        "name": h_name, "latin": r[1], "image": r[2], 
                        "preparation": r[3], "part": r[4], "part_image": r[5], 
                        "source_label": r[6], "source_link": r[7]
                    })
                    seen.add(h_name)
            return res

        grouped_results = []

        all_diags = db.execute(text("SELECT diagnosis, herbal_name FROM herbal_diagnoses")).fetchall()
        all_symps = db.execute(text("SELECT symptom, herbal_name FROM herbal_symptoms")).fetchall()

        # PROSES DIAGNOSIS
        for d in sel_diag:
            found = {r[1] for r in all_diags if r[0] and r[0].strip() == d and r[1]}
            safe = get_safe_herbs(found, sel_cond)
            if safe:
                details = get_details(safe)
                if details:
                    grouped_results.append({
                        "group_type": "Diagnosis",
                        "group_name": d,
                        "herbs": details
                    })

        # PROSES GEJALA
        for s in sel_symp:
            found = {r[1] for r in all_symps if r[0] and r[0].strip() == s and r[1]}
            safe = get_safe_herbs(found, sel_cond)
            if safe:
                details = get_details(safe)
                if details:
                    grouped_results.append({
                        "group_type": "Gejala",
                        "group_name": s,
                        "herbs": details
                    })


        # ---------------------------------------------------------
        # PENCATATAN RIWAYAT (LOGGING) KE TABEL search_history
        # ---------------------------------------------------------
      # PROSES GEJALA
        for s in sel_symp:
            found = {r[1] for r in all_symps if r[0] and r[0].strip() == s and r[1]}
            # ... (kode lainnya) ...

        # ---------------------------------------------------------
        # PENCATATAN RIWAYAT (LOGGING) KE TABEL search_history
        # ---------------------------------------------------------
        if grouped_results:  # <--- BARIS INI HARUS SEJAJAR DENGAN 'for' DI ATASNYA
            try:
                cur.execute("""
                    INSERT INTO search_history 
                    (wallet_address, diagnoses, symptoms, special_conditions, chemical_drugs, recommendations, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, NOW())
                """, (
                    wallet_addr,
                    json.dumps(sel_diag),
                    json.dumps(sel_symp),
                    json.dumps(raw_cond),
                    json.dumps(obat_kimia),
                    json.dumps(grouped_results)
                ))
                conn.commit()
                print(f"✅ Riwayat berhasil disimpan untuk: {wallet_addr}")
            except Exception as e:
                print(f"⚠️ Gagal menyimpan riwayat: {e}")
                conn.rollback() 
        # ---------------------------------------------------------
        
        cur.close()
        conn.close()

        return grouped_results

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

        raise HTTPException(status_code=500, detail=str(e))

# =========================================================
# ENDPOINT BARU: MENGAMBIL RIWAYAT BERDASARKAN WALLET
# =========================================================
@app.get("/api/history/{wallet_address}")
def get_user_history(wallet_address: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        
        # Mengambil riwayat terbaru di atas (ORDER BY created_at DESC)
        cur.execute("""
            SELECT id, diagnoses, symptoms, special_conditions, chemical_drugs, recommendations, created_at
            FROM search_history
            WHERE wallet_address = %s
            ORDER BY created_at DESC
        """, (wallet_address,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()

        history_list = []
        for r in rows:
            history_list.append({
                "id": r[0],
                "diagnoses": r[1],
                "symptoms": r[2],
                "special_conditions": r[3],
                "chemical_drugs": r[4],
                "recommendations": r[5],
                "created_at": r[6].isoformat() if r[6] else None # Cek dulu apakah tanggalnya ada            })
            }) #
        return history_list
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Gagal mengambil riwayat: {str(e)}")