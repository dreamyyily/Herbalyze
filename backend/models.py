
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    wallet_address = db.Column(db.String(42), unique=True, nullable=True) # Nullable true because now we support email register first then connect wallet
    name = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(100), unique=True, nullable=True)
    password_hash = db.Column(db.String(256), nullable=True)
    is_profile_complete = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'wallet_address': self.wallet_address,
            'name': self.name,
            'email': self.email,
            'is_profile_complete': self.is_profile_complete
        }

class HerbalDiagnosis(db.Model):
    __tablename__ = 'herbal_diagnoses'
    index = db.Column(db.Integer, primary_key=True)
    diagnosis = db.Column(db.String(255))
    herbal_name = db.Column(db.Text)
    latin_name = db.Column(db.String(255))
    image_url = db.Column(db.Text)
    part_used = db.Column(db.String(255))
    part_image_url = db.Column(db.Text)
    preparation = db.Column(db.Text)
    source_label = db.Column(db.String(255))
    source = db.Column(db.Text)

class HerbalSymptom(db.Model):
    __tablename__ = 'herbal_symptoms'
    index = db.Column(db.Integer, primary_key=True)
    symptom = db.Column(db.String(255))
    herbal_name = db.Column(db.Text)
    latin_name = db.Column(db.String(255))
    image_url = db.Column(db.Text)
    part_used = db.Column(db.String(255))
    part_image_url = db.Column(db.Text)
    preparation = db.Column(db.Text)
    source_label = db.Column(db.String(255))
    source = db.Column(db.Text)

class HerbalSpecialCondition(db.Model):
    __tablename__ = 'herbal_special_conditions'
    index = db.Column(db.Integer, primary_key=True)
    herbal_name = db.Column(db.String(255))
    latin_name = db.Column(db.String(255))
    special_condition = db.Column(db.String(255))  # hamil, menyusui, anak di bawah 5 tahun, dll
    description = db.Column(db.Text)  # deskripsi efek
    reference = db.Column(db.Text)  # referensi
