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
import json as _json_lib

load_dotenv()
PINATA_JWT = os.getenv("PINATA_JWT")
print("PINATA_JWT loaded:", PINATA_JWT[:20])

_CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")


# ==============================================================================
# PINATA / IPFS
# ==============================================================================

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
    return response.json()["IpfsHash"]

# ==============================================================================
# Load stopwords dan protected terms untuk NLP filtering
# ==============================================================================

def _load_json_config(filename: str, key: str) -> list:
    try:
        path = os.path.join(_CONFIG_DIR, filename)
        with open(path, "r", encoding="utf-8") as f:
            return _json_lib.load(f).get(key, [])
    except Exception as e:
        print(f"⚠️ Gagal load config '{filename}': {e}")
        return []

NLP_STOPWORDS       = set(_load_json_config("stopwords.json",       "stopwords"))

print(NLP_STOPWORDS)  

def _get_active_mode() -> str:
    try:
        path = os.path.join(_CONFIG_DIR, "active_mode.json")
        print(f"[DEBUG] Mencoba membaca mode dari: {path}")
        
        if not os.path.exists(path):
            print(f"[WARN] File active_mode.json tidak ditemukan di {path}. Gunakan default hybrid_rag")
            return "hybrid_rag"
            
        with open(path, "r", encoding="utf-8") as f:
            data = _json_lib.load(f)
            mode = data.get("mode", "hybrid_rag")
            print(f"[DEBUG] Berhasil membaca mode: {mode.upper()}")
            return mode
            
    except Exception as e:
        print(f"[WARN] Gagal membaca active_mode.json: {e}. Gunakan default hybrid_rag")
        return "hybrid_rag"

ACTIVE_MODE = _get_active_mode()
print(f"✅ Mode aktif: {ACTIVE_MODE.upper()}")

# ==============================================================================
# GLOBAL UTILITY FUNCTIONS
# ==============================================================================

def normalize_text_key(value: str) -> str:
    """
    Normalisasi string untuk matching robust antar tabel:
    - lowercase, samakan apostrof melengkung, buang karakter non-alfanumerik
    """
    if value is None:
        return ""
    v = str(value).strip().lower().replace("\u2019", "'")
    return re.sub(r"[^a-z0-9]+", "", v)


def get_user_allergies(wallet_address: str, db: Session) -> set:
    if not wallet_address or wallet_address == "guest_user":
        return set()
    try:
        db.expire_all()
        user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address.lower()).first()
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
        return result
    except Exception as e:
        print(f"⚠️ Gagal ambil alergi user: {e}")
        return set()


def filter_allergies(herbs: list, allergies: set) -> list:
    if not herbs:
        return []
    if not allergies:
        return herbs
    clean_allergies = {str(a).split("(")[0].strip().lower() for a in allergies}
    filtered = []
    for herb in herbs:
        raw_name = herb.get("name", "")
        name_variants = [
            line.split("(")[0].strip().lower()
            for line in raw_name.replace("\r", "").split("\n")
            if line.strip()
        ]
        is_allergic = any(variant in clean_allergies for variant in name_variants)
        if is_allergic:
            matched = [v for v in name_variants if v in clean_allergies]
            print(f"   🚫 [ALERGI] '{raw_name.splitlines()[0]}' DIELIMINASI → cocok dengan '{matched[0]}'")
        else:
            filtered.append(herb)
    return filtered


def is_child_under_five(wallet_address: str, db: Session) -> bool:
    if not wallet_address or wallet_address == "guest_user":
        return False
    try:
        user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address.lower()).first()
        if not user or not user.tanggal_lahir:
            return False
        tgl = datetime.strptime(user.tanggal_lahir, "%Y-%m-%d").date() if isinstance(user.tanggal_lahir, str) else user.tanggal_lahir
        return (datetime.utcnow().date() - tgl).days / 365.25 < 5
    except Exception as e:
        print(f"⚠️ Gagal cek usia user: {e}")
        return False


def generate_random_nonce():
    return f"Herbalyze Authentication\n\nPlease sign this message to authenticate with your wallet.\n\nSecret Nonce: {secrets.token_hex(16)}"


# ==============================================================================
# GLOBAL RBS FILTER FUNCTIONS
# Digunakan oleh KEDUA endpoint: /api/recommend DAN /api/recommend_hybrid
# Output unsafe_herbs selalu memiliki field: name, full_name, reason, description, reference
# ==============================================================================

