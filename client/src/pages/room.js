import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const SIGNALING_SERVER_URL = "http://localhost:8080";
const socket = io(SIGNALING_SERVER_URL);

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [userName] = useState(sessionStorage.getItem('userName'));
  const localVideoRef = useRef(null);
  const pc = useRef(null);

  useEffect(() => {
    if (!userName) {
      navigate('/');
      return;
    }

    // Save userName and roomId to sessionStorage if needed
    sessionStorage.setItem('userName', userName);
    sessionStorage.setItem('roomId', roomId);

    // Initialize RTCPeerConnection
    pc.current = new RTCPeerConnection({
      iceServers: [
        {
          urls: 'turn:20.93.35.100:3478',
          username: 'testuser',
          credential: 'testpassword'
        }
      ]
    });

    // When we receive ICE candidates from the server, add them to the PC
    socket.on('candidate', ({ candidate }) => {
      if (candidate) {
        pc.current.addIceCandidate(candidate);
      }
    });

    // When we receive the Janus answer, set it as the remote description
    socket.on('janusAnswer', async ({ jsep }) => {
      await pc.current.setRemoteDescription(jsep);
      console.log('Remote description set from Janus');
    });

    // Local ICE candidates need to be sent to the server (which then sends to Janus)
    pc.current.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit('candidate', { candidate });
      }
    };

    // When remote track arrives (the echo from Janus), display it
    pc.current.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = remoteStream;
      }
    };

    // Start the call to Janus after we get user media
    startCall();

    // Cleanup on unmount
    return () => {
      socket.off('candidate');
      socket.off('janusAnswer');
      pc.current && pc.current.close();
      socket.disconnect();
    };
  }, [userName, roomId, navigate]);

  async function startCall() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      // Add local tracks to the PC so Janus can echo them back
      stream.getTracks().forEach(track => pc.current.addTrack(track, stream));

      // Show local stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);

      // Send the offer to the server to pass to Janus
      socket.emit('sendOfferToJanus', { jsep: offer });
    } catch (err) {
      console.error('Error starting call:', err);
    }
  }

  return (
    <div className="container-fluid vh-100 d-flex flex-column">
      <div className="row flex-fill">
        <div className="col-12 p-3 overflow-auto">
          <h2>Janus Echo Test</h2>
          <p>Your local video below will be sent to Janus and echoed back (delayed):</p>
          <div className="ratio ratio-16x9">
            <video ref={localVideoRef} className="w-100 h-100" playsInline autoPlay muted />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room;
