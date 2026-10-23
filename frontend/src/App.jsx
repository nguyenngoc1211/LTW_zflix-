import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import PartyList from "./pages/PartyList.jsx";
import CreateParty from "./pages/CreateParty.jsx";
import PartyRoom from "./pages/PartyRoom.jsx";

export default function App() {
  const [activeUserKey, setActiveUserKey] = useState(Date.now());

  const handleUserChange = () => {
    setActiveUserKey(Date.now());
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
        <Navbar onUserChange={handleUserChange} />

        <main className="flex-1 pb-16" key={activeUserKey}>
          <Routes>
            <Route path="/" element={<PartyList />} />
            <Route path="/create" element={<CreateParty />} />
            <Route path="/room/:partyId" element={<PartyRoom />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="border-t border-white/5 py-6 text-center text-xs text-neutral-500">
          <p className="m-0">
            🎬 <strong>Zflix Watch Party Module</strong> — Xây dựng bởi{" "}
            <span className="text-neutral-300 font-semibold">Khoa</span> (React, Express, Socket.IO, MySQL)
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}
