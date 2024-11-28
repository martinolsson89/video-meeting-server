import React, { useRef, useEffect, useState } from 'react';
import SimplePeer from 'simple-peer';
import { v4 as uuidV4 } from 'uuid';

const SIGNALING_SERVER_URL = 'ws://localhost:8080';

const ScreenShareTest = () => {
  const [peers, setPeers] = useState({});
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const wsRef = useRef(null);
  const peerRef = useRef(null);
  const clientId = useRef(uuidV4());

  useEffect(() => {
    // Connect to the signaling server
    wsRef.current = new WebSocket(SIGNALING_SERVER_URL);

    wsRef.current.onopen = () => {
      console.log('Connected to signaling server');
      // Notify others about this new client
      wsRef.current.send(JSON.stringify({ type: 'new-peer', id: clientId.current }));
    };

    wsRef.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);
      const { type, from, payload } = data;

      if (type === 'new-peer' && from !== clientId.current) {
        // When a new peer joins, initiate a connection
        initiatePeerConnection(from, true);
      } else if (type === 'signal' && from !== clientId.current) {
        // Handle signaling data from other peers
        if (peerRef.current) {
          peerRef.current.signal(payload);
        }
      }
    };

    return () => {
      wsRef.current.close();
    };
  }, []);

  const initiatePeerConnection = async (peerId, initiator = false) => {
    // Get the screen stream
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play();
    }

    // Create a new peer
    const peer = new SimplePeer({
      initiator,
      trickle: false,
      stream,
    });

    // When the peer has signaling data, send it to the signaling server
    peer.on('signal', (data) => {
      wsRef.current.send(
        JSON.stringify({
          type: 'signal',
          from: clientId.current,
          to: peerId,
          payload: data,
        })
      );
    });

    // When a remote stream is received, set it to the remote video element
    peer.on('stream', (remoteStream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play();
      }
    });

    peer.on('error', (err) => {
      console.error('Peer error:', err);
    });

    peerRef.current = peer;

    // Save the peer
    setPeers((prevPeers) => ({
      ...prevPeers,
      [peerId]: peer,
    }));
  };

  const shareScreen = () => {
    // Use this function  to initiate screen sharing on demand
    // For simplicity, we initiate screen sharing on component mount
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>WebRTC Screen Sharing Test</h2>
      <div>
        <h3>Local Screen</h3>
        <video ref={localVideoRef} style={{ width: '45%', marginRight: '10%' }} muted />
        <h3>Remote Screen</h3>
        <video ref={remoteVideoRef} style={{ width: '45%' }} />
      </div>
    </div>
  );
};

export default ScreenShareTest;
