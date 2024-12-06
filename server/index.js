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

        // Initialize EchoHandle for this socket
        socket.echoHandle = null;

        // Handle disconnections
        socket.on('disconnect', async () => {
            console.log(`❌ User disconnected: ${socket.id}`);
            if (socket.echoHandle) {
                try {
                    await socket.echoHandle.detach();
                    console.log(`🧹 EchoHandle detached for socket: ${socket.id}`);
                } catch (err) {
                    console.error(`❌ Error detaching EchoHandle for socket ${socket.id}:`, err);
                }
            }
        });

        // Handle SDP Offer from client
        socket.on('sendOfferToJanus', async (data) => {
            const { jsep } = data;
            console.log(`📩 Received 'sendOfferToJanus' from socket ${socket.id}:`, jsep);

            try {
                // Attach EchoTest plugin handle for this socket
                const echoHandle = await session.attach(EchoTestPlugin);
                socket.echoHandle = echoHandle;
                console.log(`✅ EchoTest plugin attached for socket: ${socket.id}`);

                // Listen for ICE candidates from Janus and forward to client
                echoHandle.on('trickle', (candidate) => {
                    console.log(`🔄 Trickle ICE from Janus to socket ${socket.id}:`, candidate);
                    socket.emit('candidate', { candidate });
                });

                // Start the EchoTest session with the client's SDP offer
                const payload = {
                    jsep: jsep,
                    audio: true,
                    video: true,
                };
                console.log(`🚀 Starting EchoTest for socket ${socket.id}`);
                const startResponse = await echoHandle.start(payload);

                // Send the SDP answer back to the client
                socket.emit('janusAnswer', { jsep: startResponse.jsep });
                console.log(`🟢 Sent Janus SDP answer to socket ${socket.id}`);
            } catch (err) {
                console.error(`❌ Error handling 'sendOfferToJanus' for socket ${socket.id}:`, err);
                socket.emit('error', { message: 'Failed to start EchoTest' });
            }
        });

        // Handle ICE Candidates from client
        socket.on('candidate', async (data) => {
            const { candidate } = data;
            console.log(`📨 Received ICE candidate from socket ${socket.id}:`, candidate);

            if (socket.echoHandle) {
                try {
                    // Correctly structure the candidate object with top-level fields
                    await socket.echoHandle.trickle({
                        candidate: candidate.candidate,
                        sdpMid: candidate.sdpMid,
                        sdpMLineIndex: candidate.sdpMLineIndex,
                    });
                    console.log(`🔄 Sent ICE candidate to Janus for socket ${socket.id}`);
                } catch (err) {
                    console.error(`❌ Error sending ICE candidate to Janus for socket ${socket.id}:`, err);
                }
            } else {
                console.warn(`⚠️ No EchoHandle found for socket ${socket.id} when receiving candidate`);
            }
        });
    });

    // Start the server
    server.listen(PORT, () => {
        console.log(`🚀 Signaling server running on http://localhost:${PORT}`);
    });
})();
