import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

const SIGNALING_SERVER_URL = 'http://localhost:8080';

function Room() {
  const { roomId: routeRoomId } = useParams();
  const navigate = useNavigate();
  const [userName] = useState(sessionStorage.getItem('userName'));
  const [roomId, setRoomId] = useState(() => sessionStorage.getItem('roomId') || routeRoomId);
  const [participants, setParticipants] = useState([]);
  const [myId, setMyId] = useState('');
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
  
    // Save userName and roomId to sessionStorage
    sessionStorage.setItem('userName', userName);
    sessionStorage.setItem('roomId', roomId);
  
    // Initialize socket connection
    socketRef.current = io(SIGNALING_SERVER_URL);
  
    // Listen for the 'connect' event to get the socket ID
    socketRef.current.on('connect', () => {
      setMyId(socketRef.current.id);
    });
  
    // Join the room
    socketRef.current.emit('join-room', { roomId, userName });
  
    // Listen for existing peers and participants
    socketRef.current.on('existing-peers', ({ peers }) => {
      setParticipants(peers);
      peers.forEach((peer) => {
        if (!peersRef.current[peer.id] && peer.id !== socketRef.current.id) {
          initiatePeerConnection(peer.id, true);
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
        initiatePeerConnection(id, false);
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
  
    // Handle incoming exchangeSDP events
    socketRef.current.on('exchangeSDP', ({ sdp, sender }) => {
      if (peersRef.current[sender]) {
        peersRef.current[sender].signal(sdp);
      } else {
        initiatePeerConnection(sender, false);
      }
    });
  
      // Handle incoming candidate events (if using trickle ICE)
  socketRef.current.on('candidate', ({ candidate, sender }) => {
    if (peersRef.current[sender]) {
      peersRef.current[sender].signal(candidate);
    }
  });
  
    // Cleanup on component unmount
    return () => {
      socketRef.current.off('exchangeSDP');
      socketRef.current.off('candidate');
      socketRef.current.disconnect();
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
    };
  }, [userName, roomId, navigate]);
  

  const initiatePeerConnection = (peerId, initiator = true) => {
    const peerOptions = {
      initiator,
      trickle: true,
      stream: screenStreamRef.current || undefined,
    };
  
    const peer = new SimplePeer(peerOptions);
  
    peer.on('signal', (data) => {
      socketRef.current.emit('exchangeSDP', {
        target: peerId,
        sdp: data,
      });
    });
  
    peer.on('stream', (remoteStream) => {
      console.log(`Received remote stream from ${peerId}`);
      if (!remoteVideoRefs.current[peerId]) {
        const videoContainer = document.createElement('div');
    videoContainer.className = 'col-12 mb-3';

    const videoTitle = document.createElement('h5');
    videoTitle.innerText = `Screen from ${participants.find(p => p.id === peerId)?.userName || 'Participant'}`;

    const ratioWrapper = document.createElement('div');
    ratioWrapper.className = 'ratio ratio-16x9';

    const videoElement = document.createElement('video');
    videoElement.className = 'w-100 h-100';
    videoElement.autoplay = true;
    videoElement.controls = true;
    videoElement.srcObject = remoteStream;

    ratioWrapper.appendChild(videoElement);
    videoContainer.appendChild(videoTitle);
    videoContainer.appendChild(ratioWrapper);
    document.getElementById('remoteVideos').appendChild(videoContainer);

    remoteVideoRefs.current[peerId] = videoElement;
  }
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
    if (isSharing) {
      // Stop sharing
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        // Remove tracks from peers
        Object.values(peersRef.current).forEach((peer) => {
          peer.removeStream(screenStreamRef.current);
        });
        screenStreamRef.current = null;
      }
      setIsSharing(false);
  
      // Stop displaying local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    } else {
      // Start sharing
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
    }
  };
  

  return (
    <div className="container-fluid vh-100 d-flex flex-column">
    <div className="row flex-fill">
      <div className="col-12 col-md-2 border-end p-3 overflow-auto">
        <h3>Participants</h3>
        <ul className="list-unstyled">
          {participants.map((user) => (
            <li key={user.id}>
              {user.userName} {user.id === myId ? '(You)' : ''}
            </li>
          ))}
        </ul>
      </div>
      <div className="col-12 col-md-8 d-flex flex-column p-3">
        <h2>WebRTC Screen Sharing</h2>
        <button onClick={shareScreen} className="btn btn-primary mb-3">
          {isSharing ? 'Stop Sharing' : 'Share Screen'}
        </button>
        <div className="row flex-fill overflow-auto">
          <div className="col-12 col-lg-6 mb-3">
            <h4>Local Screen</h4>
            <div className="ratio ratio-16x9">
              <video ref={localVideoRef} className="w-100 h-100" muted />
            </div>
          </div>
          <div className="col-12 col-lg-6 mb-3">
            <h4>Remote Screens</h4>
            <div id="remoteVideos" className="d-flex flex-wrap"></div>
          </div>
        </div>
      </div>
      <div className="col-12 col-md-2 border-start p-3 overflow-auto">
        {/* Chat component goes here */}
      </div>
    </div>
  </div>
  );
}

export default Room;
