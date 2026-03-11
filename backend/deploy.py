import os
import re
import sys
import json
import bcrypt
from pathlib import Path
from web3 import Web3
from sqlalchemy.orm import Session

GANACHE_URL     = "http://127.0.0.1:7545"
ADMIN_WALLET    = "0xAE056cd85830Ffa9EEB039BD85b552dD2A5a5C8B"
ADMIN_EMAIL     = "admin@herbalyze.com"
ADMIN_PASSWORD  = "admin123"
ADMIN_NAME      = "Admin Herbalyze"

BASE_DIR     = Path(__file__).parent
CONTRACT_SOL = BASE_DIR / "contracts" / "MedicalRecord.sol"
ENV_FILE     = BASE_DIR / ".env"
WEB3_JS      = BASE_DIR.parent / "frontend" / "src" / "utils" / "web3.js"

def compile_contract():
    try:
        from solcx import compile_standard, install_solc
    except ImportError:
        os.system(f"{sys.executable} -m pip install py-solc-x")
        from solcx import compile_standard, install_solc

    install_solc("0.8.20", show_progress=False)

    sol_source = CONTRACT_SOL.read_text()
    compiled = compile_standard(
        {
            "language": "Solidity",
            "sources": {"MedicalRecord.sol": {"content": sol_source}},
            "settings": {
                "evmVersion": "paris",
                "outputSelection": {
                    "*": {"*": ["abi", "evm.bytecode"]}
                }
            },
        },
        solc_version="0.8.20",
    )
    contract_data = compiled["contracts"]["MedicalRecord.sol"]["MedicalRecordSystem"]
    return contract_data["abi"], contract_data["evm"]["bytecode"]["object"]


def deploy_contract(w3, abi, bytecode, deployer_address, private_key):
    Contract = w3.eth.contract(abi=abi, bytecode=bytecode)

    nonce = w3.eth.get_transaction_count(deployer_address)
    tx = Contract.constructor().build_transaction({
        "from":     deployer_address,
        "nonce":    nonce,
        "gas":      3_000_000,
        "gasPrice": w3.to_wei("1", "gwei"),
    })

    signed = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    
    return receipt.contractAddress


def update_env(contract_address, private_key):
    content = ENV_FILE.read_text()

    if "CONTRACT_ADDRESS=" in content:
        content = re.sub(r"CONTRACT_ADDRESS=.*", f"CONTRACT_ADDRESS={contract_address}", content)
    else:
        content += f"\nCONTRACT_ADDRESS={contract_address}"

    if "ADMIN_PRIVATE_KEY=" in content:
        content = re.sub(r"ADMIN_PRIVATE_KEY=.*", f"ADMIN_PRIVATE_KEY={private_key}", content)
    else:
        content += f"\nADMIN_PRIVATE_KEY={private_key}"

    ENV_FILE.write_text(content)


def update_web3_js(contract_address):
    if not WEB3_JS.exists(): return

    content = WEB3_JS.read_text()
    content = re.sub(
        r'export const CONTRACT_ADDRESS = "0x[0-9a-fA-F]+";',
        f'export const CONTRACT_ADDRESS = "{contract_address}";',
        content
    )
    WEB3_JS.write_text(content)


def setup_admin_db(wallet_address):
    from db import SessionLocal
    from models import User

    db: Session = SessionLocal()
    try:
        wallet_lower = wallet_address.lower()

        existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if not existing:
            existing = db.query(User).filter(User.wallet_address == wallet_lower).first()

        pw_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()

        if existing:
            existing.wallet_address = wallet_lower
            existing.role = "Admin"
            existing.is_profile_complete = True
            existing.password_hash = pw_hash
            db.commit()
        else:
            admin = User(
                name=ADMIN_NAME, email=ADMIN_EMAIL,
                password_hash=pw_hash, wallet_address=wallet_lower,
                role="Admin", is_profile_complete=True,
            )
            db.add(admin)
            db.commit()

    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


def main():
    w3 = Web3(Web3.HTTPProvider(GANACHE_URL))
    if not w3.is_connected(): sys.exit(1)

    accounts = w3.eth.accounts
    deployer = Web3.to_checksum_address(ADMIN_WALLET) if ADMIN_WALLET else accounts[0]

    private_key = None
    if ENV_FILE.exists():
        match = re.search(r"ADMIN_PRIVATE_KEY=(0x[0-9a-fA-F]+)", ENV_FILE.read_text())
        if match:
            try:
                if w3.eth.account.from_key(match.group(1)).address.lower() == deployer.lower():
                    private_key = match.group(1)
            except: pass

    if not private_key:
        private_key = input("Private Key (0x...): ").strip()

    try:
        abi, bytecode = compile_contract()
    except: sys.exit(1)

    contract_address = deploy_contract(w3, abi, bytecode, deployer, private_key)

    update_env(contract_address, private_key)
    update_web3_js(contract_address)
    setup_admin_db(deployer)

    print(f"Contract : {contract_address}")
    print(f"Admin    : {deployer}")


if __name__ == "__main__":
    main()
