"""
blockchain_service.py
Layanan backend untuk berinteraksi dengan Smart Contract MedicalRecord
menggunakan private key Admin. Auto-approve wallet user saat register/connect.
"""

import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv(override=True)

# ── Konfigurasi dari .env ──
GANACHE_RPC_URL = os.getenv("GANACHE_RPC_URL", "http://127.0.0.1:7545")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "")
ADMIN_PRIVATE_KEY = os.getenv("ADMIN_PRIVATE_KEY", "")

print(f"[blockchain_service] CONTRACT_ADDRESS: {CONTRACT_ADDRESS[:10] if CONTRACT_ADDRESS else 'KOSONG'}...")
print(f"[blockchain_service] ADMIN_PRIVATE_KEY: {'SET (' + ADMIN_PRIVATE_KEY[:6] + '...)' if ADMIN_PRIVATE_KEY else 'KOSONG!'}")

# ── ABI minimal yang diperlukan backend ──
CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "_user", "type": "address"}],
        "name": "approveUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "_user", "type": "address"}],
        "name": "revokeUser",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "isApprovedUser",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "isAdmin",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "address", "name": "_patientAddress", "type": "address"},
            {"internalType": "string", "name": "_encryptedData", "type": "string"}
        ],
        "name": "addMedicalRecord",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "uint256", "name": "recordId", "type": "uint256"},
            {"indexed": True, "internalType": "address", "name": "patientAddress", "type": "address"},
            {"indexed": True, "internalType": "address", "name": "uploader", "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "name": "MedicalRecordAdded",
        "type": "event"
    },
]


def get_web3():
    """Membuat koneksi Web3 ke Ganache."""
    w3 = Web3(Web3.HTTPProvider(GANACHE_RPC_URL))
    return w3


def get_contract(w3: Web3):
    """Mendapatkan instance smart contract."""
    checksum_address = Web3.to_checksum_address(CONTRACT_ADDRESS)
    return w3.eth.contract(address=checksum_address, abi=CONTRACT_ABI)


def approve_wallet_on_chain(wallet_address: str) -> dict:
    """
    Memanggil approveUser(wallet_address) di smart contract sebagai Admin.
    Dipanggil oleh backend saat pasien connect wallet atau dokter di-approve.

    Returns:
        dict dengan 'success': True/False dan 'tx_hash' atau 'error'
    """
    if not ADMIN_PRIVATE_KEY or ADMIN_PRIVATE_KEY == "GANTI_DENGAN_PRIVATE_KEY_AKUN_PERTAMA_GANACHE":
        print("⚠️ ADMIN_PRIVATE_KEY belum dikonfigurasi di .env — skip blockchain approve")
        return {"success": False, "error": "ADMIN_PRIVATE_KEY belum dikonfigurasi di .env"}

    if not CONTRACT_ADDRESS:
        return {"success": False, "error": "CONTRACT_ADDRESS belum dikonfigurasi di .env"}

    try:
        w3 = get_web3()
        if not w3.is_connected():
            return {"success": False, "error": "Tidak bisa terhubung ke Ganache. Pastikan Ganache berjalan di port 7545."}

        contract = get_contract(w3)
        admin_account = w3.eth.account.from_key(ADMIN_PRIVATE_KEY)
        checksum_wallet = Web3.to_checksum_address(wallet_address)

        # Cek apakah sudah di-approve (hindari gas terbuang)
        already_approved = contract.functions.isApprovedUser(checksum_wallet).call()
        if already_approved:
            print(f"ℹ️ Wallet {wallet_address} sudah di-approve sebelumnya, skip.")
            return {"success": True, "tx_hash": None, "already_approved": True}

        # Bangun transaksi approveUser
        nonce = w3.eth.get_transaction_count(admin_account.address)
        txn = contract.functions.approveUser(checksum_wallet).build_transaction({
            "from": admin_account.address,
            "nonce": nonce,
            "gas": 100000,
            "gasPrice": w3.eth.gas_price,
        })

        # Sign & kirim
        signed_txn = w3.eth.account.sign_transaction(txn, private_key=ADMIN_PRIVATE_KEY)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status == 1:
            print(f"✅ approveUser({wallet_address}) sukses. TX: {tx_hash.hex()}")
            return {"success": True, "tx_hash": tx_hash.hex()}
        else:
            return {"success": False, "error": "Transaksi gagal (status=0)"}

    except Exception as e:
        print(f"❌ Error approve_wallet_on_chain({wallet_address}): {e}")
        return {"success": False, "error": str(e)}


