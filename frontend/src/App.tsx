import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import ArenaView from './pages/ArenaView';
import PracticeView from './pages/PracticeView';
import { JoinRoute, SpectateRoute } from './pages/PlayerView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/practice" element={<PracticeView />} />
        <Route path="/arena/:roomCode" element={<ArenaView />} />
        {/* First 2 joiners become players, everyone after is auto-assigned to spectator */}
        <Route path="/play/:roomCode" element={<JoinRoute />} />
        <Route path="/join/:roomCode" element={<JoinRoute />} />
        <Route path="/spectate/:roomCode" element={<SpectateRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
