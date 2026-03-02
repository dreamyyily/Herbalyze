// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedicalRecordSystem {
    
    // Struktur data untuk Rekam Medis (langsung menyimpan data terenkripsi)
    struct MedicalRecord {
        string encryptedData; // Berisi string JSON cipherText yang sudah dienkripsi
        address patientAddress; // Alamat wallet pasien pemilik catatan
        address uploader;    // Alamat wallet pasien/dokter yang mengunggah
        uint256 timestamp;   // Waktu pengunggahan tercatat di blockchain
    }

    // Penyimpanan data utama
    mapping(uint256 => MedicalRecord) public records;
    uint256 public recordCount;

    // Role Management (Manajemen Akses)
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isApprovedUser; // Pasien/Dokter yang sudah di-ACC oleh Admin

    // Consent System
    mapping(address => mapping(address => bool)) public patientConsent;
    mapping(address => address[]) private patientDoctors;
    mapping(address => address[]) private doctorPatients;

    // Events (Untuk memudahkan pelacakan di frontend)
    event AdminAdded(address indexed newAdmin);
    event UserApproved(address indexed user);
    event UserRevoked(address indexed user);
    event MedicalRecordAdded(uint256 indexed recordId, address indexed patientAddress, address indexed uploader, uint256 timestamp);
    event ConsentGranted(address indexed patient, address indexed doctor);
    event ConsentRevoked(address indexed patient, address indexed doctor);

    // Saat contract di-deploy, pendeploy akan otomatis menjadi Admin utama
    constructor() {
        isAdmin[msg.sender] = true;
    }

    // --- Modifiers (Pos Satpam / Penjaga Gerbang) ---

    // Hanya Admin yang bisa memanggil fungsi yang ditempel modifier ini
    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Akses ditolak: Hanya Admin yang dapat memanggil fungsi ini.");
        _;
    }

    // Hanya Akun yang di-Whitelist (atau Admin) yang bisa memanggil fungsi
    modifier onlyApprovedUser() {
        require(isApprovedUser[msg.sender] || isAdmin[msg.sender], "Akses ditolak: Akun Anda belum di-ACC oleh Admin.");
        _;
    }

    // --- Fungsi Administratif Role Management ---

    function addAdmin(address _newAdmin) public onlyAdmin {
        isAdmin[_newAdmin] = true;
        emit AdminAdded(_newAdmin);
    }

    // Whitelist akun setelah mengecek bahwa user valid di Database MySQL Backend
    function approveUser(address _user) public onlyAdmin {
        isApprovedUser[_user] = true;
        emit UserApproved(_user);
    }

    // Cabut akses jika diperlukan
    function revokeUser(address _user) public onlyAdmin {
        isApprovedUser[_user] = false;
        emit UserRevoked(_user);
    }

    // CONSENT
    function grantConsent(address doctor) public {
        require(!patientConsent[msg.sender][doctor], "Consent sudah diberikan");

        patientConsent[msg.sender][doctor] = true;

        // Hindari duplikat di array
        bool exists = false;
        for (uint i = 0; i < doctorPatients[doctor].length; i++) {
            if (doctorPatients[doctor][i] == msg.sender) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            doctorPatients[doctor].push(msg.sender);
        }

        emit ConsentGranted(msg.sender, doctor);
    }

    function revokeConsent(address _doctor) public {
        require(patientConsent[msg.sender][_doctor], "Consent belum pernah diberikan.");

        patientConsent[msg.sender][_doctor] = false;

        emit ConsentRevoked(msg.sender, _doctor);
    }

    function checkConsent(address _patient, address _doctor) public view returns (bool) {
        return patientConsent[_patient][_doctor];
    }

    function getPatientsForDoctor(address _doctor) public view returns (address[] memory) {
        address[] memory allPatients = doctorPatients[_doctor];
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allPatients.length; i++) {
            if (patientConsent[allPatients[i]][_doctor]) {
                activeCount++;
            }
        }
        address[] memory activePatients = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < allPatients.length; i++) {
            if (patientConsent[allPatients[i]][_doctor]) {
                activePatients[idx] = allPatients[i];
                idx++;
            }
        }
        return activePatients;
    }

    // --- Fungsi Utama Rekam Medis ---

    // Fungsi untuk mengunggah Rekam Medis terenkripsi (Hanya bisa dipanggil akun yg sudah di-ACC)
    function addMedicalRecord(address _patientAddress, string memory _encryptedData) public onlyApprovedUser {
        recordCount++;
        
        records[recordCount] = MedicalRecord({
            encryptedData: _encryptedData,
            patientAddress: _patientAddress,
            uploader: msg.sender,
            timestamp: block.timestamp
        });

        emit MedicalRecordAdded(recordCount, _patientAddress, msg.sender, block.timestamp);
    }

    // Fungsi tambahan untuk mengambil spesifik record tanpa front-end harus manual looping mapping
    function getMedicalRecord(uint256 _recordId) public view returns (string memory encryptedData, address patientAddress, address uploader, uint256 timestamp) {
        require(_recordId > 0 && _recordId <= recordCount, "Record tidak ditemukan.");
        MedicalRecord memory rec = records[_recordId];
        return (rec.encryptedData, rec.patientAddress, rec.uploader, rec.timestamp);
    }
}
