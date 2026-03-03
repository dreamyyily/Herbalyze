import { ethers } from "ethers";
export const CONTRACT_ADDRESS = "0x70d3a58C6BCf87Dd13eFC58a5C69c2A0Df1eC009";
export const CONTRACT_ABI = [
  // === Role Management (Admin) ===
  "function approveUser(address _user) public",
  "function revokeUser(address _user) public",
  "function isAdmin(address) public view returns (bool)",
  "function isApprovedUser(address) public view returns (bool)",

  // === Consent System (Pasien) ===
  "function grantConsent(address _doctor) public",
  "function revokeConsent(address _doctor) public",
  "function checkConsent(address _patient, address _doctor) public view returns (bool)",
  "function getPatientsForDoctor(address _doctor) public view returns (address[] memory)",

  // === Rekam Medis (Dokter & Pasien) ===
  "function addMedicalRecord(address _patientAddress, string memory _encryptedData) public",
  "function getMedicalRecord(uint256 _recordId) public view returns (string memory encryptedData, address patientAddress, address uploader, uint256 timestamp)",
  "function recordCount() public view returns (uint256)",

  // === Events ===
  "event ConsentGranted(address indexed patient, address indexed doctor)",
  "event ConsentRevoked(address indexed patient, address indexed doctor)",
  "event MedicalRecordAdded(uint256 indexed recordId, address indexed patientAddress, address indexed uploader, uint256 timestamp)",
];

const GANACHE_RPC = "http://127.0.0.1:7545";

export const getReadOnlyContract = () => {
  const provider = new ethers.providers.JsonRpcProvider(GANACHE_RPC);
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
};

export const getSignerContract = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask tidak terdeteksi! Silakan install MetaMask.");
  }
  const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);
  const signer = provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
};

export const getSigner = async () => {
  if (!window.ethereum) {
    throw new Error("MetaMask tidak terdeteksi!");
  }
  const provider = new ethers.providers.Web3Provider(window.ethereum, "any");
  await provider.send("eth_requestAccounts", []);
  return provider.getSigner();
};

/**
 * Menyimpan data riwayat konsultasi ke blockchain.
 * @param {string} patientWallet - Alamat wallet pasien
 * @param {object} historyData - Data riwayat (diagnoses, symptoms, recommendations, dll)
 * @returns {{ txHash: string, recordId: number }}
 */
export const saveHistoryToBlockchain = async (patientWallet, historyData) => {
  // Validasi wallet address
  if (!patientWallet || typeof patientWallet !== "string") {
    throw new Error("Alamat wallet tidak valid. Pastikan wallet sudah terhubung.");
  }

  // Convert ke checksum address (format yang benar untuk ethers & MetaMask)
  // Ganache menyimpan lowercase, tapi MetaMask butuh checksum format
  let checksumWallet;
  try {
    checksumWallet = ethers.utils.getAddress(patientWallet.trim());
  } catch {
    throw new Error(`Format wallet tidak valid: ${patientWallet}`);
  }

  const contract = await getSignerContract();

  // Bungkus data sebagai JSON string — hanya ambil field penting agar tidak terlalu besar
  const payload = JSON.stringify({
    source: "Herbalyze",
    version: "1.0",
    timestamp: new Date().toISOString(),
    diagnoses: historyData.diagnoses || [],
    symptoms: historyData.symptoms || [],
    special_conditions: historyData.special_conditions || [],
    recommendations: (historyData.recommendations || []).map((group) => ({
      group_type: group.group_type,
      group_name: group.group_name,
      herbs: (group.herbs || []).map((h) => ({ name: h.name, latin: h.latin })),
    })),
  });

  // Panggil smart contract dengan checksum address
  const tx = await contract.addMedicalRecord(checksumWallet, payload);
  const receipt = await tx.wait(); // Tunggu sampai di-mine

  // Ambil record ID dari event — dengan fallback ke recordCount jika events kosong (Ganache quirk)
  let recordId = null;
  try {
    const event = (receipt.events || []).find((e) => e.event === "MedicalRecordAdded");
    if (event && event.args && event.args.recordId) {
      recordId = event.args.recordId.toNumber();
    } else {
      // Fallback: ambil dari smart contract langsung
      const count = await contract.recordCount();
      recordId = count.toNumber();
    }
  } catch (eventError) {
    console.warn("Gagal membaca event, menggunakan fallback recordCount:", eventError);
    try {
      const count = await contract.recordCount();
      recordId = count.toNumber();
    } catch {
      recordId = null;
    }
  }

  return {
    txHash: receipt.transactionHash,
    recordId: recordId,
  };
};

