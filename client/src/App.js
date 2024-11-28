import { BrowserRouter} from 'react-router-dom';
import {Routes, Route } from "react-router-dom";
import Navbar from './components/navbar'
import Home from './pages/home';
import Room from './pages/room';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
          <Route path='/' element={<Home/>}></Route>
          <Route path='/room' element={<Room/>}></Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;