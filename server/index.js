// index.js (Server)
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import Janode from 'janode';
import VideoRoomPlugin from 'janode/plugins/videoroom';

const app = express();
app.use(cors());

const PORT = process.env.PORT || 8080;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*', // Adjust this in production for security
        methods: ['GET', 'POST'],
    },
});

// Initialize Janus connection
let connection, session;

(async () => {
    try {
        connection = await Janode.connect({
            is_admin: false,
            address: { url: 'ws://20.93.35.100:8091/janus' },
        });
        console.log('✅ Successfully connected to Janus server');

        session = await connection.create();
        console.log(`🟢 Session created with ID: ${session.id}`);
    } catch (error) {
        console.error('❌ Error initializing Janus connection:', error);
        process.exit(1); // Exit if Janus is unreachable
    }

    // Basic endpoint to confirm server is running
    app.get('/', (req, res) => {
        res.send(`WebRTC Signaling Server is running on port ${PORT}`);
    });

    // Handle client connections via Socket.io
    io.on('connection', (socket) => {
        console.log(`🔗 A user connected: ${socket.id}`);
    
        socket.on('joinRoom', async ({ roomId, displayName }) => {
            try {
                console.log(`🚪 User ${socket.id} is joining room ${roomId}`);
        
                if (!socket.videoHandle) {
                    socket.videoHandle = await session.attach(VideoRoomPlugin);
                    console.log(`✅ VideoRoom plugin attached for socket: ${socket.id}`);
                }
        
                const numericRoomId = parseInt(roomId, 10);
                if (isNaN(numericRoomId) || numericRoomId <= 0) {
                    throw new Error('Room ID must be a positive integer');
                }

                const roomInfo = await socket.videoHandle.list();
                const roomExists = roomInfo.list.some((room) => room.room === numericRoomId);
        
                if (!roomExists) {
                    console.log(`🔨 Creating room ${roomId} (numeric ID: ${numericRoomId})`);
                    await socket.videoHandle.create({ room: numericRoomId, publishers: 10 });
                    console.log(`✅ Room ${roomId} created`);
                }
        
                const joinResponse = await socket.videoHandle.joinPublisher({
                    room: numericRoomId,
                    display: displayName || `User-${socket.id}`,
                });
        
                console.log(`📥 User ${socket.id} joined room ${roomId} (numeric ID: ${numericRoomId})`);
                socket.emit('joinedRoom', { roomId: numericRoomId, jsep: joinResponse.jsep });

                // Logically join the room via Socket.io
                socket.join(roomId);
        
                // Fetch participants
                const participantsData = await socket.videoHandle.listParticipants({ room: numericRoomId });
                const participantNames = participantsData.participants.map((p) => p.display);
                console.log(`👥 Participants in room ${roomId}:`, participantNames);

                // Emit updated participant list to all in the room
                io.in(roomId).emit('participantsUpdate', participantNames);
            } catch (err) {
                console.error(`❌ Error handling 'joinRoom' for ${socket.id}:`, err);
                socket.emit('error', { message: 'Failed to join room', details: err.message });
            }
        });
    
        socket.on('offer', async ({ jsep, roomId }) => {
            try {
                console.log(`📩 Received 'offer' from ${socket.id} for room ${roomId}`);
    
                if (socket.videoHandle) {
                    const configureResponse = await socket.videoHandle.configure({
                        jsep,
                        audio: true,
                        video: true,
                    });
    
                    console.log(`🚀 Configured plugin for socket ${socket.id}`);
                    socket.emit('answer', { jsep: configureResponse.jsep });
                }
            } catch (err) {
                console.error(`❌ Error handling 'offer' for socket ${socket.id}:`, err);
                socket.emit('error', { message: 'Failed to handle offer', details: err.message });
            }
        });
    
        socket.on('candidate', ({ candidate }) => {
            try {
                console.log(`📨 Received ICE candidate from ${socket.id}:`, candidate);
    
                if (socket.videoHandle) {
                    socket.videoHandle.trickle({
                        candidate: candidate.candidate,
                        sdpMid: candidate.sdpMid,
                        sdpMLineIndex: candidate.sdpMLineIndex,
                    });
                    console.log(`🔄 Sent ICE candidate to Janus for socket ${socket.id}`);
                }
            } catch (err) {
                console.error(`❌ Error handling 'candidate' for ${socket.id}:`, err);
            }
        });
    
        socket.on('disconnect', async () => {
            try {
                console.log(`❌ User disconnected: ${socket.id}`);
                if (socket.videoHandle) {
                    await socket.videoHandle.detach();
                    console.log(`🧹 VideoHandle detached for socket: ${socket.id}`);
                }
            } catch (err) {
                console.error(`❌ Error during 'disconnect' for ${socket.id}:`, err);
            }
        });
    });

    // Start the server
    server.listen(PORT, () => {
        console.log(`🚀 Signaling server running on http://localhost:${PORT}`);
    });
})();
