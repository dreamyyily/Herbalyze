from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from datetime import datetime
from db import Base

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(42), unique=True, nullable=True)
    name = Column(String(100), nullable=True)
    email = Column(String(100), unique=True, nullable=True)
    password_hash = Column(String(256), nullable=True)
    is_profile_complete = Column(Boolean, default=False)
    role = Column(String(50), default='Patient') # Status akun (Patient / Pending_Doctor / Doctor / Admin)
    nonce = Column(String(255), nullable=True)   # Menyimpan sandi acak / nonce Web3
    nomor_str = Column(String(100), nullable=True)
    nama_instansi = Column(String(255), nullable=True)
    dokumen_str_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'wallet_address': self.wallet_address,
            'name': self.name,
            'email': self.email,
            'is_profile_complete': self.is_profile_complete,
            'role': self.role
        }

class HerbalDiagnosis(Base):
    __tablename__ = 'herbal_diagnoses'
    index = Column(Integer, primary_key=True, index=True)
    diagnosis = Column(String(255))
    herbal_name = Column(Text)
    latin_name = Column(String(255))
    image_url = Column(Text)
    part_used = Column(String(255))
    part_image_url = Column(Text)
    preparation = Column(Text)
    source_label = Column(String(255))
    source = Column(Text)

class HerbalSymptom(Base):
    __tablename__ = 'herbal_symptoms'
    index = Column(Integer, primary_key=True, index=True)
    symptom = Column(String(255))
    herbal_name = Column(Text)
    latin_name = Column(String(255))
    image_url = Column(Text)
    part_used = Column(String(255))
    part_image_url = Column(Text)
    preparation = Column(Text)
    source_label = Column(String(255))
    source = Column(Text)

class HerbalSpecialCondition(Base):
    __tablename__ = 'herbal_special_conditions'
    index = Column(Integer, primary_key=True, index=True)
    herbal_name = Column(String(255))
    latin_name = Column(String(255))
    special_condition = Column(String(255))
    description = Column(Text)
    reference = Column(Text)