def is_wallet_approved(wallet_address: str) -> bool:
    """
    Cek apakah wallet sudah di-approve di smart contract.
    Returns True/False, atau False jika tidak bisa konek.
    """
    try:
        w3 = get_web3()
        if not w3.is_connected():
            return False
        contract = get_contract(w3)
        checksum_wallet = Web3.to_checksum_address(wallet_address)
        return contract.functions.isApprovedUser(checksum_wallet).call()
    except Exception as e:
        print(f"⚠️ is_wallet_approved error: {e}")
        return False


def add_medical_record_on_chain(patient_wallet: str, encrypted_data: str) -> dict:
    """
    Menyimpan rekam medis terenkripsi ke blockchain menggunakan admin private key.
    Dipanggil saat pasien menyetujui draft rekam medis.
    """
    # Baca ulang dari env setiap kali dipanggil (hindari stale module-level vars)
    load_dotenv(override=True)
    _admin_key = os.getenv("ADMIN_PRIVATE_KEY", "")
    _contract_addr = os.getenv("CONTRACT_ADDRESS", "")
    _rpc_url = os.getenv("GANACHE_RPC_URL", "http://127.0.0.1:7545")

    print(f"[add_medical_record] ADMIN_KEY: {'SET' if _admin_key else 'KOSONG'}")
    print(f"[add_medical_record] CONTRACT : {_contract_addr}")

    if not _admin_key or _admin_key == "GANTI_DENGAN_PRIVATE_KEY_AKUN_PERTAMA_GANACHE":
        return {"success": False, "error": "ADMIN_PRIVATE_KEY belum dikonfigurasi di .env"}

    if not _contract_addr:
        return {"success": False, "error": "CONTRACT_ADDRESS belum dikonfigurasi di .env"}

    try:
        w3 = Web3(Web3.HTTPProvider(_rpc_url))
        if not w3.is_connected():
            return {"success": False, "error": "Tidak bisa terhubung ke Ganache. Pastikan Ganache berjalan di port 7545."}

        checksum_contract = Web3.to_checksum_address(_contract_addr)
        contract = w3.eth.contract(address=checksum_contract, abi=CONTRACT_ABI)
        admin_account = w3.eth.account.from_key(_admin_key)
        checksum_patient = Web3.to_checksum_address(patient_wallet)

        nonce = w3.eth.get_transaction_count(admin_account.address)
        txn = contract.functions.addMedicalRecord(
            checksum_patient,
            encrypted_data
        ).build_transaction({
            "from": admin_account.address,
            "nonce": nonce,
            "gas": 500000,
            "gasPrice": w3.eth.gas_price,
        })

        signed_txn = w3.eth.account.sign_transaction(txn, private_key=_admin_key)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

        if receipt.status == 1:
            # Coba ambil recordId dari event
            record_id = None
            try:
                logs = contract.events.MedicalRecordAdded().process_receipt(receipt)
                if logs:
                    record_id = logs[0]['args']['recordId']
            except Exception:
                pass

            print(f"✅ addMedicalRecord sukses untuk {patient_wallet}. TX: {tx_hash.hex()}")
            return {
                "success": True,
                "tx_hash": tx_hash.hex(),
                "record_id": record_id
            }
        else:
            return {"success": False, "error": "Transaksi gagal (status=0)"}

    except Exception as e:
        print(f"❌ Error add_medical_record_on_chain({patient_wallet}): {e}")
        return {"success": False, "error": str(e)}
