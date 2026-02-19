
from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, User, HerbalDiagnosis, HerbalSymptom, HerbalSpecialCondition
from werkzeug.security import generate_password_hash, check_password_hash

import os
from dotenv import load_dotenv
from eth_account.messages import encode_defunct
from eth_account import Account

load_dotenv()

app = Flask(__name__)
# Configure Database
db_user = os.getenv('DB_USER', 'postgres')
db_password = os.getenv('DB_PASSWORD', 'password')
db_host = os.getenv('DB_HOST', 'localhost')
db_port = os.getenv('DB_PORT', '5432')
db_name = os.getenv('DB_NAME', 'herbalyze_db')

app.config['SQLALCHEMY_DATABASE_URI'] = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configure CORS to allow frontend origin (permissive for development)
CORS(app, 
     origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
     methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
     allow_headers=["Content-Type", "Authorization"],
     supports_credentials=True)

db.init_app(app)

# Initialize database tables
try:
    with app.app_context():
        db.create_all()
        print("Database tables created successfully")
except Exception as e:
    print(f"Warning: Database initialization error: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

# Error handler for CORS preflight requests
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "*")
        response.headers.add('Access-Control-Allow-Methods', "*")
        return response


# AUTH: Email Register
@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        name = data.get('name')
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400
        
        # Check if email already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 400

        # Hash password and create user
        hashed_pw = generate_password_hash(password)
        new_user = User(name=name, email=email, password_hash=hashed_pw)
        
        db.session.add(new_user)
        db.session.commit()

        return jsonify({'message': 'Registration successful', 'user': new_user.to_dict()}), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"Registration error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500

