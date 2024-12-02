import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Room from './pages/room';
import Lobby from './pages/lobby';
import ScreenShareTest from './pages/ScreenShareTest';
import './App.css';
import './styles.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/' element={<Lobby />} />
        <Route path='/room/:roomId' element={<Room />}></Route>
        <Route path='/ScreenShareTest' element={<ScreenShareTest />}></Route>
      </Routes>
    </Router>
  );
}

export default App;