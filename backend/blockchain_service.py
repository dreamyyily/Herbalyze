"""
blockchain_service.py
Layanan backend untuk berinteraksi dengan Smart Contract MedicalRecord
menggunakan private key Admin. Auto-approve wallet user saat register/connect.
"""

import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

# ── Konfigurasi dari .env ──
GANACHE_RPC_URL = os.getenv("GANACHE_RPC_URL", "http://127.0.0.1:7545")
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "")
ADMIN_PRIVATE_KEY = os.getenv("ADMIN_PRIVATE_KEY", "")

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
