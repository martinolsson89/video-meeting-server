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
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});

  useEffect(() => {
    if (!userName) {
      navigate('/');
      return;
    }

    socketRef.current = io(SIGNALING_SERVER_URL);

    socketRef.current.emit('join-room', { roomId, userName });

    socketRef.current.on('existing-peers', ({ peers }) => {
      setParticipants(peers);
      peers.forEach((peer) => initiatePeerConnection(peer.id, true));
    });

    socketRef.current.on('user-connected', ({ id, userName }) => {
      setParticipants((prev) => [...prev, { id, userName }]);
      initiatePeerConnection(id, false);
    });

    socketRef.current.on('user-disconnected', ({ id }) => {
      if (peersRef.current[id]) {
        peersRef.current[id].destroy();
        delete peersRef.current[id];
      }
      setParticipants((prev) => prev.filter((user) => user.id !== id));
    });

    socketRef.current.on('exchangeSDP', ({ sdp, sender }) => {
      if (peersRef.current[sender]) {
        peersRef.current[sender].signal(sdp);
      }
    });

    return () => {
      socketRef.current.disconnect();
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
    };
  }, [roomId, userName, navigate]);

  const initiatePeerConnection = (peerId, initiator = true) => {
    const peer = new SimplePeer({
      initiator,
      trickle: false,
      stream: localStreamRef.current,
    });

    peer.on('signal', (data) => {
      socketRef.current.emit('exchangeSDP', {
        target: peerId,
        sdp: data,
      });
    });

    peer.on('stream', (remoteStream) => {
      if (!remoteVideoRefs.current[peerId]) {
        const videoElement = document.createElement('video');
        videoElement.style.width = '45%';
        videoElement.style.margin = '10px';
        videoElement.autoplay = true;
        videoElement.controls = true;
        videoElement.srcObject = remoteStream;
        document.getElementById('remoteVideos').appendChild(videoElement);
        remoteVideoRefs.current[peerId] = videoElement;
      }
    });

    peer.on('close', () => {
      if (remoteVideoRefs.current[peerId]) {
        remoteVideoRefs.current[peerId].remove();
        delete remoteVideoRefs.current[peerId];
      }
    });

    peersRef.current[peerId] = peer;
  };

  const shareScreen = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = screenStream;
      setIsSharing(true);

      Object.values(peersRef.current).forEach((peer) => {
        screenStream.getTracks().forEach((track) => {
          peer.addTrack(track, screenStream);
        });
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      screenStream.oninactive = () => {
        stopSharing();
      };
    } catch (err) {
      console.error('Error sharing screen:', err);
    }
  };

  const stopSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
      setIsSharing(false);

      Object.values(peersRef.current).forEach((peer) => {
        peer.removeTrack(peer.streams[0]);
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
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
        <button
          onClick={isSharing ? stopSharing : shareScreen}
          style={{ marginBottom: '20px' }}
        >
          {isSharing ? 'Stop Sharing' : 'Share Screen'}
        </button>
        <div>
          <h3>Local Video</h3>
          <video ref={localVideoRef} style={{ width: '45%' }} muted />
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
