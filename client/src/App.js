import { BrowserRouter} from 'react-router-dom';
import {Routes, Route } from "react-router-dom";
import Navbar from './components/navbar'
import Home from './pages/home';
import Room from './pages/room';
import Container from 'react-bootstrap/Container';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Container fluid>
        <Routes>
            <Route path='/' element={<Home/>}></Route>
            <Route path='/room' element={<Room/>}></Route>
        </Routes>
      </Container>
    </BrowserRouter>
  );
}

export default App;