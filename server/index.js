import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import http from 'http';
import Janode from 'janode';
import EchoTestPlugin from 'janode/plugins/echotest';


const app = express();
app.use(cors());

const port = process.env.PORT || 8080;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

(async () => {
    let connection, session, echoHandle;
    try {
        connection = await Janode.connect({
            is_admin: false,
            address: { url: 'ws://20.93.35.100:8188/' }
        });
        console.log('Successfully connected to Janus server');

        session = await connection.create();
        console.log(`Session created with ID: ${session.id}`);

        echoHandle = await session.attach(EchoTestPlugin);
        console.log('EchoTest plugin attached successfully');

    } catch (err) {
        console.error('Error initializing Janus connection:', err);
        process.exit(1); // Stop the server if Janus is unreachable
    }

    app.get('/', (req, res) => {
        res.send(`WebRTC Signaling Server is running on port ${port}`);
    });

    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
        });

        socket.on('join-room', async ({ roomId, userName }) => {
            // Join room logic
            socket.join(roomId);
            socket.userName = userName;
            socket.roomId = roomId;

        });

    
        socket.on('sendOfferToJanus', async (data) => {
            const payload = {
                jsep: data.jsep,
                audio: true,
                video: true
            };

            try {
                const startResponse = await echoHandle.start(payload);
                // startResponse.jsep contains the SDP answer from Janus
                console.log("Janus Answer SDP:", startResponse.jsep);
                socket.emit('janusAnswer', { jsep: startResponse.jsep });
            } catch (err) {
                console.error('Error starting EchoTest:', err);
            }
        });

        // Handle ICE candidates from the client and send them to Janus
        socket.on('candidate', (data) => {
            // data should have { candidate: {candidate: "...", sdpMid: "...", sdpMLineIndex: ...} }
            // Trickle to Janus
            echoHandle.trickle({
                candidate: data.candidate.candidate,
                sdpMid: data.candidate.sdpMid,
                sdpMLineIndex: data.candidate.sdpMLineIndex,
            });
        });
    });

    server.listen(port, () => {
        console.log(`Signaling server running on http://localhost:${port}`);
    });
})();
