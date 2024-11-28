import {Routes, Route } from "react-router-dom";
import Home from '../pages/home';
import Room from '../pages/room';

export function AppRouter() {
    return (
      <Routes>
          <Route path='/' element={<Home/>}></Route>
          <Route path='/room' element={<Room/>}></Route>
      </Routes>
    )
  }