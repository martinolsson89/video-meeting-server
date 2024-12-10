// index.js (Server)
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import Janode from 'janode';
import EchoTestPlugin from 'janode/plugins/echotest';

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
    
        socket.on('joinRoom', async ({ roomId }) => {
            try {
                console.log(`🚪 User ${socket.id} joined room ${roomId}`);
                socket.join(roomId);
                socket.to(roomId).emit('userJoined', { userId: socket.id });
    
                // Log room details
                const roomSockets = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
                console.log(`📋 Users in room ${roomId}:`, roomSockets);
            } catch (err) {
                console.error(`❌ Error handling 'joinRoom' for ${socket.id}:`, err);
            }
        });
    
        socket.on('offer', async ({ userId, jsep }) => {
            try {
                console.log(`📩 Received 'offer' from ${socket.id} for user ${userId}:`, jsep);
    
                // Attach EchoTest plugin handle for the user
                if (!socket.echoHandle) {
                    socket.echoHandle = await session.attach(EchoTestPlugin);
                    console.log(`✅ EchoTest plugin attached for socket: ${socket.id}`);
                }
    
                // Start the session with the received offer
                const payload = { jsep, audio: true, video: true };
                console.log(`🚀 Starting EchoTest for socket ${socket.id}`);
                const startResponse = await socket.echoHandle.start(payload);
    
                // Send the SDP answer back to the client
                socket.to(userId).emit('answer', { userId: socket.id, jsep: startResponse.jsep });
                console.log(`🟢 Sent SDP answer to user ${userId}`);
            } catch (err) {
                console.error(`❌ Error handling 'offer' for socket ${socket.id}:`, err);
            }
        });
    
        socket.on('answer', ({ userId, jsep }) => {
            try {
                console.log(`📩 Received 'answer' from ${socket.id} for user ${userId}:`, jsep);
                socket.to(userId).emit('answer', { userId: socket.id, jsep });
            } catch (err) {
                console.error(`❌ Error handling 'answer' for ${socket.id}:`, err);
            }
        });
    
        socket.on('candidate', ({ userId, candidate }) => {
            try {
                console.log(`📨 Received ICE candidate from ${socket.id} for user ${userId}:`, candidate);
    
                if (socket.echoHandle) {
                    // Send candidate to Janus
                    socket.echoHandle.trickle({
                        candidate: candidate.candidate,
                        sdpMid: candidate.sdpMid,
                        sdpMLineIndex: candidate.sdpMLineIndex,
                    });
                    console.log(`🔄 Sent ICE candidate to Janus for socket ${socket.id}`);
                }
    
                // Forward candidate to the intended user
                socket.to(userId).emit('candidate', { userId: socket.id, candidate });
            } catch (err) {
                console.error(`❌ Error handling 'candidate' for ${socket.id}:`, err);
            }
        });
    
        socket.on('disconnect', async () => {
            try {
                console.log(`❌ User disconnected: ${socket.id}`);
                if (socket.echoHandle) {
                    await socket.echoHandle.detach();
                    console.log(`🧹 EchoHandle detached for socket: ${socket.id}`);
                }
                socket.broadcast.emit('userLeft', { userId: socket.id });
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