# AUTH: Email Login
@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        user = User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({'error': 'Invalid email or password'}), 401

        return jsonify({'message': 'Login successful', 'user': user.to_dict()}), 200
    
    except Exception as e:
        print(f"Login error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

# AUTH: Connect Wallet to Account (with signature verification)
@app.route('/api/connect-wallet', methods=['POST'])
def connect_wallet():
    try:
        data = request.json
        user_id = data.get('user_id')
        wallet_address = data.get('wallet_address')
        signature = data.get('signature')
        message = data.get('message')

        if not user_id or not wallet_address:
            return jsonify({'error': 'User ID and wallet address are required'}), 400

        wallet_address = wallet_address.lower()

        # Verify signature if provided (for security)
        if signature and message:
            if not verify_signature(message, signature, wallet_address):
                return jsonify({'error': 'Invalid signature. Wallet linking failed.'}), 401

        # Check if wallet already taken by another user
        existing_user = User.query.filter_by(wallet_address=wallet_address).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({'error': 'Wallet already linked to another account'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        user.wallet_address = wallet_address
        db.session.commit()

        return jsonify({'message': 'Wallet linked successfully', 'user': user.to_dict()}), 200
    
    except Exception as e:
        print(f"Connect wallet error: {e}")
        return jsonify({'error': f'Failed to link wallet: {str(e)}'}), 500

# Helper function to verify signature (FREE - no gas fee, just cryptographic verification)
def verify_signature(message, signature, address):
    try:
        # Encode the message in the same format MetaMask uses
        message_hash = encode_defunct(text=message)
        # Recover the address from signature
        recovered_address = Account.recover_message(message_hash, signature=signature)
        # Compare addresses (case-insensitive)
        return recovered_address.lower() == address.lower()
    except Exception as e:
        print(f"Signature verification error: {e}")
        return False

# AUTH: Login with Wallet using Signature (FREE - no gas fee)
@app.route('/api/login-wallet', methods=['POST'])
def login_wallet():
    try:
        data = request.json
        wallet_address = data.get('wallet_address')
        signature = data.get('signature')
        message = data.get('message')

        if not wallet_address:
            return jsonify({'error': 'Wallet address is required'}), 400
        
        if not signature or not message:
            return jsonify({'error': 'Signature and message are required for secure authentication'}), 400

        # Ensure address is stored consistently (lowercase)
        wallet_address = wallet_address.lower()

        # Verify signature
        if not verify_signature(message, signature, wallet_address):
            return jsonify({'error': 'Invalid signature. Authentication failed.'}), 401

        # Find or create user
        user = User.query.filter_by(wallet_address=wallet_address).first()

        if not user:
            # Auto-register new wallet users (pure web3 users)
            user = User(wallet_address=wallet_address)
            db.session.add(user)
            db.session.commit()
            return jsonify({
                'message': 'User registered via wallet',
                'user': user.to_dict()
            }), 201
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict()
        }), 200
    
    except Exception as e:
        print(f"Login wallet error: {e}")
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

# HERBALS: Get Diagnoses with Formatted Names
@app.route('/api/diagnoses', methods=['GET'])
def get_diagnoses():
    # REPLACE(herbal_name, ', ', CHR(10)) logic
    query = db.session.query(
        HerbalDiagnosis.index,
        HerbalDiagnosis.diagnosis,
        db.func.replace(HerbalDiagnosis.herbal_name, ', ', '\n').label('formatted_herbal_name'),
        HerbalDiagnosis.latin_name,
        HerbalDiagnosis.image_url,
        HerbalDiagnosis.preparation,
        HerbalDiagnosis.source_label,
        HerbalDiagnosis.source
    ).limit(50).all() # Limit for performance while testing

    results = []
    for h in query:
        results.append({
            'id': h.index,
            'diagnosis': h.diagnosis,
            'herbal_name': h.formatted_herbal_name,
            'latin_name': h.latin_name,
            'image_url': h.image_url,
            'preparation': h.preparation,
            'source_label': h.source_label,
            'source': h.source
        })

    return jsonify(results), 200

# HERBALS: Get Symptoms with Formatted Names
@app.route('/api/symptoms', methods=['GET'])
def get_symptoms():
    query = db.session.query(
        HerbalSymptom.index,
        HerbalSymptom.symptom,
        db.func.replace(HerbalSymptom.herbal_name, ', ', '\n').label('formatted_herbal_name'),
        HerbalSymptom.latin_name,
        HerbalSymptom.image_url,
        HerbalSymptom.preparation,
        HerbalSymptom.source_label,
        HerbalSymptom.source
    ).limit(50).all()

    results = []
    for h in query:
        results.append({
            'id': h.index,
            'symptom': h.symptom,
            'herbal_name': h.formatted_herbal_name,
            'latin_name': h.latin_name,
            'image_url': h.image_url,
            'preparation': h.preparation,
            'source_label': h.source_label,
            'source': h.source
        })

    return jsonify(results), 200

# HERBALS: Get Special Conditions (kondisi khusus)
@app.route('/api/special-conditions', methods=['GET'])
def get_special_conditions():
    try:
        # Optional query params
        herbal_name = request.args.get('herbal_name')
        latin_name = request.args.get('latin_name')
        condition = request.args.get('condition')  # hamil, menyusui, anak di bawah 5 tahun
        
        query = db.session.query(HerbalSpecialCondition)
        
        # Filter by herbal name if provided
        if herbal_name:
            query = query.filter(HerbalSpecialCondition.herbal_name.ilike(f'%{herbal_name}%'))
        
        # Filter by latin name if provided
        if latin_name:
            query = query.filter(HerbalSpecialCondition.latin_name.ilike(f'%{latin_name}%'))
        
        # Filter by condition if provided
        if condition:
            query = query.filter(HerbalSpecialCondition.special_condition.ilike(f'%{condition}%'))
        
        results = []
        for h in query.all():
            results.append({
                'id': h.index,
                'herbal_name': h.herbal_name,
                'latin_name': h.latin_name,
                'special_condition': h.special_condition,
                'description': h.description,
                'reference': h.reference
            })
        
        return jsonify(results), 200
    
    except Exception as e:
        print(f"Error fetching special conditions: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to fetch special conditions: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
