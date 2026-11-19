import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ArenaView from './pages/ArenaView';
import PlayerView from './pages/PlayerView';
import SpectatorView from './pages/SpectatorView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/arena/:roomCode" element={<ArenaView />} />
        <Route path="/play/:roomCode" element={<PlayerView />} />
        <Route path="/spectate/:roomCode" element={<SpectatorView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
