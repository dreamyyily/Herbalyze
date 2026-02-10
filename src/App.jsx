import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx"; 
import DataPersonal from "./pages/DataPersonal.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/personal" element={<DataPersonal />} />
      </Routes>
    </BrowserRouter>
  );
}