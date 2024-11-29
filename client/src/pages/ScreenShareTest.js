import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import process from 'process';

// Assign the polyfill to the global window object
window.process = process;

const SIGNALING_SERVER_URL = 'http://localhost:8080'; // Ensure this matches your server's URL

const ScreenShareTest = () => {
  const [peers, setPeers] = useState({});
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
      socketRef.current.emit('join', {});
    });

    // Listen for 'existing-peers' event
    socketRef.current.on('existing-peers', (data) => {
      const { peers: existingPeersList } = data;
      console.log('Existing peers:', existingPeersList);

      existingPeersList.forEach((peerId) => {
        if (!peersRef.current[peerId]) {
          initiatePeerConnection(peerId, true); // New peer initiates the connection
        }
      });
    });

    // Listen for 'new-peer' events
    socketRef.current.on('new-peer', (data) => {
      const { id } = data;
      console.log('New peer joined:', id);
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
  }, []);

  // Function to initiate a peer connection
  const initiatePeerConnection = (peerId, initiator = true) => {
    console.log(`Initiating connection with peer ${peerId} as ${initiator ? 'initiator' : 'receiver'}`);
    
    const peerOptions = {
      initiator,
      trickle: false,
    };
    if (isSharing && screenStreamRef.current) {
      peerOptions.stream = screenStreamRef.current;
    }
    const peer = new SimplePeer(peerOptions);

    // Handle signaling data
    peer.on('signal', (data) => {
      if (data.type === 'offer' || data.type === 'answer') {
        socketRef.current.emit('exchangeSDP', {
          target: peerId,
          sdp: data,
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

      Object.values(peersRef.current).forEach((peer) => {
        stream.getTracks().forEach((track) => {
          peer.addTrack(track, stream);
        });
      });

      console.log('Screen stream obtained and added to all existing peers.');
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