def get_safe_herbs_global(herb_names, conditions, db: Session):
    """
    RBS Filter kondisi khusus dengan normalize_text_key (robust terhadap
    perbedaan apostrof, spasi, kapitalisasi, dan nama latin).

    Returns:
        safe_list        : list nama herbal yang lolos filter
        unsafe_herbs_list: list dict {name, full_name, reason, description, reference}
    """
    if not herb_names:
        return [], []
    if not conditions:
        return list(herb_names), []

    # 1. Mapping nama asli (multiline) → nama utama (baris pertama)
    name_to_main = {}
    for h in herb_names:
        name_to_main[h] = str(h).strip().split("\n")[0].strip()

    # 2. Ambil latin_name dari DB untuk setiap kandidat herbal
    herb_main_to_latin_key = {}
    latin_rows = db.execute(text("""
        SELECT herbal_name, latin_name FROM herbal_diagnoses WHERE herbal_name = ANY(:names)
        UNION
        SELECT herbal_name, latin_name FROM herbal_symptoms  WHERE herbal_name = ANY(:names)
    """), {"names": list(herb_names)}).fetchall()
    for herb_n, latin_n in latin_rows:
        main = str(herb_n).strip().split("\n")[0].strip()
        herb_main_to_latin_key[normalize_text_key(main)] = normalize_text_key(latin_n or "")

    # 3. Ambil semua rule unsafe dari herbal_special_conditions untuk kondisi aktif
    unsafe_rows = db.execute(text("""
        SELECT herbal_name, latin_name, special_condition, description, reference
        FROM herbal_special_conditions
        WHERE LOWER(TRIM(special_condition)) = ANY(:conds_lower)
    """), {"conds_lower": [c.strip().lower() for c in list(conditions)]}).fetchall()

    # 4. Bangun lookup: herb_key / latin_key → {conditions, descriptions, references}
    unsafe_by_herb_key  = {}
    unsafe_by_latin_key = {}
    for herb_n, latin_n, cond, desc, ref in unsafe_rows:
        for lookup, key in [
            (unsafe_by_herb_key,  normalize_text_key(herb_n)),
            (unsafe_by_latin_key, normalize_text_key(latin_n or ""))
        ]:
            if not key:
                continue
            if key not in lookup:
                lookup[key] = {"conditions": set(), "descriptions": [], "references": []}
            lookup[key]["conditions"].add(cond)
            if desc and desc.strip() not in lookup[key]["descriptions"]:
                lookup[key]["descriptions"].append(desc.strip())
            if ref and ref.strip() not in lookup[key]["references"]:
                lookup[key]["references"].append(ref.strip())

    # 5. Klasifikasi tiap herbal
    safe_herbs        = []
    unsafe_herbs_list = []

    for full_name in herb_names:
        main      = name_to_main[full_name]
        main_key  = normalize_text_key(main)
        latin_key = herb_main_to_latin_key.get(main_key, "")

        matched_herb  = unsafe_by_herb_key.get(main_key)
        matched_latin = unsafe_by_latin_key.get(latin_key) if latin_key else None
        match = matched_herb or matched_latin

        if match:
            # Gabungkan data dari kedua sumber
            conditions_set = set()
            descriptions   = []
            references     = []
            for m in [matched_herb, matched_latin]:
                if not m:
                    continue
                conditions_set |= m["conditions"]
                for d in m["descriptions"]:
                    if d not in descriptions: descriptions.append(d)
                for r in m["references"]:
                    if r not in references: references.append(r)

            alasan     = ", ".join(sorted(conditions_set))
            desc_final = " ".join(descriptions) if descriptions else "Analisis medis menunjukkan adanya risiko efek samping."
            ref_final  = ", ".join(references)  if references  else "Pedoman Keamanan Herbal"

            print(f"      🛑 {main} → DIELIMINASI (berbahaya bagi: {alasan})")
            unsafe_herbs_list.append({
                "name":        main,
                "full_name":   full_name.strip(),
                "reason":      f"Berbahaya bagi: {alasan}",
                "description": desc_final,
                "reference":   ref_final
            })
        else:
            safe_herbs.append(full_name)

    return safe_herbs, unsafe_herbs_list


def get_details_global(herb_names, db: Session):
    """Ambil detail lengkap herbal dari DB (diagnoses + symptoms)."""
    if not herb_names:
        return []
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


def apply_all_filters_global(herb_names_set, label, conditions, allergies, db: Session):
    """
    Global wrapper: RBS kondisi + RBS alergi dengan log detail lengkap.

    Returns:
        details_final : list detail herbal yang aman
        all_unsafe    : list dict unsafe_herbs (kondisi + alergi)
    """
    count_raw = len(herb_names_set)
    print(f"\n   📋 [FILTER '{label}'] Total herbal ditemukan: {count_raw}")
    print(f"   {'─'*50}")

    # ── Filter 1: Kondisi Khusus ──
    if conditions:
        print(f"   🔎 Filter Kondisi Khusus ({', '.join(conditions)}):")
    safe_names, unsafe_rbs = get_safe_herbs_global(herb_names_set, conditions, db)
    count_rbs = count_raw - len(safe_names)
    if count_rbs == 0:
        print(f"      ✅ Tidak ada yang dieliminasi kondisi khusus")

    # ── Filter 2: Alergi Personal ──
    details_before = get_details_global(safe_names, db)
    names_before   = {h['name'].splitlines()[0] for h in details_before}
    if allergies:
        print(f"   🔎 Filter Alergi ({', '.join(allergies)}):")
    details_final  = filter_allergies(details_before, allergies)
    names_after    = {h['name'].splitlines()[0] for h in details_final}
    elim_allergy   = names_before - names_after

    # Bangun unsafe_allergy dengan field lengkap
    unsafe_allergy = []
    for h in details_before:
        h_main = h['name'].splitlines()[0]
        if h_main in elim_allergy:
            unsafe_allergy.append({
                "name":        h_main,
                "full_name":   h['name'],
                "reason":      "Terdeteksi riwayat alergi pada profil Anda",
                "description": "Tanaman ini masuk dalam daftar alergi Anda. Mengonsumsinya dapat memicu reaksi alergi.",
                "reference":   "Profil kesehatan pengguna"
            })

    if not elim_allergy and allergies:
        print(f"      ✅ Tidak ada yang dieliminasi karena alergi")

    all_unsafe = unsafe_rbs + unsafe_allergy

    # ── Log Ringkasan ──
    print(f"   {'─'*50}")
    print(f"   📊 [RINGKASAN '{label}']")
    print(f"      Total awal            : {count_raw} herbal")
    print(f"         → {', '.join(sorted(str(h).splitlines()[0] for h in herb_names_set))}")

    if count_rbs > 0:
        print(f"      🛑 Eliminasi kondisi  : {count_rbs} herbal")
        print(f"         → {', '.join(u['name'] for u in unsafe_rbs)}")
    else:
        print(f"      🛑 Eliminasi kondisi  : 0 herbal")

    if elim_allergy:
        print(f"      🚫 Eliminasi alergi   : {len(elim_allergy)} herbal")
        print(f"         → {', '.join(sorted(elim_allergy))}")
    else:
        print(f"      🚫 Eliminasi alergi   : 0 herbal")

    lolos = sorted([h['name'].splitlines()[0] for h in details_final])
    print(f"      ✅ Lolos & ditampilkan: {len(details_final)} herbal")
    if lolos:
        print(f"         → {', '.join(lolos)}")

    return details_final, all_unsafe


