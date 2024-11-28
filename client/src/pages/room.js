import React, { useState, useEffect, useRef } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';

export default function Room() {
  const [videos, setVideos] = useState([]); // State to track video streams
  const localStreamRef = useRef(null); // Ref for local video stream

  // Initialize media stream
  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      localStreamRef.current = stream;
    };
    init();
  }, []);

  const handleJoin = () => {
    if (localStreamRef.current) {
      setVideos((prevVideos) => [
        ...prevVideos,
        {
          id: `video-${prevVideos.length + 1}`,
          stream: localStreamRef.current,
        },
      ]);
    }
  };

  return (
    <div>
      <Row>
        <Button onClick={handleJoin} className="mb-3">
          Join
        </Button>
      </Row>
      <Row>
        {videos.map((video) => (
          <Col key={video.id} xs={12} md={6} lg={4}>
            <VideoPlayer stream={video.stream} />
          </Col>
        ))}
      </Row>
    </div>
  );
}

// Component to handle video rendering
function VideoPlayer({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream; // Set the MediaStream to the video element
    }
  }, [stream]);

  return <video ref={videoRef} autoPlay muted className="w-100" />;
}
