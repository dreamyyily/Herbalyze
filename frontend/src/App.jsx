import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx"; 
import DataPersonal from "./pages/DataPersonal.jsx";
import CatatanDokter from "./pages/CatatanDokter.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/data-personal" element={<DataPersonal />} />
        <Route path="/catatan-dokter" element={<CatatanDokter />} />
      </Routes>
    </BrowserRouter>
  );
}