# ==============================================================================
# APP SETUP
# ==============================================================================

Base.metadata.create_all(bind=engine)
app = FastAPI()


@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


# ==============================================================================
# PYDANTIC MODELS
# ==============================================================================

class RegisterRequest(BaseModel):
    name: str; email: str; password: str

class LoginRequest(BaseModel):
    email: str; password: str

class ConnectWalletRequest(BaseModel):
    user_id: Optional[int] = None; wallet_address: str

class Web3AuthRequest(BaseModel):
    wallet_address: str; signature: Optional[str] = None

class ApproveDoctorRequest(BaseModel):
    wallet_address: str

class RejectDoctorRequest(BaseModel):
    wallet_address: str

class SetupAdminRequest(BaseModel):
    wallet_address: str; email: str; password: str; name: Optional[str] = "Admin Herbalyze"

class ResetRoleRequest(BaseModel):
    wallet_address: str

class HybridRequest(BaseModel):
    wallet_address: str; query_text: str; kondisi: list[str]; obat_kimia: list[str]

class UpdateBlockchainRequest(BaseModel):
    history_id: int; tx_hash: str; record_id: int

class WalletListRequest(BaseModel):
    wallets: list[str]

class UpdateProfileRequest(BaseModel):
    wallet_address: str
    nik: Optional[str] = None; nama: Optional[str] = None; tempat_lahir: Optional[str] = None
    tanggal_lahir: Optional[str] = None; nomor_hp: Optional[str] = None
    jenis_kelamin: Optional[str] = None; alergi_herbal: Optional[list] = None; foto_profil: Optional[str] = None

class SubmitDraftRequest(BaseModel):
    patient_wallet: str; doctor_wallet: str
    doctor_name: Optional[str] = None; doctor_instansi: Optional[str] = None; record_data: dict

class DeleteAccountRequest(BaseModel):
    wallet_address: str


# ==============================================================================
# ENDPOINTS
# ==============================================================================

@app.get("/")
def home():
    return {"message": "Welcome to Herbalyze FastAPI System RMP"}


@app.post("/api/setup-admin")
def setup_admin(req: SetupAdminRequest, db: Session = Depends(get_db)):
    existing_admin = db.query(User).filter(User.role == "Admin").first()
    if existing_admin:
        raise HTTPException(status_code=403, detail="Admin sudah ada.")
    wallet_lower = req.wallet_address.lower()
    existing_user = db.query(User).filter(User.wallet_address == wallet_lower).first()
    if existing_user:
        existing_user.role = "Admin"; existing_user.is_profile_complete = True
        if req.email: existing_user.email = req.email
        if req.password: existing_user.password_hash = get_password_hash(req.password)
        db.commit(); db.refresh(existing_user)
        return {"message": "Role berhasil diupdate menjadi Admin.", "user": existing_user.to_dict()}
    existing_email = db.query(User).filter(User.email == req.email).first()
    if existing_email:
        existing_email.wallet_address = wallet_lower; existing_email.role = "Admin"; existing_email.is_profile_complete = True
        db.commit(); db.refresh(existing_email)
        return {"message": "Wallet ditautkan dan role diupdate menjadi Admin.", "user": existing_email.to_dict()}
    new_admin = User(name=req.name, email=req.email, password_hash=get_password_hash(req.password), wallet_address=wallet_lower, role="Admin", is_profile_complete=True)
    db.add(new_admin); db.commit(); db.refresh(new_admin)
    return {"message": "Admin berhasil dibuat!", "user": new_admin.to_dict()}


