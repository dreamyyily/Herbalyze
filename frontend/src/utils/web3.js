import { ethers } from "ethers";
export const CONTRACT_ADDRESS = "0x7A153E2305e79a750e3621630D9B76C090Db926D";
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
