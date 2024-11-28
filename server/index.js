const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
app.use(cors());

const port = process.env.PORT || 8080;
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*', // Allow all origins
        methods: ['GET', 'POST'],
    },
});

app.get('/', (req, res) => {
    res.send(`WebRTC Signaling Server is running on port ${port}`);
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Listen for SDP exchange (offers/answers)
    socket.on('exchangeSDP', (data) => {
        console.log('SDP exchange:', data);
        socket.to(data.target).emit('exchangeSDP', {
            sdp: data.sdp,
            sender: socket.id,
        });
    });

    // Listen for ICE candidates
    socket.on('candidate', (data) => {
        console.log('ICE candidate:', data);
        socket.to(data.target).emit('candidate', {
            candidate: data.candidate,
            sender: socket.id,
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(port, () => {
    console.log(`Signaling server running on http://localhost:${port}`);
});