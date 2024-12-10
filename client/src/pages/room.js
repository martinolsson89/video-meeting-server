import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

function Room() {
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef({}); // Store multiple remote videos
  const pc = useRef({}); // Store peer connections for each user
  const socketRef = useRef(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [roomId, setRoomId] = useState("1234"); // Default room

  const startRoom = async () => {
    if (isConnecting || isConnected) {
        console.warn('🔔 Already in a room.');
        return;
    }

    setIsConnecting(true);
    setError(null);

    try {
        socketRef.current = io("http://localhost:8080");

        socketRef.current.on('connect', () => {
            console.log('🔗 Socket connected:', socketRef.current.id);
            joinRoom();
        });

        socketRef.current.on('userJoined', async ({ userId }) => {
            console.log(`🟢 User joined: ${userId}`);
            await createPeerConnection(userId);
        });

        socketRef.current.on('offer', async ({ userId, jsep }) => {
            console.log(`📩 Received offer from ${userId}:`, jsep);
            await handleOffer(userId, jsep);
        });

        socketRef.current.on('answer', async ({ userId, jsep }) => {
            console.log(`📩 Received answer from ${userId}:`, jsep);
            await pc.current[userId].setRemoteDescription(new RTCSessionDescription(jsep));
        });

        socketRef.current.on('candidate', ({ userId, candidate }) => {
            console.log(`📨 Received ICE candidate from ${userId}:`, candidate);
            if (pc.current[userId]) {
                pc.current[userId].addIceCandidate(new RTCIceCandidate(candidate));
            }
        });

        socketRef.current.on('userLeft', ({ userId }) => {
            console.log(`❌ User left: ${userId}`);
            if (pc.current[userId]) {
                pc.current[userId].close();
                delete pc.current[userId];
            }
            delete remoteVideosRef.current[userId];
            setIsConnected(Object.keys(pc.current).length > 0);
        });

        socketRef.current.on('error', (err) => {
            console.error('🔴 Socket error:', err);
            setError('Socket error.');
            setIsConnecting(false);
        });
    } catch (err) {
        console.error('❌ Error starting room:', err);
        setError('Failed to start room.');
        setIsConnecting(false);
    }
};


  const joinRoom = async () => {
    try {
      const stream = await getLocalStream();
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      socketRef.current.emit('joinRoom', { roomId });
      console.log('🚪 Joined room:', roomId);
      setIsConnected(true);
      setIsConnecting(false);
    } catch (err) {
      console.error('❌ Error joining room:', err);
      setError('Failed to join room.');
      setIsConnecting(false);
    }
  };

  const getLocalStream = async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (err) {
      console.warn('⚠️ Camera not found. Falling back to audio-only.', err);
      return new MediaStream(); // Return empty stream
    }
  };

  const createPeerConnection = async (userId) => {
    pc.current[userId] = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'turn:20.93.35.100:3478',
          username: 'testuser',
          credential: 'testpassword',
        },
      ],
    });

    const stream = localVideoRef.current.srcObject || new MediaStream();
    stream.getTracks().forEach((track) => {
      pc.current[userId].addTrack(track, stream);
    });

    pc.current[userId].onicecandidate = ({ candidate }) => {
      if (candidate) {
        socketRef.current.emit('candidate', { userId, candidate });
      }
    };

    pc.current[userId].ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteVideosRef.current[userId]) {
        const video = document.createElement('video');
        video.srcObject = remoteStream;
        video.autoplay = true;
        video.playsInline = true;
        video.style.width = '400px';
        video.style.height = '300px';
        video.controls = true;
        document.body.appendChild(video);
        remoteVideosRef.current[userId] = video;
      }
    };

    const offer = await pc.current[userId].createOffer();
    await pc.current[userId].setLocalDescription(offer);
    socketRef.current.emit('offer', { userId, jsep: offer });
  };

  const handleOffer = async (userId, jsep) => {
    if (!pc.current[userId]) {
      await createPeerConnection(userId);
    }
    await pc.current[userId].setRemoteDescription(new RTCSessionDescription(jsep));
    const answer = await pc.current[userId].createAnswer();
    await pc.current[userId].setLocalDescription(answer);
    socketRef.current.emit('answer', { userId, jsep: answer });
  };

  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up');
      Object.values(pc.current).forEach((connection) => connection.close());
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      <div className="row flex-fill">
        <div className="col-12 p-3 overflow-auto">
          <h2 className="mb-4">Video Chat Room</h2>
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ gap: '20px', marginBottom: '20px' }}
          >
            <div>
              <h5>Your Video</h5>
              <video
                ref={localVideoRef}
                className="border"
                style={{ width: '400px', height: '300px' }}
                playsInline
                autoPlay
                muted
              />
            </div>
          </div>
          <div className="text-center">
            <button
              onClick={startRoom}
              className="btn btn-primary btn-lg"
              disabled={isConnecting || isConnected}
            >
              {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Join Room'}
            </button>
          </div>
          {error && (
            <div className="alert alert-danger mt-3" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Room;