@app.post("/api/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    new_user = User(name=req.name, email=req.email, password_hash=get_password_hash(req.password), role='Patient')
    db.add(new_user); db.commit(); db.refresh(new_user)
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
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.wallet_address = wallet_addr
    user.role = 'Patient' if user.role == 'Pending' else user.role
    db.commit(); db.refresh(user)
    blockchain_result = approve_wallet_on_chain(wallet_addr)
    if blockchain_result.get("success"): print(f"✅ Blockchain approve sukses untuk {wallet_addr}")
    else: print(f"⚠️ Blockchain approve gagal (non-fatal): {blockchain_result.get('error')}")
    return {"message": "Wallet linked successfully", "user": user.to_dict(), "blockchain_approved": blockchain_result.get("success", False)}


@app.post("/api/generate_nonce")
def generate_nonce(req: Web3AuthRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(User.wallet_address == wallet_address).first()
    if not user: raise HTTPException(status_code=404, detail="Wallet belum terdaftar.")
    if user.role == 'Pending': raise HTTPException(status_code=403, detail="Akun Anda berstatus Pending.")
    user.nonce = generate_random_nonce(); db.commit()
    return {"message": "Berhasil mengambil nonce.", "nonce": user.nonce}


@app.post("/api/verify_signature")
def verify_signature(req: Web3AuthRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(User.wallet_address == wallet_address).first()
    if not user: raise HTTPException(status_code=404, detail="User tidak terdaftar.")
    if not user.nonce: raise HTTPException(status_code=400, detail="Sesi login tidak valid.")
    try:
        message_hash = encode_defunct(text=user.nonce)
        recovered_address = Account.recover_message(message_hash, signature=req.signature)
        if recovered_address.lower() == wallet_address:
            user.nonce = None; db.commit()
            return {"message": "Login Sukses! Signature Anda Valid.", "user": user.to_dict()}
        raise HTTPException(status_code=401, detail="Akses Ditolak: Signature palsu.")
    except Exception as e:
        print(f"Error kriptografi backend: {e}")
        raise HTTPException(status_code=500, detail="Terjadi kesalahan internal saat memverifikasi signature.")


@app.post("/api/request_doctor")
async def request_doctor(wallet_address: str = Form(...), nomor_str: str = Form(...), nama_instansi: str = Form(...), file_dokumen: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address.lower()).first()
        if not user: raise HTTPException(status_code=404, detail="User not found")
        cid = upload_to_ipfs(file_dokumen)
        user.dokumen_str_path = cid; user.role = "Pending_Doctor"; user.nomor_str = nomor_str
        user.nama_instansi = nama_instansi; user.created_at = datetime.utcnow()
        db.commit(); db.refresh(user)
        return {"message": "Permintaan menjadi dokter berhasil diajukan.", "user": user.to_dict()}
    except Exception as e:
        print(f"Error request doctor: {e}")
        raise HTTPException(status_code=500, detail="Gagal menyimpan permintaan verifikasi dokter.")


@app.get("/api/admin/pending_doctors")
def get_pending_doctors(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == "Pending_Doctor").all()
    result = []
    for u in users:
        d = u.to_dict()
        d["nomor_str"] = u.nomor_str; d["nama_instansi"] = u.nama_instansi
        d["instansi_lama"] = getattr(u, 'instansi_lama', None); d["instansi_baru"] = getattr(u, 'instansi_baru', None)
        d["dokumen_url"] = f"https://gateway.pinata.cloud/ipfs/{u.dokumen_str_path}" if u.dokumen_str_path else None
        d["created_at"] = u.created_at.isoformat() if u.created_at else None
        result.append(d)
    return result


@app.post("/api/admin/approve_doctor")
def approve_doctor(req: ApproveDoctorRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.role != "Pending_Doctor": raise HTTPException(status_code=400, detail="User is not a Pending Doctor")
    user.role = "Doctor"; user.instansi_lama = None
    if getattr(user, 'instansi_baru', None):
        user.nama_instansi = user.instansi_baru; user.instansi_baru = None
    db.commit(); db.refresh(user)
    blockchain_result = approve_wallet_on_chain(wallet_address)
    return {"message": "User berhasil diverifikasi menjadi Doctor.", "user": user.to_dict(), "blockchain_approved": blockchain_result.get("success", False)}


@app.post("/api/admin/reject_doctor")
def reject_doctor(req: RejectDoctorRequest, db: Session = Depends(get_db)):
    wallet_address = req.wallet_address.lower()
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    if user.role != "Pending_Doctor": raise HTTPException(status_code=400, detail="User is not a Pending Doctor")
    user.dokumen_str_path = None
    if user.nomor_str:
        user.nomor_str = None; user.nama_instansi = None; user.role = "Rejected_Doctor"
    else:
        user.instansi_baru = None; user.instansi_lama = None; user.role = "Doctor"
    db.commit(); db.refresh(user)
    return {"message": f"Pengajuan dokter atas nama {user.name} berhasil ditolak."}


class ResetRoleRequest(BaseModel):
    wallet_address: str

@app.post("/api/reset_role")
def reset_role(req: ResetRoleRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.wallet_address) == req.wallet_address.lower()).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    user.role = "Patient"; db.commit(); db.refresh(user)
    return {"message": "Status berhasil direset menjadi Pasien", "user": user.to_dict()}


@app.post("/api/doctor/update_instansi")
async def update_instansi(wallet_address: str = Form(...), nama_instansi: str = Form(...), file_sip: UploadFile = File(...), db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet_address.lower()).first()
    if not user: raise HTTPException(status_code=404, detail="User tidak ditemukan")
    if user.role != "Doctor": raise HTTPException(status_code=400, detail="Hanya dokter terverifikasi yang dapat mengubah instansi")
    try:
        cid = upload_to_ipfs(file_sip)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal upload dokumen SIP: {str(e)}")
    user.instansi_lama = user.nama_instansi; user.instansi_baru = nama_instansi.strip()
    user.dokumen_sip_path = cid; user.role = "Pending_Doctor"; user.nomor_str = None; user.created_at = datetime.utcnow()
    db.commit(); db.refresh(user)
    return {"message": "Perubahan instansi berhasil diajukan.", "user": user.to_dict()}


@app.get("/api/diagnoses")
def get_diagnoses(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT DISTINCT diagnosis FROM herbal_diagnoses ORDER BY diagnosis;")).fetchall()
    return sorted(set(row[0].strip().title() for row in result if row[0] and row[0].strip()))


@app.get("/api/symptoms")
def get_symptoms(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT DISTINCT symptom FROM herbal_symptoms ORDER BY symptom;")).fetchall()
    return sorted(set(row[0].strip().title() for row in result if row[0] and row[0].strip()))


@app.get("/api/special-conditions")
def get_special_conditions(herbal_name: Optional[str] = None, latin_name: Optional[str] = None, condition: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(HerbalSpecialCondition)
    if herbal_name: query = query.filter(HerbalSpecialCondition.herbal_name.ilike(f'%{herbal_name}%'))
    if latin_name: query = query.filter(HerbalSpecialCondition.latin_name.ilike(f'%{latin_name}%'))
    if condition: query = query.filter(HerbalSpecialCondition.special_condition.ilike(f'%{condition}%'))
    return [{'id': h.index, 'herbal_name': h.herbal_name, 'latin_name': h.latin_name, 'special_condition': h.special_condition, 'description': h.description, 'reference': h.reference} for h in query.all()]


@app.get("/api/herbs")
def get_herbs(db: Session = Depends(get_db)):
    result = db.execute(text("SELECT herbal_name FROM herbal_diagnoses UNION SELECT herbal_name FROM herbal_symptoms;")).fetchall()
    filtered = []
    for row in result:
        if row[0]:
            names = [n.strip() for n in row[0].split("\n") if n.strip()]
            filtered.append(f"{names[0]} ({', '.join(names[1:])})" if len(names) > 1 else names[0])
    return sorted(filtered)


# ==============================================================================
# ENDPOINT: /api/recommend  (Exact SQL Matching)
# ==============================================================================

@app.post("/api/recommend")
async def recommend_herbal(request: Request, db: Session = Depends(get_db)):
    try:
        data       = await request.json()
        wallet_addr = data.get('wallet_address', 'guest_user')
        sel_diag   = data.get('diagnosis', [])
        sel_symp   = data.get('gejala', [])
        raw_cond   = data.get('kondisi', [])
        obat_kimia = data.get('obat_kimia', [])

        print(f"\n{'='*70}")
        print(f"🚀 [ENGINE START] ANALISIS REKOMENDASI EXACT MATCHING (SQL)")
        print(f"📥 Input Diagnosis : {sel_diag}")
        print(f"📥 Input Gejala    : {sel_symp}")
        print(f"{'='*70}")

        condition_mapping = {"Ibu hamil": "Hamil", "Ibu menyusui": "Menyusui", "Anak di bawah lima tahun": "anak di bawah 5 tahun"}
        sel_cond = [condition_mapping.get(c, c) for c in raw_cond if c != "Tidak ada"]

        if is_child_under_five(wallet_addr, db):
            if "anak di bawah 5 tahun" not in sel_cond:
                sel_cond.append("anak di bawah 5 tahun")
                print(f"👶 [RBS-AUTO] User {wallet_addr} terdeteksi berusia <5 tahun, kondisi ditambahkan otomatis.")

        user_allergies = get_user_allergies(wallet_addr, db)
        print(f"⚙️  [PRE-PROCESS] Kondisi : {sel_cond if sel_cond else 'Normal'}")
        print(f"⚠️  [ALERGI]      Daftar  : {user_allergies if user_allergies else 'Tidak ada'}")

        grouped_results = []
        all_diags = db.execute(text("SELECT diagnosis, herbal_name FROM herbal_diagnoses")).fetchall()
        all_symps = db.execute(text("SELECT symptom,   herbal_name FROM herbal_symptoms")).fetchall()

        for d in sel_diag:
            print(f"\n🔍 [SQL] Mencari diagnosis: '{d}'")
            found = {r[1] for r in all_diags if r[0] and r[0].strip().lower() == d.strip().lower()}
            if not found:
                print(f"   ❌ Tidak ada data untuk '{d}'."); continue
            print(f"   📋 Ditemukan {len(found)} herbal. Menjalankan filter...")
            if sel_cond: print(f"   🔎 Filter Kondisi ({', '.join(sel_cond)}):")
            details_final, all_unsafe = apply_all_filters_global(found, d, sel_cond, user_allergies, db)
            if details_final or all_unsafe:
                grouped_results.append({
                    "group_type": "Diagnosis",
                    "group_name": d,
                    "herbs": details_final,
                    "unsafe_herbs": all_unsafe
                })
            else:
                print(f"   ⚠️ Tidak ada herbal aman maupun unsafe untuk '{d}'.")
        for s in sel_symp:
            print(f"\n🔍 [SQL] Mencari gejala: '{s}'")
            found = {r[1] for r in all_symps if r[0] and r[0].strip().lower() == s.strip().lower()}
            if not found:
                print(f"   ❌ Tidak ada data untuk '{s}'."); continue
            print(f"   📋 Ditemukan {len(found)} herbal. Menjalankan filter...")
            if sel_cond: print(f"   🔎 Filter Kondisi ({', '.join(sel_cond)}):")
            details_final, all_unsafe = apply_all_filters_global(found, s, sel_cond, user_allergies, db)
            if details_final or all_unsafe:
                grouped_results.append({
                    "group_type": "Gejala",
                    "group_name": s,
                    "herbs": details_final,
                    "unsafe_herbs": all_unsafe
                })
            else:
                print(f"   ⚠️ Tidak ada herbal aman maupun unsafe untuk '{s}'.")

        print(f"\n✨ [FINISH] Analisis selesai. Ditemukan {len(grouped_results)} kategori.")
        print(f"{'='*70}\n")

        if grouped_results:
            try:
                new_history = SearchHistory(
                    wallet_address=wallet_addr.lower(), diagnoses=sel_diag, symptoms=sel_symp,
                    special_conditions=raw_cond, chemical_drugs=obat_kimia, recommendations=grouped_results
                )
                db.add(new_history); db.commit(); db.refresh(new_history)
                print(f"✅ [HISTORY] Berhasil tersimpan (ID: {new_history.id})")
            except Exception as e:
                db.rollback(); print(f"❌ [HISTORY] Gagal simpan: {str(e)}")

        return grouped_results

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# ENDPOINT: /api/recommend_hybrid  (SQL + SBERT)
# ==============================================================================

@app.post("/api/recommend_hybrid")
async def recommend_hybrid(req: HybridRequest, db: Session = Depends(get_db)):
    start_total = time.time()
    print(f"[DEBUG] ACTIVE_MODE dari config: {ACTIVE_MODE}")
    print(f"[DEBUG] Path config: {_CONFIG_DIR}")
    print(f"\n{'='*70}")
    print(f"🚀 [ENGINE START] ANALISIS REKOMENDASI HYBRID (SQL + SBERT)")
    print(f"📥 Input Teks : '{req.query_text}'")
    print(f"{'='*70}")

    try:
        query_clean = req.query_text.strip().lower()
        if not query_clean:
            raise HTTPException(status_code=400, detail="Teks keluhan kosong")

        condition_mapping = {"Ibu hamil": "Hamil", "Ibu menyusui": "Menyusui", "Anak di bawah lima tahun": "anak di bawah 5 tahun"}
        sel_cond = [condition_mapping.get(c, c) for c in req.kondisi if c != "Tidak ada"]
        if is_child_under_five(req.wallet_address, db):
            if "anak di bawah 5 tahun" not in sel_cond:
                sel_cond.append("anak di bawah 5 tahun")
                print(f"👶 [RBS-AUTO] Usia <5 tahun terdeteksi → kondisi ditambahkan.")

        user_allergies = get_user_allergies(req.wallet_address, db)
        print(f"\n📋 [PRE-PROCESS SUMMARY]")
        print(f"   Kondisi Khusus : {sel_cond if sel_cond else 'Tidak ada'}")
        print(f"   Alergi User    : {user_allergies if user_allergies else 'Tidak ada'}")

        def save_history(result_group):
            try:
                new_history = SearchHistory(
                    wallet_address=req.wallet_address.lower(),
                    diagnoses=[f"Analisis: {req.query_text[:50]}..."], symptoms=[],
                    special_conditions=req.kondisi, chemical_drugs=req.obat_kimia,
                    recommendations=result_group
                )
                db.add(new_history); db.commit()
                print(f"💾 [HISTORY] Tersimpan via ORM untuk: {req.wallet_address}")
            except Exception as e:
                db.rollback(); print(f"⚠️ [HISTORY] Gagal simpan: {e}")

        # ── NLP CHUNKING ──
        print(f"\n🧩 [NLP] Memecah kalimat input...")
        print(f"   Mode aktif : {ACTIVE_MODE.upper()}")

        NEGATION_WORDS = {"tidak", "tanpa", "bukan", "belum", "ga"}
        NEGATION_PHRASES = ["tidak ada", "tidak mengalami", "tidak pernah", "belum pernah"]

        delimiters = r'[.,;/!]|\bdan juga\b|\bdan\b|\bserta\b|\bjuga\b|\bmaupun\b|\bdisertai\b|\bbersama\b|\bplus\b|\bditambah\b|\bselain itu\b|\blainnya\b|\btermasuk\b|\bseperti\b|\btetapi\b'
        raw_chunks = re.split(delimiters, query_clean)

        clean_chunks = []
        skipped_chunks = []

        for chunk in raw_chunks:
            temp = chunk.strip()
            if not temp:
                continue
            words = re.sub(r'[^\w\s]', '', temp).split()

            # Cek negasi (kata tunggal + frasa)
            has_negation = (
                any(w in NEGATION_WORDS for w in words) or
                any(phrase in temp for phrase in NEGATION_PHRASES)
            )
            if has_negation:
                skipped_chunks.append(temp)
                print(f"   ⛔ [NEGASI] '{temp}' dilewati.")
                continue

            filtered_words = [w for w in words if w not in NLP_STOPWORDS]
            result = " ".join(filtered_words).strip()
            if len(result) > 2:
                clean_chunks.append(result)

        print(f"   Hasil chunks    : {clean_chunks}")
        if skipped_chunks:
            print(f"   Chunk diabaikan : {skipped_chunks}")

        grouped_data  = {}
        chunks_to_ai  = []

        # ══════════════════════════════════════════════════════════════════
        # LAPIS 1: SQL EXACT MATCH
        # Hanya dijalankan pada mode: hybrid_rag
        # Dilewati pada mode: pure_sbert, rag
        # ══════════════════════════════════════════════════════════════════
        if ACTIVE_MODE == "hybrid_rag":
            start_l1 = time.time()
            print(f"\n{'─'*60}")
            print(f"🔍 [LAPIS 1] SQL EXACT MATCHING (mode: {ACTIVE_MODE})")
            print(f"{'─'*60}")

            for chunk in clean_chunks:
                print(f"\n   🔎 Mencari: '{chunk}'")
                diag_db = db.execute(text("SELECT herbal_name FROM herbal_diagnoses WHERE TRIM(diagnosis) ILIKE TRIM(:q)"), {"q": chunk}).fetchall()
                symp_db = db.execute(text("SELECT herbal_name FROM herbal_symptoms  WHERE TRIM(symptom)   ILIKE TRIM(:q)"), {"q": chunk}).fetchall()

                if diag_db or symp_db:
                    print(f"   ✅ Ditemukan sebagai {'Diagnosis' if diag_db else 'Gejala'}")
                    baku_name = chunk.strip().capitalize()
                    db_res    = diag_db if diag_db else symp_db
                    herbs_list, unsafe_list = apply_all_filters_global(
                        {row[0] for row in db_res}, baku_name, sel_cond, user_allergies, db
                    )
                    if herbs_list or unsafe_list:
                        if baku_name not in grouped_data:
                            grouped_data[baku_name] = {
                                "group_type": "Diagnosis" if diag_db else "Gejala",
                                "group_name": baku_name,
                                "herbs": herbs_list,
                                "unsafe_herbs": unsafe_list,
                                "detected_from_list": [chunk]
                            }
                        else:
                            if chunk not in grouped_data[baku_name]["detected_from_list"]:
                                grouped_data[baku_name]["detected_from_list"].append(chunk)
                            existing_safe   = {h["name"] for h in grouped_data[baku_name]["herbs"]}
                            existing_unsafe = {u["name"] for u in grouped_data[baku_name]["unsafe_herbs"]}
                            for herb in herbs_list:
                                if herb["name"] not in existing_safe:
                                    grouped_data[baku_name]["herbs"].append(herb)
                            for u in unsafe_list:
                                if u["name"] not in existing_unsafe:
                                    grouped_data[baku_name]["unsafe_herbs"].append(u)
                    else:
                        print(f"   ⚠️ Semua herbal '{chunk}' dieliminasi filter.")
                else:
                    print(f"   ❌ Tidak ditemukan SQL → ke Lapis 2")
                    chunks_to_ai.append(chunk)

            print(f"\n⏱️  Lapis 1 selesai: {(time.time() - start_l1)*1000:.2f} ms")

        else:
            # pure_sbert / rag → semua chunk langsung ke Lapis 2
            chunks_to_ai = clean_chunks
            print(f"\n⏭️  [LAPIS 1] DILEWATI (mode: {ACTIVE_MODE}) → semua chunk ke Lapis 2")

        # ══════════════════════════════════════════════════════════════════
        # LAPIS 2: SBERT / RAG SEMANTIC MATCHING
        # Selalu dijalankan untuk semua mode
        # Isi ChromaDB (pure vs sinonim) sudah ditentukan saat update_dataset
        # ══════════════════════════════════════════════════════════════════
        final_result_groups = []

        if chunks_to_ai:
            start_l2 = time.time()
            mode_label = {
                "pure_sbert":  "PURE SBERT (tanpa sinonim)",
                "rag":         "RAG (dengan sinonim kamus)",
                "hybrid_rag":  "HYBRID RAG (fallback dari SQL)"
            }.get(ACTIVE_MODE, ACTIVE_MODE.upper())

            print(f"\n{'─'*60}")
            print(f"🧠 [LAPIS 2] {mode_label}")
            print(f"{'─'*60}")

            from sentence_transformers import SentenceTransformer
            import chromadb
            model_ai      = SentenceTransformer('intfloat/multilingual-e5-small')
            chroma_client = chromadb.PersistentClient(path="./chroma_db")
            collection    = chroma_client.get_collection(name="med_labels")

            for chunk in chunks_to_ai:
                print(f"\n   🔎 Menganalisis: '{chunk}'")
                cv = model_ai.encode([f"query: {chunk}"]).tolist()
                sr = collection.query(query_embeddings=cv, n_results=1)

                if sr['distances'][0]:
                    similarity = (1 - sr['distances'][0][0]) * 100
                    label_baku = sr['metadatas'][0][0]['baku'].strip()
                    baku_cap   = label_baku.capitalize()
                    print(f"   🤖 SBERT: '{chunk}' → '{label_baku}' (similarity: {similarity:.2f}%)")

                    if similarity >= 88.0:
                        print(f"   ✅ Diterima (≥88%). Mapping ke database...")
                        is_diag = db.execute(text("SELECT 1 FROM herbal_diagnoses WHERE TRIM(diagnosis) ILIKE TRIM(:q)"), {"q": label_baku}).first()
                        ai_db   = db.execute(text("""
                            SELECT herbal_name FROM herbal_diagnoses WHERE TRIM(diagnosis) ILIKE TRIM(:q)
                            UNION
                            SELECT herbal_name FROM herbal_symptoms  WHERE TRIM(symptom)   ILIKE TRIM(:q)
                        """), {"q": label_baku}).fetchall()

                        herbs_ai_list, unsafe_ai_list = apply_all_filters_global(
                            {r[0] for r in ai_db}, baku_cap, sel_cond, user_allergies, db
                        )

                        if herbs_ai_list or unsafe_ai_list:
                            if baku_cap not in grouped_data:
                                grouped_data[baku_cap] = {
                                    "group_type": "Diagnosis" if is_diag else "Gejala",
                                    "group_name": baku_cap,
                                    "herbs": herbs_ai_list,
                                    "unsafe_herbs": unsafe_ai_list,
                                    "detected_from_list": [chunk]
                                }
                            else:
                                if chunk not in grouped_data[baku_cap]["detected_from_list"]:
                                    grouped_data[baku_cap]["detected_from_list"].append(chunk)
                                existing_safe   = {h["name"] for h in grouped_data[baku_cap]["herbs"]}
                                existing_unsafe = {u["name"] for u in grouped_data[baku_cap]["unsafe_herbs"]}
                                for herb in herbs_ai_list:
                                    if herb["name"] not in existing_safe:
                                        grouped_data[baku_cap]["herbs"].append(herb)
                                for u in unsafe_ai_list:
                                    if u["name"] not in existing_unsafe:
                                        grouped_data[baku_cap]["unsafe_herbs"].append(u)
                        else:
                            print(f"   ⚠️ Tidak ada hasil untuk '{label_baku}'.")
                    else:
                        print(f"   ⚠️ Ditolak (similarity {similarity:.2f}% < 88%).")

            print(f"\n⏱️  Lapis 2 selesai: {(time.time() - start_l2)*1000:.2f} ms")

        elif ACTIVE_MODE in ("pure_sbert", "rag") and not chunks_to_ai:
            print(f"\n⚠️ Tidak ada chunk yang bisa dianalisis setelah filter negasi/stopword.")

            print(f"\n⏱️  Lapis 2 selesai: {(time.time() - start_l2)*1000:.2f} ms")

        # ── FINAL CONSOLIDATION ──
        print(f"\n{'─'*60}")
        print(f"📦 [FINAL CONSOLIDATION] Menyusun hasil akhir...")
        print(f"{'─'*60}")
        for name, data in grouped_data.items():
            sources = data["detected_from_list"]
            h_list  = [f'"{s}"' for s in sources]
            h_text  = ", ".join(h_list[:-1]) + f' dan {h_list[-1]}' if len(h_list) > 1 else h_list[0]
            final_result_groups.append({
                "group_type":   data["group_type"],
                "group_name":   name,
                "header_info":  f"Berdasarkan keluhan: {h_text}",
                "mapping_info": f'Berdasarkan keluhan {h_text}, sistem mengenali sebagai "{name}"',
                "herbs":        data["herbs"],
                "unsafe_herbs": data.get("unsafe_herbs", []),
            })
            print(f"   ✅ '{name}' → {len(data['herbs'])} aman, {len(data.get('unsafe_herbs', []))} dieliminasi")

        end_total = (time.time() - start_total) * 1000
        print(f"\n{'='*70}")
        print(f"✨ [SELESAI] {len(final_result_groups)} kategori ditemukan. ⏱️ {end_total:.2f} ms")
        print(f"{'='*70}\n")

        if final_result_groups:
            save_history(final_result_groups)
            return final_result_groups
        return []

    except Exception as e:
        print(f"\n🔥 [CRITICAL ERROR] {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# HISTORY ENDPOINTS
# ==============================================================================

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
            "created_at": (r[6].strftime("%Y-%m-%dT%H:%M:%S") + "Z") if r[6] else None,
            "blockchain_tx_hash": r[7], "blockchain_record_id": r[8],
            "is_on_blockchain": r[7] is not None
        } for r in result]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/history/save-to-blockchain")
def save_history_to_blockchain(req: UpdateBlockchainRequest, db: Session = Depends(get_db)):
    try:
        record = db.query(SearchHistory).filter(SearchHistory.id == req.history_id).first()
        if not record: raise HTTPException(status_code=404, detail="Riwayat tidak ditemukan")
        if record.blockchain_tx_hash: raise HTTPException(status_code=400, detail="Riwayat ini sudah disimpan ke blockchain")
        record.blockchain_tx_hash = req.tx_hash; record.blockchain_record_id = req.record_id
        db.commit(); db.refresh(record)
        return {"message": "Data blockchain berhasil disimpan", "history_id": record.id, "tx_hash": record.blockchain_tx_hash, "record_id": record.blockchain_record_id}
    except HTTPException: raise
    except Exception as e:
        db.rollback(); raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/history/{history_id}")
def delete_history(history_id: int, wallet_address: str, db: Session = Depends(get_db)):
    try:
        record = db.query(SearchHistory).filter(SearchHistory.id == history_id, SearchHistory.wallet_address == wallet_address.lower()).first()
        if not record: raise HTTPException(status_code=404, detail="Riwayat tidak ditemukan")
        record.is_deleted = True; db.commit()
        return {"message": "Riwayat berhasil dihapus dari tampilan", "note": "Data yang sudah tersimpan di blockchain tetap permanen.", "was_on_blockchain": record.blockchain_tx_hash is not None}
    except HTTPException: raise
    except Exception as e:
        db.rollback(); raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# PROFILE & USER ENDPOINTS
# ==============================================================================

@app.get("/api/profile/{wallet}")
def get_profile(wallet: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet.lower()).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    return jsonable_encoder(user)


@app.get("/api/doctors")
def get_doctors(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.role == "Doctor").order_by(User.name).all()
    return {"doctors": [{"id": u.id, "name": u.name, "email": u.email, "wallet_address": u.wallet_address, "instansi": getattr(u, 'nama_instansi', None), "spesialisasi": getattr(u, 'spesialisasi', None), "foto_profil": u.foto_profil} for u in users]}


@app.post("/api/patients/by-wallets")
def get_patients_by_wallets(req: WalletListRequest, db: Session = Depends(get_db)):
    if not req.wallets: return {"patients": []}
    normalized = [w.lower() for w in req.wallets]
    users = db.query(User).filter(func.lower(User.wallet_address).in_(normalized)).all()
    return {"patients": [{"id": u.id, "name": u.name, "email": u.email, "wallet_address": u.wallet_address, "foto_profil": u.foto_profil} for u in users]}


@app.put("/api/profile/update")
def update_profile(req: UpdateProfileRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.wallet_address) == req.wallet_address.lower()).first()
    if not user: raise HTTPException(status_code=404, detail="User tidak ditemukan")
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
    db.commit(); db.refresh(user)
    return {"message": "Profil berhasil diperbarui", "user": user.to_dict()}


# ==============================================================================
# MEDICAL RECORD DRAFT ENDPOINTS
# ==============================================================================

@app.post("/api/medical-record/draft")
def submit_draft(req: SubmitDraftRequest, db: Session = Depends(get_db)):
    patient = db.query(User).filter(func.lower(User.wallet_address) == req.patient_wallet.lower()).first()
    if not patient: raise HTTPException(status_code=404, detail="Pasien tidak ditemukan")
    existing = db.query(MedicalRecordDraft).filter(
        func.lower(MedicalRecordDraft.patient_wallet) == req.patient_wallet.lower(),
        func.lower(MedicalRecordDraft.doctor_wallet)  == req.doctor_wallet.lower(),
        MedicalRecordDraft.status == "PENDING"
    ).first()
    if existing: raise HTTPException(status_code=400, detail="Sudah ada rekam medis yang menunggu persetujuan.")
    draft = MedicalRecordDraft(patient_wallet=req.patient_wallet.lower(), doctor_wallet=req.doctor_wallet.lower(), doctor_name=req.doctor_name, doctor_instansi=req.doctor_instansi, record_data=req.record_data, status="PENDING")
    db.add(draft); db.commit(); db.refresh(draft)
    return {"message": "Rekam medis berhasil disimpan sebagai draft.", "draft": draft.to_dict()}


@app.get("/api/medical-record/draft/pending/{patient_wallet}")
def get_pending_drafts(patient_wallet: str, db: Session = Depends(get_db)):
    drafts = db.query(MedicalRecordDraft).filter(
        func.lower(MedicalRecordDraft.patient_wallet) == patient_wallet.lower(),
        MedicalRecordDraft.status == "PENDING"
    ).order_by(MedicalRecordDraft.created_at.desc()).all()
    return {"count": len(drafts), "drafts": [d.to_dict() for d in drafts]}


@app.post("/api/medical-record/draft/{draft_id}/reject")
def reject_draft(draft_id: int, db: Session = Depends(get_db)):
    draft = db.query(MedicalRecordDraft).filter(MedicalRecordDraft.id == draft_id, MedicalRecordDraft.status == "PENDING").first()
    if not draft: raise HTTPException(status_code=404, detail="Draft tidak ditemukan atau sudah diproses")
    db.delete(draft); db.commit()
    return {"message": "Draft rekam medis berhasil ditolak.", "action": "REJECTED"}


@app.post("/api/medical-record/draft/{draft_id}/approve")
def approve_draft(draft_id: int, tx_hash: str, db: Session = Depends(get_db)):
    draft = db.query(MedicalRecordDraft).filter(MedicalRecordDraft.id == draft_id, MedicalRecordDraft.status == "PENDING").first()
    if not draft: raise HTTPException(status_code=404, detail="Draft tidak ditemukan atau sudah diproses")
    db.delete(draft); db.commit()
    return {"message": "Draft berhasil dihapus. Rekam medis sudah tersimpan di blockchain.", "tx_hash": tx_hash, "action": "APPROVED"}


@app.delete("/api/account/delete")
def delete_account(req: DeleteAccountRequest, db: Session = Depends(get_db)):
    wallet = req.wallet_address.lower()
    user = db.query(User).filter(func.lower(User.wallet_address) == wallet).first()
    if not user: raise HTTPException(status_code=404, detail="Akun tidak ditemukan")
    db.execute(text("DELETE FROM search_history WHERE wallet_address = :wallet"), {"wallet": wallet})
    db.delete(user); db.commit()
    return {"message": "Akun berhasil dihapus"}