// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedicalRecordSystem {
    
    // Struktur data untuk Rekam Medis (hanya menyimpan metadata & hash IPFS)
    struct MedicalRecord {
        string ipfsCID;      // Hash CID dari IPFS yang menyimpan file rekam medis JSON/PDF
        address uploader;    // Alamat wallet pasien/dokter yang mengunggah
        uint256 timestamp;   // Waktu pengunggahan tercatat di blockchain
    }

    // Penyimpanan data utama
    mapping(uint256 => MedicalRecord) public records;
    uint256 public recordCount;

    // Role Management (Manajemen Akses)
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isApprovedUser; // Pasien/Dokter yang sudah di-ACC oleh Admin

    // Events (Untuk memudahkan pelacakan di frontend tanpa membaca seluruh block)
    event AdminAdded(address indexed newAdmin);
    event UserApproved(address indexed user);
    event UserRevoked(address indexed user);
    event MedicalRecordAdded(uint256 indexed recordId, address indexed uploader, string ipfsCID, uint256 timestamp);

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

    // --- Fungsi Utama Rekam Medis ---

    // Fungsi untuk mengunggah Rekam Medis (Hanya bisa dipanggil akun yg sudah di-ACC)
    function addMedicalRecord(string memory _ipfsCID) public onlyApprovedUser {
        recordCount++;
        
        records[recordCount] = MedicalRecord({
            ipfsCID: _ipfsCID,
            uploader: msg.sender,
            timestamp: block.timestamp
        });

        emit MedicalRecordAdded(recordCount, msg.sender, _ipfsCID, block.timestamp);
    }

    // Fungsi tambahan untuk mengambil spesifik record tanpa front-end harus manual looping mapping
    function getMedicalRecord(uint256 _recordId) public view returns (string memory ipfsCID, address uploader, uint256 timestamp) {
        require(_recordId > 0 && _recordId <= recordCount, "Record tidak ditemukan.");
        MedicalRecord memory rec = records[_recordId];
        return (rec.ipfsCID, rec.uploader, rec.timestamp);
    }
}
