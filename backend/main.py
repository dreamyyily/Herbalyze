import json
from fastapi import FastAPI, Depends, HTTPException, Form, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from pydantic import BaseModel
import bcrypt
from eth_account import Account
from eth_account.messages import encode_defunct
import secrets
from typing import Optional
from fastapi.responses import JSONResponse
import os
import traceback
import re
import time 

from db import get_db, Base, engine
from models import User, HerbalDiagnosis, HerbalSymptom, HerbalSpecialCondition, SearchHistory, MedicalRecordDraft
from fastapi.encoders import jsonable_encoder
from blockchain_service import approve_wallet_on_chain, add_medical_record_on_chain
from datetime import datetime
from dotenv import load_dotenv
import requests

load_dotenv()
PINATA_JWT = os.getenv("PINATA_JWT")

print("PINATA_JWT loaded:", PINATA_JWT[:20])

# PINATA
def upload_to_ipfs(file):
    allowed_types = ["application/pdf", "image/jpeg", "image/png", "application/octet-stream"]

    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Format file tidak didukung")

    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"
    headers = {"Authorization": f"Bearer {PINATA_JWT}"}

    file.file.seek(0)  
    file_bytes = file.file.read()

    files = {"file": (file.filename, file_bytes, file.content_type)}
    response = requests.post(url, files=files, headers=headers, timeout=30)

    if response.status_code != 200:
        print("Pinata error:", response.text)
        raise Exception("Upload ke IPFS gagal")

    cid = response.json()["IpfsHash"]
    return cid

def get_user_allergies(wallet_address: str, db: Session) -> set:
    """Ambil daftar alergi herbal user dari DB, kembalikan sebagai set nama herbal lowercase."""
    if not wallet_address or wallet_address == "guest_user":
        return set()
    try:
        user = db.query(User).filter(
            func.lower(User.wallet_address) == wallet_address.lower()
        ).first()
        if not user or not user.alergi_herbal:
            return set()
        allergies = user.alergi_herbal
        if isinstance(allergies, str):
            import json as _json
            allergies = _json.loads(allergies)

        result = set()
        for a in allergies:
            if a and a.lower() != "tidak ada":
                for line in str(a).replace("\r", "").split("\n"):
                    clean = line.split("(")[0].strip().lower()
                    if clean:
                        result.add(clean)
        return result   # ← HARUS DI DALAM try, bukan di luar
    except Exception as e:
        print(f"⚠️ Gagal ambil alergi user: {e}")
        return set()

def filter_allergies(herbs: list, allergies: set) -> list:
    """
    Rule-Based Filter: Menyaring herbal berdasarkan riwayat alergi personal user.
    Menangani format nama herbal multi-baris (dipisah newline) dan alias dalam kurung.
    """
    if not herbs:
        return []
    if not allergies:
        return herbs

    # Normalisasi alergi: ambil bagian sebelum kurung, lowercase, strip
    clean_allergies = {str(a).split("(")[0].strip().lower() for a in allergies}

    filtered = []
    for herb in herbs:
        raw_name = herb.get("name", "")
        
        # ✅ PERBAIKAN: nama herbal bisa multi-baris (dipisah \n)
        # Ambil SEMUA baris sebagai kandidat nama, cek satu per satu
        name_variants = [
            line.split("(")[0].strip().lower()
            for line in raw_name.replace("\r", "").split("\n")
            if line.strip()
        ]
        
        # Herbal dieliminasi jika SALAH SATU variannya ada di daftar alergi
        is_allergic = any(variant in clean_allergies for variant in name_variants)
        
        if is_allergic:
            matched = [v for v in name_variants if v in clean_allergies]
            print(f"🚫 [ALERGI-FILTER] '{raw_name.splitlines()[0]}' DIELIMINASI → nama '{matched[0]}' cocok dengan alergi user.")
        else:
            filtered.append(herb)

    return filtered

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

# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    # Mengacak password menggunakan bcrypt bawaan murni
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Mengecek kecocokan password
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def is_child_under_five(wallet_address: str, db: Session) -> bool:
    """
    Mengecek apakah user dengan wallet_address berusia di bawah 5 tahun.
    Mengembalikan True jika iya, False jika tidak atau data tidak tersedia.
    """
    if not wallet_address or wallet_address == "guest_user":
        return False
    try:
        user = db.query(User).filter(
            func.lower(User.wallet_address) == wallet_address.lower()
        ).first()
        if not user or not user.tanggal_lahir:
            return False

        if isinstance(user.tanggal_lahir, str):
            tgl = datetime.strptime(user.tanggal_lahir, "%Y-%m-%d").date()
        else:
            tgl = user.tanggal_lahir 

        today = datetime.utcnow().date()
        age_years = (today - tgl).days / 365.25
        return age_years < 5
    except Exception as e:
        print(f"⚠️ Gagal cek usia user: {e}")
        return False

def generate_random_nonce():
    return f"Herbalyze Authentication\n\nPlease sign this message to authenticate with your wallet.\n\nSecret Nonce: {secrets.token_hex(16)}"


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ConnectWalletRequest(BaseModel):
    user_id: Optional[int] = None
    wallet_address: str

class Web3AuthRequest(BaseModel):
    wallet_address: str
    signature: Optional[str] = None

class ApproveDoctorRequest(BaseModel):
    wallet_address: str

# Class request untuk endpoint reject
class RejectDoctorRequest(BaseModel):
    wallet_address: str

class SetupAdminRequest(BaseModel):
    wallet_address: str
    email: str
    password: str
    name: Optional[str] = "Admin Herbalyze"

@app.get("/")
def home():
    return {"message": "Welcome to Herbalyze FastAPI System RMP"}

