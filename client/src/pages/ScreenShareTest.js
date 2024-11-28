import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';

const SIGNALING_SERVER_URL = 'http://localhost:8080'; // Ensure this matches your server's URL

const ScreenShareTest = () => {
  const [peers, setPeers] = useState({});
  const [existingPeers, setExistingPeers] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef({});
  const socketRef = useRef(null);
  const peersRef = useRef({});
  const screenStreamRef = useRef(null);

  useEffect(() => {
    // Connect to the signaling server using Socket.io
    socketRef.current = io(SIGNALING_SERVER_URL);

    // When connected, log the connection
    socketRef.current.on('connect', () => {
      console.log('Connected to signaling server with ID:', socketRef.current.id);
    });

    // Listen for 'existing-peers' event
    socketRef.current.on('existing-peers', (data) => {
      const { peers: existingPeersList } = data;
      console.log('Existing peers:', existingPeersList);
      setExistingPeers(existingPeersList);
    });

    // Listen for 'new-peer' events
    socketRef.current.on('new-peer', (data) => {
      const { id } = data;
      console.log('New peer joined:', id);
      if (isSharing) {
        initiatePeerConnection(id, true);
      } else {
        console.log('Screen not shared yet. Will connect when screen is shared.');
      }
    });

    // Listen for SDP exchange
    socketRef.current.on('exchangeSDP', (data) => {
      const { sdp, sender } = data;
      console.log('Received SDP from:', sender);
      if (!peersRef.current[sender]) {
        initiatePeerConnection(sender, false);
      }
      peersRef.current[sender].signal(sdp);
    });

    // Listen for ICE candidates
    socketRef.current.on('candidate', (data) => {
      const { candidate, sender } = data;
      console.log('Received ICE candidate from:', sender);
      if (peersRef.current[sender]) {
        peersRef.current[sender].signal(candidate);
      }
    });

    // Handle peer disconnection
    socketRef.current.on('disconnect-peer', (data) => {
      const { id } = data;
      console.log('Peer disconnected:', id);
      if (peersRef.current[id]) {
        peersRef.current[id].destroy();
        delete peersRef.current[id];
        setPeers((prevPeers) => {
          const updatedPeers = { ...prevPeers };
          delete updatedPeers[id];
          return updatedPeers;
        });
        if (remoteVideoRefs.current[id]) {
          remoteVideoRefs.current[id].srcObject = null;
          delete remoteVideoRefs.current[id];
        }
      }
    });

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
    };
  }, [isSharing]);

  // Function to initiate a peer connection
  const initiatePeerConnection = (peerId, initiator = true) => {
    console.log(`Initiating connection with peer ${peerId} as ${initiator ? 'initiator' : 'receiver'}`);
    
    const peer = new SimplePeer({
      initiator,
      trickle: false,
      stream: screenStreamRef.current,
    });

    // Handle signaling data
    peer.on('signal', (data) => {
      if (data.type === 'offer' || data.type === 'answer') {
        socketRef.current.emit('exchangeSDP', {
          target: peerId,
          sdp: data,
        });
      } else if (data.candidate) {
        socketRef.current.emit('candidate', {
          target: peerId,
          candidate: data,
        });
      }
    });

    // When a remote stream is received
    peer.on('stream', (remoteStream) => {
      console.log(`Received remote stream from peer ${peerId}`);
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

    // Handle connection close
    peer.on('close', () => {
      console.log(`Connection closed with peer ${peerId}`);
      peer.destroy();
      delete peersRef.current[peerId];
      setPeers((prevPeers) => {
        const updatedPeers = { ...prevPeers };
        delete updatedPeers[peerId];
        return updatedPeers;
      });
      if (remoteVideoRefs.current[peerId]) {
        remoteVideoRefs.current[peerId].srcObject = null;
        delete remoteVideoRefs.current[peerId];
      }
    });

    // Handle errors
    peer.on('error', (err) => {
      console.error(`Error with peer ${peerId}:`, err);
    });

    // Save the peer connection
    peersRef.current[peerId] = peer;
    setPeers((prevPeers) => ({
      ...prevPeers,
      [peerId]: peer,
    }));
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

      // Add the stream tracks to all existing peer connections
      Object.values(peersRef.current).forEach((peer) => {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream);
        });
      });

      console.log('Screen stream obtained and added to all existing peers.');

      // Initiate connections with existing peers
      existingPeers.forEach((peerId) => {
        if (!peersRef.current[peerId]) {
          initiatePeerConnection(peerId, true);
        }
      });

    } catch (err) {
      console.error('Error accessing display media:', err);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
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
        {/* Remote video elements will be appended here */}
      </div>
    </div>
  );
};

export default ScreenShareTest;
