import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Lobby from "./pages/Lobby";
import Courtroom from "./pages/Courtroom";
import GlobalLeaderboard from "./pages/GlobalLeaderboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/room/:roomId" element={<Courtroom />} />
      <Route path="/leaderboard" element={<GlobalLeaderboard />} />
    </Routes>
  );
}
