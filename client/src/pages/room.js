import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

const SIGNALING_SERVER_URL = 'http://localhost:8080';

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [userName] = useState(localStorage.getItem('userName'));
  const [participants, setParticipants] = useState([]);
  const [isSharing, setIsSharing] = useState(false);

  const socketRef = useRef();
  const peersRef = useRef({});
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});

  useEffect(() => {
    if (!userName) {
      navigate('/');
      return;
    }

    // Initialize socket connection
    socketRef.current = io(SIGNALING_SERVER_URL);

    // Join the room
    socketRef.current.emit('join-room', { roomId, userName });

    // Listen for existing peers and participants
    socketRef.current.on('existing-peers', ({ peers }) => {
      setParticipants(peers);
      peers.forEach((peerId) => {
        if (!peersRef.current[peerId]) {
          initiatePeerConnection(peerId, true); // New peer initiates connection
        }
      });
    });

    // Listen for new users joining
    socketRef.current.on('user-connected', ({ id, userName }) => {
      setParticipants((prevParticipants) => [
        ...prevParticipants,
        { id, userName },
      ]);
      if (!peersRef.current[id]) {
        initiatePeerConnection(id, false); // New user connects
      }
    });

    // Listen for users disconnecting
    socketRef.current.on('user-disconnected', ({ id }) => {
      setParticipants((prevParticipants) =>
        prevParticipants.filter((user) => user.id !== id)
      );
      if (peersRef.current[id]) {
        peersRef.current[id].destroy();
        delete peersRef.current[id];
        if (remoteVideoRefs.current[id]) {
          remoteVideoRefs.current[id].srcObject = null;
          delete remoteVideoRefs.current[id];
        }
      }
    });

    // Cleanup on component unmount
    return () => {
      socketRef.current.disconnect();
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
    };
  }, [userName, roomId, navigate]);

  // Function to initiate a peer connection
  const initiatePeerConnection = (peerId, initiator = true) => {
    const peerOptions = {
      initiator,
      trickle: false,
      stream: screenStreamRef.current, // Send screen stream if sharing
    };

    const peer = new SimplePeer(peerOptions);

    peer.on('signal', (data) => {
      socketRef.current.emit('exchangeSDP', {
        target: peerId,
        sdp: data,
      });
    });

    peer.on('stream', (remoteStream) => {
      if (!remoteVideoRefs.current[peerId]) {
        remoteVideoRefs.current[peerId] = document.createElement('video');
        remoteVideoRefs.current[peerId].style.width = '45%';
        remoteVideoRefs.current[peerId].style.marginRight = '10%';
        remoteVideoRefs.current[peerId].autoplay = true;
        remoteVideoRefs.current[peerId].controls = true;
        document.getElementById('remoteVideos').appendChild(remoteVideoRefs.current[peerId]);
      }
      remoteVideoRefs.current[peerId].srcObject = remoteStream;
    });

    peer.on('close', () => {
      delete peersRef.current[peerId];
      setParticipants((prev) => prev.filter((p) => p.id !== peerId));
      if (remoteVideoRefs.current[peerId]) {
        remoteVideoRefs.current[peerId].srcObject = null;
      }
    });

    peer.on('error', (err) => {
      console.error(`Error with peer ${peerId}:`, err);
    });

    peersRef.current[peerId] = peer;
  };

  // Function to share the screen
  const shareScreen = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = stream;
      setIsSharing(true);

      // Display the local screen
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play();
      }

      // Send the screen stream to all peers
      Object.values(peersRef.current).forEach((peer) => {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream);
        });
      });
    } catch (err) {
      console.error('Error accessing display media:', err);
    }
  };

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
        <h2>WebRTC Screen Sharing</h2>
        <button onClick={shareScreen} style={{ marginBottom: '20px' }}>
          Share Screen
        </button>
        <div>
          <h3>Local Screen</h3>
          <video ref={localVideoRef} style={{ width: '45%', marginRight: '10%' }} muted />
        </div>
        <div id="remoteVideos">
          <h3>Remote Screens</h3>
        </div>
      </div>
      <div className="chat-box border-start p-3">
        {/* Chat component goes here */}
      </div>
    </div>
  );
}

export default Room;