@app.post("/api/setup-admin")
def setup_admin(req: SetupAdminRequest, db: Session = Depends(get_db)):
    """
    Endpoint one-time: buat akun Admin pertama kali setelah deploy contract.
    Hanya bisa digunakan jika BELUM ada akun Admin di database.
    """
    # Cek apakah sudah ada admin
    existing_admin = db.query(User).filter(User.role == "Admin").first()
    if existing_admin:
        raise HTTPException(
            status_code=403,
            detail="Admin sudah ada. Endpoint ini hanya bisa digunakan saat pertama kali setup."
        )

    wallet_lower = req.wallet_address.lower()

    # Cek apakah wallet sudah terdaftar (mungkin role lain)
    existing_user = db.query(User).filter(User.wallet_address == wallet_lower).first()
    if existing_user:
        # Update saja role-nya menjadi Admin
        existing_user.role = "Admin"
        existing_user.is_profile_complete = True
        if req.email:
            existing_user.email = req.email
        if req.password:
            existing_user.password_hash = get_password_hash(req.password)
        db.commit()
        db.refresh(existing_user)
        return {"message": "Role berhasil diupdate menjadi Admin.", "user": existing_user.to_dict()}

    # Cek apakah email sudah terdaftar
    existing_email = db.query(User).filter(User.email == req.email).first()
    if existing_email:
        existing_email.wallet_address = wallet_lower
        existing_email.role = "Admin"
        existing_email.is_profile_complete = True
        db.commit()
        db.refresh(existing_email)
        return {"message": "Wallet ditautkan dan role diupdate menjadi Admin.", "user": existing_email.to_dict()}

    # Buat akun Admin baru
    pw_hash = get_password_hash(req.password)
    new_admin = User(
        name=req.name,
        email=req.email,
        password_hash=pw_hash,
        wallet_address=wallet_lower,
        role="Admin",
        is_profile_complete=True,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    return {
        "message": "Admin berhasil dibuat! Sekarang Anda bisa login dengan email & password lalu verifikasi MetaMask.",
        "user": new_admin.to_dict()
    }

@app.post("/api/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = get_password_hash(req.password)
    new_user = User(
        name=req.name, 
        email=req.email, 
        password_hash=hashed_pw,
        role='Patient'
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"message": "Registration successful", "user": new_user.to_dict()}

@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    return {"message": "Login successful", "user": user.to_dict()}

@app.post("/api/connect-wallet")
def connect_wallet(req: ConnectWalletRequest, db: Session = Depends(get_db)):
    wallet_addr = req.wallet_address.lower()

    if req.user_id is not None:
        existing_user = db.query(User).filter(User.wallet_address == wallet_addr).first()
        if existing_user and existing_user.id != req.user_id:
            raise HTTPException(status_code=400, detail="Wallet already linked to another account")
        user = db.query(User).filter(User.id == req.user_id).first()
    else:
        user = db.query(User).filter(User.wallet_address == wallet_addr).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.wallet_address = wallet_addr
    user.role = 'Patient' if user.role == 'Pending' else user.role
    db.commit()
    db.refresh(user)

    blockchain_result = approve_wallet_on_chain(wallet_addr)
    if blockchain_result.get("success"):
        print(f"✅ Blockchain approve sukses untuk {wallet_addr}")
    else:
        print(f"⚠️ Blockchain approve gagal (non-fatal): {blockchain_result.get('error')}")

    return {
        "message": "Wallet linked successfully",
        "user": user.to_dict(),
        "blockchain_approved": blockchain_result.get("success", False)
    }

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
            user.nonce = None 
            db.commit()
            return {"message": "Login Sukses! Signature Anda Valid.", "user": user.to_dict()}
        else:
            raise HTTPException(status_code=401, detail="Akses Ditolak: Signature palsu.")
    except Exception as e:
        print(f"Error kriptografi backend: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan internal saat memverifikasi signature.")

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
        
        print("Uploading file:", file_dokumen.filename)
        print("Content type:", file_dokumen.content_type)
        
        cid = upload_to_ipfs(file_dokumen)

        user.dokumen_str_path = cid

        user.role = "Pending_Doctor"
        user.nomor_str = nomor_str
        user.nama_instansi = nama_instansi
        user.created_at = datetime.utcnow()
        
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
    result = []
    for u in users:
        d = u.to_dict()
        d["nomor_str"] = u.nomor_str
        d["nama_instansi"] = u.nama_instansi
        d["instansi_lama"] = getattr(u, 'instansi_lama', None)
        d["instansi_baru"] = getattr(u, 'instansi_baru', None)  
        d["dokumen_url"] = f"https://gateway.pinata.cloud/ipfs/{u.dokumen_str_path}" if u.dokumen_str_path else None
        d["created_at"] = u.created_at.isoformat() if u.created_at else None
        result.append(d)
    return result

@app.post("/api/admin/approve_doctor")
def approve_doctor(req: ApproveDoctorRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "Pending_Doctor":
        raise HTTPException(status_code=400, detail="User is not a Pending Doctor")
    
    user.role = "Doctor"
    user.instansi_lama = None
    if getattr(user, 'instansi_baru', None):
        user.nama_instansi = user.instansi_baru
        user.instansi_baru = None
    db.commit()
    db.refresh(user)

    blockchain_result = approve_wallet_on_chain(wallet_address)
    if blockchain_result.get("success"):
        print(f"✅ Dokter {wallet_address} berhasil di-approve di blockchain")
    else:
        print(f"⚠️ Blockchain approve dokter gagal (non-fatal): {blockchain_result.get('error')}")

    return {
        "message": "User berhasil diverifikasi menjadi Doctor di database dan blockchain.",
        "user": user.to_dict(),
        "blockchain_approved": blockchain_result.get("success", False)
    }

@app.post("/api/admin/reject_doctor")
def reject_doctor(req: RejectDoctorRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "Pending_Doctor":
        raise HTTPException(status_code=400, detail="User is not a Pending Doctor")

    user.dokumen_str_path = None

    if user.nomor_str:
        user.nomor_str = None
        user.nama_instansi = None
        user.role = "Rejected_Doctor"
    else:
        user.instansi_baru = None
        user.instansi_lama = None
        user.role = "Doctor"   

    db.commit()
    db.refresh(user)

    return {"message": f"Pengajuan dokter atas nama {user.name} berhasil ditolak."}

    # (Tambahkan class request ini di bagian atas file bersama class Pydantic lainnya, atau di atas fungsi reset_role ini juga tidak apa-apa)
class ResetRoleRequest(BaseModel):
    wallet_address: str

@app.post("/api/reset_role")
def reset_role(req: ResetRoleRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Kembalikan role murni menjadi Pasien biasa
    user.role = "Patient"
    db.commit()
    db.refresh(user)

    return {"message": "Status berhasil direset menjadi Pasien", "user": user.to_dict()}

@app.post("/api/doctor/update_instansi")
async def update_instansi(
    wallet_address: str = Form(...),
    nama_instansi: str = Form(...),
    file_sip: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        func.lower(User.wallet_address) == wallet_address.lower()
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    if user.role != "Doctor":
        raise HTTPException(status_code=400, detail="Hanya dokter terverifikasi yang dapat mengubah instansi")

    try:
        cid = upload_to_ipfs(file_sip)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal upload dokumen SIP: {str(e)}")

    user.instansi_lama = user.nama_instansi   
    user.instansi_baru = nama_instansi.strip() 
    user.dokumen_str_path = cid
    user.role = "Pending_Doctor"
    user.nomor_str = None
    user.created_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    return {
        "message": "Perubahan instansi berhasil diajukan. Menunggu verifikasi admin.",
        "user": user.to_dict()
    }

@app.get("/api/diagnoses")
def get_diagnoses(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT DISTINCT diagnosis
        FROM herbal_diagnoses
        ORDER BY diagnosis;
    """)).fetchall()
    
    cleaned = sorted(set(row[0].strip().title() for row in result if row[0] and row[0].strip()))
    return cleaned

@app.get("/api/symptoms")
def get_symptoms(db: Session = Depends(get_db)):
    result = db.execute(text("""
        SELECT DISTINCT symptom
        FROM herbal_symptoms
        ORDER BY symptom;
    """)).fetchall()
    
    cleaned = sorted(set(row[0].strip().title() for row in result if row[0] and row[0].strip()))
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


# FUNGSI REKOMENDASI & PENCATATAN RIWAYAT 

@app.post("/api/recommend")
async def recommend_herbal(request: Request, db: Session = Depends(get_db)):
    try:
        data = await request.json()
        
        wallet_addr = data.get('wallet_address', 'guest_user')
        sel_diag = data.get('diagnosis', [])
        sel_symp = data.get('gejala', [])
        raw_cond = data.get('kondisi', [])
        obat_kimia = data.get('obat_kimia', [])

        # --- LOG START ---
        print(f"\n{'='*70}")
        print(f"🚀 [ENGINE START] ANALISIS REKOMENDASI EXACT MATCHING (SQL)")
        print(f"📥 Input Diagnosis   : {sel_diag}")
        print(f"📥 Input Gejala      : {sel_symp}")
        print(f"{'='*70}")

        condition_mapping = {
            "Ibu hamil": "Hamil",
            "Ibu menyusui": "Menyusui",
            "Anak di bawah lima tahun": "anak di bawah 5 tahun"
        }
        sel_cond = [condition_mapping.get(c, c) for c in raw_cond if c != "Tidak ada"]
        
        if is_child_under_five(wallet_addr, db):
            child_cond = "anak di bawah 5 tahun"
            if child_cond not in sel_cond:
                sel_cond.append(child_cond)
                print(f"👶 [RBS-AUTO] User {wallet_addr} terdeteksi berusia <5 tahun, kondisi '{child_cond}' ditambahkan otomatis.")

        user_allergies = get_user_allergies(wallet_addr, db)
        print(f"⚙️  [PRE-PROCESS] Kondisi pasien: {sel_cond if sel_cond else 'Normal'}")
        print(f"⚠️  [ALERGI] Daftar Alergi: {user_allergies if user_allergies else 'Tidak ada'}")

        # --- HELPER FUNCTIONS DENGAN LOGGING ---
        def get_safe_herbs(herb_names, conditions):
            if not herb_names: return []
            if not conditions: return list(herb_names)
            
            result = db.execute(text("""
                SELECT herbal_name, special_condition FROM herbal_special_conditions 
                WHERE herbal_name = ANY(:names) AND special_condition = ANY(:conds)
            """), {"names": list(herb_names), "conds": list(conditions)}).fetchall()
            
            unsafe_reasons = {}
            for row in result:
                herb, cond = row[0], row[1]
                if herb not in unsafe_reasons:
                    unsafe_reasons[herb] = []
                unsafe_reasons[herb].append(cond)
            
            safe_herbs = []
            for h in herb_names:
                if h in unsafe_reasons:
                    alasan = ", ".join(unsafe_reasons[h])
                    print(f"      🛑 {h} → DIELIMINASI (berbahaya bagi: {alasan})")
                else:
                    safe_herbs.append(h)
            return safe_herbs

    
        def get_details(herb_names):
            if not herb_names: return []
            result = db.execute(text("""
                SELECT herbal_name, latin_name, image_url, preparation, part_used, part_image_url, source_label, source
                FROM herbal_diagnoses WHERE herbal_name = ANY(:names)
                UNION
                SELECT herbal_name, latin_name, image_url, preparation, part_used, part_image_url, source_label, source
                FROM herbal_symptoms WHERE herbal_name = ANY(:names)
            """), {"names": list(herb_names)}).fetchall()
            
            res, seen = [], set()
            for r in result:
                if r[0] not in seen:
                    res.append({
                        "name": r[0], "latin": r[1], "image": r[2], "preparation": r[3],
                        "part": r[4], "part_image": r[5], "source_label": r[6], "source_link": r[7]
                    })
                    seen.add(r[0])
            return res

       # --- PROSES PENCARIAN DENGAN LOG DETAIL ELIMINASI ---
        grouped_results = []
        all_diags = db.execute(text("SELECT diagnosis, herbal_name FROM herbal_diagnoses")).fetchall()
        all_symps = db.execute(text("SELECT symptom, herbal_name FROM herbal_symptoms")).fetchall()

        # --- LOOP DIAGNOSIS ---
        for d in sel_diag:
            print(f"\n🔍 [SQL] Mencari: '{d}'")
            found = {r[1] for r in all_diags if r[0] and r[0].strip().lower() == d.strip().lower()}
            
            if not found:
                print(f"   ❌ Tidak ada data di database untuk '{d}'.")
                continue

            print(f"   📋 Total herbal ditemukan: {len(found)}")
            print(f"   {'─'*50}")

            # 1. Filter Kondisi Khusus
            if sel_cond:
                print(f"   🔎 Filter Kondisi Khusus ({', '.join(sel_cond)}):")
            safe = get_safe_herbs(found, sel_cond)
            count_rbs_eliminated = len(found) - len(safe)
            if count_rbs_eliminated == 0:
                print(f"      ✅ Tidak ada yang dieliminasi kondisi khusus")

            # 2. Filter Alergi
            details_before_allergy = get_details(safe)
            if user_allergies:
                print(f"   🔎 Filter Alergi ({', '.join(user_allergies)}):")
            details = filter_allergies(details_before_allergy, user_allergies)
            count_allergy_eliminated = len(details_before_allergy) - len(details)
            if count_allergy_eliminated == 0 and user_allergies:
                print(f"      ✅ Tidak ada yang dieliminasi karena alergi")

            # Herbal yang lolos — list nama-namanya
            print(f"   {'─'*50}")
            print(f"   📊 [RINGKASAN '{d}']")
            print(f"      Total awal            : {len(found)} herbal")
            print(f"      🛑 Eliminasi kondisi  : {count_rbs_eliminated} herbal")
            print(f"      🚫 Eliminasi alergi   : {count_allergy_eliminated} herbal")
            print(f"      ✅ Lolos & ditampilkan: {len(details)} herbal")
            if details:
                lolos_names = ", ".join([h['name'].splitlines()[0] for h in details])
                print(f"      📌 Herbal aman       : {lolos_names}")

            if details:
                grouped_results.append({"group_type": "Diagnosis", "group_name": d, "herbs": details})
            else:
                print(f"   ⚠️ Semua herbal dieliminasi, '{d}' tidak ditampilkan.")

        # --- LOOP GEJALA ---
        for s in sel_symp:
            print(f"\n🔍 [SQL] Mencari: '{s}'")
            found = {r[1] for r in all_symps if r[0] and r[0].strip().lower() == s.strip().lower()}
            
            if not found:
                print(f"   ❌ Tidak ada data di database untuk '{s}'.")
                continue

            print(f"   📋 Total herbal ditemukan: {len(found)}")
            print(f"   {'─'*50}")

            if sel_cond:
                print(f"   🔎 Filter Kondisi Khusus ({', '.join(sel_cond)}):")
            safe = get_safe_herbs(found, sel_cond)
            count_rbs_eliminated = len(found) - len(safe)
            if count_rbs_eliminated == 0:
                print(f"      ✅ Tidak ada yang dieliminasi kondisi khusus")

            details_before_allergy = get_details(safe)
            if user_allergies:
                print(f"   🔎 Filter Alergi ({', '.join(user_allergies)}):")
            details = filter_allergies(details_before_allergy, user_allergies)
            count_allergy_eliminated = len(details_before_allergy) - len(details)
            if count_allergy_eliminated == 0 and user_allergies:
                print(f"      ✅ Tidak ada yang dieliminasi karena alergi")

            print(f"   {'─'*50}")
            print(f"   📊 [RINGKASAN '{s}']")
            print(f"      Total awal            : {len(found)} herbal")
            print(f"      🛑 Eliminasi kondisi  : {count_rbs_eliminated} herbal")
            print(f"      🚫 Eliminasi alergi   : {count_allergy_eliminated} herbal")
            print(f"      ✅ Lolos & ditampilkan: {len(details)} herbal")
            if details:
                lolos_names = ", ".join([h['name'].splitlines()[0] for h in details])
                print(f"      📌 Herbal aman       : {lolos_names}")

            if details:
                grouped_results.append({"group_type": "Gejala", "group_name": s, "herbs": details})
            else:
                print(f"   ⚠️ Semua herbal dieliminasi, '{s}' tidak ditampilkan.")
        # --- SELESAI ---
        print(f"\n✨ [FINISH] Analisis selesai. Ditemukan {len(grouped_results)} kategori.")
        print(f"{'='*70}\n")

        if grouped_results:
            try:
                db.execute(text("""
                    INSERT INTO search_history 
                    (wallet_address, diagnoses, symptoms, special_conditions, chemical_drugs, recommendations, created_at)
                    VALUES (:wallet, :diag, :symp, :cond, :drug, :res, NOW())
                """), {
                    "wallet": wallet_addr.lower(),
                    "diag": json.dumps(sel_diag),
                    "symp": json.dumps(sel_symp),
                    "cond": json.dumps(raw_cond),
                    "drug": json.dumps(obat_kimia),
                    "res": json.dumps(grouped_results)
                })
                db.commit()
                print(f"💾 [HISTORY] Riwayat disimpan untuk: {wallet_addr}")
            except Exception as e:
                db.rollback()
                print(f"⚠️ [HISTORY] Gagal simpan riwayat: {e}")

        return grouped_results
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    
# Class request terpisah agar rapi
class HybridRequest(BaseModel):
    wallet_address: str
    query_text: str
    kondisi: list[str]
    obat_kimia: list[str]
    
@app.post("/api/recommend_hybrid")
async def recommend_hybrid(req: HybridRequest, db: Session = Depends(get_db)):
    start_total = time.time()
    print(f"\n{'='*70}")
    print(f"🚀 [ENGINE START] ANALISIS REKOMENDASI HYBRID (SQL + SBERT)")
    print(f"📥 Input Teks : '{req.query_text}'")
    print(f"{'='*70}")

    try:
        query_clean = req.query_text.strip().lower()
        if not query_clean:
            raise HTTPException(status_code=400, detail="Teks keluhan kosong")

        condition_mapping = {
            "Ibu hamil": "Hamil",
            "Ibu menyusui": "Menyusui",
            "Anak di bawah lima tahun": "anak di bawah 5 tahun"
        }
        sel_cond = [condition_mapping.get(c, c) for c in req.kondisi if c != "Tidak ada"]
        if is_child_under_five(req.wallet_address, db):
            child_cond = "anak di bawah 5 tahun"
            if child_cond not in sel_cond:
                sel_cond.append(child_cond)
                print(f"👶 [RBS-AUTO] Usia <5 tahun terdeteksi → kondisi '{child_cond}' ditambahkan.")

        # ✅ Ambil alergi SEKALI di sini, pakai terus ke bawah
        user_allergies = get_user_allergies(req.wallet_address, db)

        print(f"\n📋 [PRE-PROCESS SUMMARY]")
        print(f"   Kondisi Khusus : {sel_cond if sel_cond else 'Tidak ada'}")
        print(f"   Alergi User    : {user_allergies if user_allergies else 'Tidak ada'}")

        # --- HELPER FUNCTIONS ---
        def get_safe_herbs(h_names, conditions):
            """RBS Filter 1: Eliminasi herbal berbahaya untuk kondisi khusus pasien."""
            if not h_names: return []
            if not conditions: return list(h_names)

            result_db = db.execute(text("""
                SELECT herbal_name, special_condition 
                FROM herbal_special_conditions 
                WHERE herbal_name = ANY(:names) AND special_condition = ANY(:conds)
            """), {"names": list(h_names), "conds": list(conditions)}).fetchall()

            # ✅ Kumpulkan semua kondisi per herbal (bisa lebih dari satu)
            unsafe_reasons = {}
            for row in result_db:
                herb, cond = row[0], row[1]
                if herb not in unsafe_reasons:
                    unsafe_reasons[herb] = []
                unsafe_reasons[herb].append(cond)

            safe_herbs = []
            for h in h_names:
                if h in unsafe_reasons:
                    alasan = ", ".join(unsafe_reasons[h])
                    print(f"      🛑 {h} → DIELIMINASI (berbahaya bagi: {alasan})")
                else:
                    safe_herbs.append(h)
            return safe_herbs

        def get_details(h_names):
            if not h_names: return []
            result_db = db.execute(text("""
                SELECT herbal_name, latin_name, image_url, preparation, part_used, part_image_url, source_label, source
                FROM herbal_diagnoses WHERE herbal_name = ANY(:names)
                UNION
                SELECT herbal_name, latin_name, image_url, preparation, part_used, part_image_url, source_label, source
                FROM herbal_symptoms WHERE herbal_name = ANY(:names)
            """), {"names": list(h_names)}).fetchall()
            res, seen = [], set()
            for r in result_db:
                if r[0] not in seen:
                    res.append({
                        "name": r[0], "latin": r[1], "image": r[2], "preparation": r[3],
                        "part": r[4], "part_image": r[5], "source_label": r[6], "source_link": r[7]
                    })
                    seen.add(r[0])
            return res

        def apply_all_filters(herb_names_set, label, conditions, allergies):
            """
            Wrapper: jalankan RBS kondisi + RBS alergi sekaligus, dengan log lengkap.
            Mengembalikan list herbal final yang aman.
            """
            count_raw = len(herb_names_set)
            print(f"\n   📋 [FILTER '{label}'] Total herbal ditemukan: {count_raw}")
            print(f"   {'─'*50}")

            # Filter 1: Kondisi Khusus
            if conditions:
                print(f"   🔎 Filter Kondisi Khusus ({', '.join(conditions)}):")
            safe = get_safe_herbs(herb_names_set, conditions)
            count_rbs_eliminated = count_raw - len(safe)
            if count_rbs_eliminated == 0:
                print(f"      ✅ Tidak ada yang dieliminasi kondisi khusus")

            # Filter 2: Alergi Personal
            details_before_allergy = get_details(safe)
            safe_names_before = {h['name'].splitlines()[0] for h in details_before_allergy}
            if allergies:
                print(f"   🔎 Filter Alergi ({', '.join(allergies)}):")
            details = filter_allergies(details_before_allergy, allergies)
            safe_names_after = {h['name'].splitlines()[0] for h in details}
            eliminated_allergy = safe_names_before - safe_names_after
            count_allergy_eliminated = len(eliminated_allergy)
            if count_allergy_eliminated == 0 and allergies:
                print(f"      ✅ Tidak ada yang dieliminasi karena alergi")

            # ✅ RINGKASAN LENGKAP DENGAN NAMA HERBAL
            print(f"   {'─'*50}")
            print(f"   📊 [RINGKASAN '{label}']")
            print(f"      Total awal            : {count_raw} herbal")
            print(f"         → {', '.join(sorted(herb_names_set))}")

            if count_rbs_eliminated > 0:
                eliminated_rbs_names = herb_names_set - set(safe)
                print(f"      🛑 Eliminasi kondisi  : {count_rbs_eliminated} herbal")
                print(f"         → {', '.join(sorted(eliminated_rbs_names))}")
            else:
                print(f"      🛑 Eliminasi kondisi  : 0 herbal")

            if eliminated_allergy:
                print(f"      🚫 Eliminasi alergi   : {count_allergy_eliminated} herbal")
                print(f"         → {', '.join(sorted(eliminated_allergy))}")
            else:
                print(f"      🚫 Eliminasi alergi   : 0 herbal")

            lolos_names = sorted([h['name'].splitlines()[0] for h in details])
            print(f"      ✅ Lolos & ditampilkan: {len(details)} herbal")
            if lolos_names:
                print(f"         → {', '.join(lolos_names)}")

            return details

        def save_history(result_group):
            try:
                db.execute(text("""
                    INSERT INTO search_history 
                    (wallet_address, diagnoses, symptoms, special_conditions, chemical_drugs, recommendations, created_at)
                    VALUES (:wallet, :diag, :symp, :cond, :drug, :res, NOW())
                """), {
                    "wallet": req.wallet_address.lower(),
                    "diag": json.dumps([f"Analisis: {req.query_text[:50]}..."]),
                    "symp": json.dumps([]),
                    "cond": json.dumps(req.kondisi),
                    "drug": json.dumps(req.obat_kimia),
                    "res": json.dumps(result_group)
                })
                db.commit()
                print(f"💾 [HISTORY] Tersimpan untuk: {req.wallet_address}")
            except Exception as e:
                db.rollback()
                print(f"⚠️ [HISTORY] Gagal simpan: {e}")

        # --- CHUNKING ---
        print(f"\n🧩 [NLP] Memecah kalimat input...")
        delimiters = r'[.,;/!]|\bdan juga\b|\bdan\b|\bserta\b|\bjuga\b|\bmaupun\b|\bdisertai\b'
        raw_chunks = re.split(delimiters, query_clean)
        stop_words = ["pasien", "mengeluhkan", "gejala", "ditemukan", "adanya", "ada", "terdapat",
                      "diagnosis", "didiagnosis", "yang", "di", "ke", "dari", "ini", "itu", "nya",
                      "ialah", "adalah", "alami", "mengidap", "penyakit", "mengalami", "juga", "seharusnya"]
        clean_chunks = []
        for chunk in raw_chunks:
            temp = chunk
            for word in stop_words:
                temp = re.sub(rf'\b{word}\b', '', temp)
            temp = " ".join(re.sub(r'[^\w\s]', '', temp).split())
            if len(temp) > 2:
                clean_chunks.append(temp)
        print(f"   Hasil chunks : {clean_chunks}")

        # --- LAPIS 1: SQL EXACT MATCH ---
        grouped_data = {}
        chunks_to_ai = []
        start_l1 = time.time()
        print(f"\n{'─'*60}")
        print(f"🔍 [LAPIS 1] SQL EXACT MATCHING")
        print(f"{'─'*60}")

        for chunk in clean_chunks:
            print(f"\n   🔎 Mencari: '{chunk}'")
            diag_db = db.execute(text("SELECT herbal_name FROM herbal_diagnoses WHERE TRIM(diagnosis) ILIKE TRIM(:q)"), {"q": chunk}).fetchall()
            symp_db = db.execute(text("SELECT herbal_name FROM herbal_symptoms WHERE TRIM(symptom) ILIKE TRIM(:q)"), {"q": chunk}).fetchall()

            if diag_db or symp_db:
                print(f"   ✅ Ditemukan di SQL sebagai {'Diagnosis' if diag_db else 'Gejala'}")
                baku_name = chunk.strip().capitalize()
                db_res = diag_db if diag_db else symp_db

                # ✅ Gunakan apply_all_filters — RBS kondisi + RBS alergi
                herbs_list = apply_all_filters(
                    {row[0] for row in db_res}, baku_name, sel_cond, user_allergies
                )

                if herbs_list:
                    if baku_name not in grouped_data:
                        grouped_data[baku_name] = {
                            "group_type": "Diagnosis" if diag_db else "Gejala",
                            "group_name": baku_name,
                            "herbs": herbs_list,
                            "detected_from_list": [chunk]
                        }
                    else:
                        if chunk not in grouped_data[baku_name]["detected_from_list"]:
                            grouped_data[baku_name]["detected_from_list"].append(chunk)
                else:
                    print(f"   ⚠️ Semua herbal untuk '{chunk}' dieliminasi filter, tidak ditampilkan.")
            else:
                print(f"   ❌ Tidak ditemukan di SQL → dikirim ke Lapis 2 (SBERT)")
                chunks_to_ai.append(chunk)

        print(f"\n⏱️  Lapis 1 selesai: {(time.time() - start_l1)*1000:.2f} ms")

        # --- LAPIS 2: SBERT ---
        final_result_groups = []

        if chunks_to_ai:
            start_l2 = time.time()
            print(f"\n{'─'*60}")
            print(f"🧠 [LAPIS 2] SBERT SEMANTIC MATCHING")
            print(f"{'─'*60}")
            from sentence_transformers import SentenceTransformer
            import chromadb
            model_ai = SentenceTransformer('intfloat/multilingual-e5-small')
            chroma_client = chromadb.PersistentClient(path="./chroma_db")
            collection = chroma_client.get_collection(name="med_labels")

            for chunk in chunks_to_ai:
                print(f"\n   🔎 Menganalisis: '{chunk}'")
                cv = model_ai.encode([f"query: {chunk}"]).tolist()
                sr = collection.query(query_embeddings=cv, n_results=1)

                if sr['distances'][0]:
                    similarity = (1 - sr['distances'][0][0]) * 100
                    label_baku = sr['metadatas'][0][0]['baku'].strip()
                    baku_cap = label_baku.capitalize()
                    print(f"   🤖 SBERT: '{chunk}' → '{label_baku}' (similarity: {similarity:.2f}%)")

                    if similarity >= 88.0:
                        print(f"   ✅ Diterima (≥88%). Mapping ke database...")
                        is_diag = db.execute(
                            text("SELECT 1 FROM herbal_diagnoses WHERE TRIM(diagnosis) ILIKE TRIM(:q)"),
                            {"q": label_baku}
                        ).first()

                        ai_db = db.execute(text("""
                            SELECT herbal_name FROM herbal_diagnoses WHERE TRIM(diagnosis) ILIKE TRIM(:q)
                            UNION
                            SELECT herbal_name FROM herbal_symptoms WHERE TRIM(symptom) ILIKE TRIM(:q)
                        """), {"q": label_baku}).fetchall()

                        # ✅ Gunakan apply_all_filters — RBS kondisi + RBS alergi
                        herbs_ai_list = apply_all_filters(
                            {r[0] for r in ai_db}, baku_cap, sel_cond, user_allergies
                        )

                        if herbs_ai_list:
                            if baku_cap not in grouped_data:
                                grouped_data[baku_cap] = {
                                    "group_type": "Diagnosis" if is_diag else "Gejala",
                                    "group_name": baku_cap,
                                    "herbs": herbs_ai_list,
                                    "detected_from_list": [chunk]
                                }
                            else:
                                if chunk not in grouped_data[baku_cap]["detected_from_list"]:
                                    grouped_data[baku_cap]["detected_from_list"].append(chunk)
                        else:
                            print(f"   ⚠️ Semua herbal untuk '{label_baku}' dieliminasi filter.")
                    else:
                        print(f"   ⚠️ Ditolak (similarity {similarity:.2f}% < 88%). Dilewati.")

            print(f"\n⏱️  Lapis 2 selesai: {(time.time() - start_l2)*1000:.2f} ms")

        # --- FINAL CONSOLIDATION ---
        print(f"\n{'─'*60}")
        print(f"📦 [FINAL CONSOLIDATION] Menyusun hasil akhir...")
        print(f"{'─'*60}")
        for name, data in grouped_data.items():
            sources = data["detected_from_list"]
            h_list = [f'"{s}"' for s in sources]
            h_text = ", ".join(h_list[:-1]) + f' dan {h_list[-1]}' if len(h_list) > 1 else h_list[0]
            m_text = h_text

            final_result_groups.append({
                "group_type": data["group_type"],
                "group_name": name,
                "header_info": f"Berdasarkan keluhan: {h_text}",
                "mapping_info": f'Berdasarkan keluhan {m_text}, sistem mengenali sebagai "{name}"',
                "herbs": data["herbs"]
            })
            print(f"   ✅ '{name}' → {len(data['herbs'])} herbal aman")

        end_total = (time.time() - start_total) * 1000
        print(f"\n{'='*70}")
        print(f"✨ [SELESAI] {len(final_result_groups)} kategori ditemukan.")
        print(f"⏱️  Total waktu backend: {end_total:.2f} ms")
        print(f"{'='*70}\n")

        if final_result_groups:
            save_history(final_result_groups)
            return final_result_groups
        return []

    except Exception as e:
        print(f"\n🔥 [CRITICAL ERROR] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history/{wallet_address}")
def get_user_history(wallet_address: str, db: Session = Depends(get_db)):
    try:
        result = db.execute(text("""
            SELECT id, diagnoses, symptoms, special_conditions, chemical_drugs, recommendations,
                created_at, blockchain_tx_hash, blockchain_record_id
            FROM search_history 
            WHERE wallet_address = :wallet AND (is_deleted = FALSE OR is_deleted IS NULL)
            ORDER BY created_at DESC
        """), {"wallet": wallet_address.lower()}).fetchall()
        
        return [{
            "id": r[0], "diagnoses": r[1], "symptoms": r[2], "special_conditions": r[3],
            "chemical_drugs": r[4], "recommendations": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
            "blockchain_tx_hash": r[7],
            "blockchain_record_id": r[8],
            "is_on_blockchain": r[7] is not None
        } for r in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ======================== BLOCKCHAIN HISTORY ENDPOINTS ========================

class UpdateBlockchainRequest(BaseModel):
    history_id: int
    tx_hash: str
    record_id: int

@app.post("/api/history/save-to-blockchain")
def save_history_to_blockchain(req: UpdateBlockchainRequest, db: Session = Depends(get_db)):
    """Update tx_hash setelah pasien berhasil menyimpan ke blockchain dari frontend"""
    try:
        record = db.query(SearchHistory).filter(SearchHistory.id == req.history_id).first()
        if not record:
            raise HTTPException(status_code=404, detail="Riwayat tidak ditemukan")
        if record.blockchain_tx_hash:
            raise HTTPException(status_code=400, detail="Riwayat ini sudah disimpan ke blockchain")
        
        record.blockchain_tx_hash = req.tx_hash
        record.blockchain_record_id = req.record_id
        db.commit()
        db.refresh(record)
        
        return {
            "message": "Data blockchain berhasil disimpan",
            "history_id": record.id,
            "tx_hash": record.blockchain_tx_hash,
            "record_id": record.blockchain_record_id
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/history/{history_id}")
def delete_history(history_id: int, wallet_address: str, db: Session = Depends(get_db)):
    """Soft delete riwayat — data tetap ada di DB, hanya tersembunyi dari tampilan"""
    try:
        record = db.query(SearchHistory).filter(
            SearchHistory.id == history_id,
            SearchHistory.wallet_address == wallet_address.lower()
        ).first()
        
        if not record:
            raise HTTPException(status_code=404, detail="Riwayat tidak ditemukan")
        
        record.is_deleted = True
        db.commit()
        
        return {
            "message": "Riwayat berhasil dihapus dari tampilan",
            "note": "Data yang sudah tersimpan di blockchain tetap permanen dan tidak dapat dihapus",
            "was_on_blockchain": record.blockchain_tx_hash is not None
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
# data profile
@app.get("/api/profile/{wallet}")
def get_profile(wallet: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        func.lower(User.wallet_address) == wallet.lower()
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return jsonable_encoder(user)

@app.get("/api/doctors")
def get_doctors(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == "Doctor").order_by(User.name).all()
    result = []
    for u in users:
        result.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "wallet_address": u.wallet_address,
            "instansi": getattr(u, 'nama_instansi', None),
            "spesialisasi": getattr(u, 'spesialisasi', None),
            "foto_profil": u.foto_profil,
        })
    return {"doctors": result}


class WalletListRequest(BaseModel):
    wallets: list[str]

@app.post("/api/patients/by-wallets")
def get_patients_by_wallets(req: WalletListRequest, db: Session = Depends(get_db)):
    if not req.wallets:
        return {"patients": []}

    normalized = [w.lower() for w in req.wallets]
    users = db.query(User).filter(
        func.lower(User.wallet_address).in_(normalized)
    ).all()

    return {
        "patients": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "wallet_address": u.wallet_address,
                "foto_profil": u.foto_profil,
            }
            for u in users
        ]
    }
    
class UpdateProfileRequest(BaseModel):
    wallet_address: str
    nik: Optional[str] = None
    nama: Optional[str] = None
    tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None
    nomor_hp: Optional[str] = None
    jenis_kelamin: Optional[str] = None
    alergi_herbal: Optional[list] = None
    foto_profil: Optional[str] = None

@app.put("/api/profile/update")
def update_profile(req: UpdateProfileRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        func.lower(User.wallet_address) == req.wallet_address.lower()
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    
    if req.nik is not None: user.nik = req.nik
    if req.nama is not None: user.name = req.nama
    if req.tempat_lahir is not None: user.tempat_lahir = req.tempat_lahir
    if req.tanggal_lahir is not None: user.tanggal_lahir = req.tanggal_lahir
    if req.nomor_hp is not None: user.nomor_hp = req.nomor_hp
    if req.jenis_kelamin is not None: user.jenis_kelamin = req.jenis_kelamin
    if req.alergi_herbal is not None: user.alergi_herbal = req.alergi_herbal
    if req.foto_profil is not None: user.foto_profil = req.foto_profil
    
    if user.nik and user.name and user.tanggal_lahir and user.alergi_herbal:
        user.is_profile_complete = True
    
    db.commit()
    db.refresh(user)
    
    return {"message": "Profil berhasil diperbarui", "user": user.to_dict()}


# ======================== MEDICAL RECORD DRAFT ENDPOINTS ========================

class SubmitDraftRequest(BaseModel):
    patient_wallet: str
    doctor_wallet: str
    doctor_name: Optional[str] = None
    doctor_instansi: Optional[str] = None
    record_data: dict  # { diagnosis, gejala, obat, kondisiKhusus, catatanTambahan }


@app.post("/api/medical-record/draft")
def submit_draft(req: SubmitDraftRequest, db: Session = Depends(get_db)):
    """
    Dokter submit rekam medis → disimpan ke DB sebagai DRAFT (PENDING).
    Belum masuk blockchain. Menunggu persetujuan pasien.
    """
    patient = db.query(User).filter(
        func.lower(User.wallet_address) == req.patient_wallet.lower()
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")

    # Cek apakah sudah ada draft PENDING untuk pasien ini dari dokter yang sama
    existing = db.query(MedicalRecordDraft).filter(
        func.lower(MedicalRecordDraft.patient_wallet) == req.patient_wallet.lower(),
        func.lower(MedicalRecordDraft.doctor_wallet) == req.doctor_wallet.lower(),
        MedicalRecordDraft.status == "PENDING"
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Sudah ada rekam medis yang menunggu persetujuan pasien ini. Tunggu pasien merespons dulu."
        )

    draft = MedicalRecordDraft(
        patient_wallet=req.patient_wallet.lower(),
        doctor_wallet=req.doctor_wallet.lower(),
        doctor_name=req.doctor_name,
        doctor_instansi=req.doctor_instansi,
        record_data=req.record_data,
        status="PENDING"
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)

    return {
        "message": "Rekam medis berhasil disimpan sebagai draft. Menunggu persetujuan pasien.",
        "draft": draft.to_dict()
    }


@app.get("/api/medical-record/draft/pending/{patient_wallet}")
def get_pending_drafts(patient_wallet: str, db: Session = Depends(get_db)):
    """
    Pasien mengambil semua draft PENDING miliknya.
    Digunakan untuk polling notifikasi dan menampilkan preview rekam medis.
    """
    drafts = db.query(MedicalRecordDraft).filter(
        func.lower(MedicalRecordDraft.patient_wallet) == patient_wallet.lower(),
        MedicalRecordDraft.status == "PENDING"
    ).order_by(MedicalRecordDraft.created_at.desc()).all()

    return {
        "count": len(drafts),
        "drafts": [d.to_dict() for d in drafts]
    }


@app.post("/api/medical-record/draft/{draft_id}/reject")
def reject_draft(draft_id: int, db: Session = Depends(get_db)):
    """
    Pasien MENOLAK draft → record langsung dihapus dari DB.
    Blockchain tidak disentuh sama sekali.
    Dokter harus mendapat consent ulang dan isi rekam medis dari awal.
    """
    draft = db.query(MedicalRecordDraft).filter(
        MedicalRecordDraft.id == draft_id,
        MedicalRecordDraft.status == "PENDING"
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft tidak ditemukan atau sudah diproses")

    db.delete(draft)
    db.commit()

    return {
        "message": "Draft rekam medis berhasil ditolak dan dihapus. Blockchain tidak diubah.",
        "action": "REJECTED"
    }


@app.post("/api/medical-record/draft/{draft_id}/approve")
def approve_draft(draft_id: int, tx_hash: str, db: Session = Depends(get_db)):
    """
    Pasien sudah approve & transaksi blockchain sukses di frontend (MetaMask).
    Backend hanya menghapus draft dari DB sebagai konfirmasi.
    tx_hash dikirim dari frontend sebagai bukti transaksi berhasil.
    """
    draft = db.query(MedicalRecordDraft).filter(
        MedicalRecordDraft.id == draft_id,
        MedicalRecordDraft.status == "PENDING"
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft tidak ditemukan atau sudah diproses")

    db.delete(draft)
    db.commit()

    return {
        "message": "Draft berhasil dihapus. Rekam medis sudah tersimpan di blockchain.",
        "tx_hash": tx_hash,
        "action": "APPROVED"
    }
    
# HAPUS AKUN
class DeleteAccountRequest(BaseModel):
    wallet_address: str

@app.delete("/api/account/delete")
def delete_account(req: DeleteAccountRequest, db: Session = Depends(get_db)):
    wallet = req.wallet_address.lower()
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
    
    db.execute(text("DELETE FROM search_history WHERE wallet_address = :wallet"), {"wallet": wallet})
    
    db.delete(user)
    db.commit()
    
    return {"message": "Akun berhasil dihapus"}