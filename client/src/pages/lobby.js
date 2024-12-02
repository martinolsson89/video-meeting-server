import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Lobby() {
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleJoin = (e) => {
    e.preventDefault();
    if (userName && roomId) {
      // Save the user name to localStorage or context
      sessionStorage.setItem('userName', userName);
      // Navigate to the room
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div className="container mt-5">
      <h1 className="mb-4">Join a Room</h1>
      <form onSubmit={handleJoin}>
        <div className="mb-3">
          <label className="form-label">Your Name</label>
          <input
            type="text"
            className="form-control"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Room ID</label>
          <input
            type="text"
            className="form-control"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Join Room</button>
      </form>
    </div>
  );
}

export default Lobby;
