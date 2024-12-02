// components/Room.js
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [userName] = useState(localStorage.getItem('userName'));
  const [participants, setParticipants] = useState([]);
  const socketRef = useRef();

  useEffect(() => {
    if (!userName) {
      navigate('/');
      return;
    }

    // Initialize socket connection
    socketRef.current = io('http://localhost:8080');

    // Join the room
    socketRef.current.emit('join-room', { roomId, userName });

    // Listen for existing peers
    socketRef.current.on('existing-peers', ({ peers }) => {
      setParticipants(peers);
    });

    // Listen for new users joining
    socketRef.current.on('user-connected', ({ id, userName }) => {
      setParticipants((prevParticipants) => [
        ...prevParticipants,
        { id, userName },
      ]);
    });

    // Listen for users disconnecting
    socketRef.current.on('user-disconnected', ({ id }) => {
      setParticipants((prevParticipants) =>
        prevParticipants.filter((user) => user.id !== id)
      );
    });

    // Clean up on component unmount
    return () => {
      socketRef.current.disconnect();
    };
  }, [userName, roomId, navigate]);

  return (
    <div className="room-container d-flex">
      <div className="participants-list border-end p-3">
        <h3>Participants</h3>
        <ul className="list-unstyled">
          {participants.map((user) => (
            <li key={user.id}>{user.userName}</li>
          ))}
        </ul>
      </div>
      <div className="screen-sharing flex-fill p-3">
        {/* Screen sharing component goes here */}
      </div>
      <div className="chat-box border-start p-3">
        {/* Chat component goes here */}
      </div>
    </div>
  );
}

export default Room;
