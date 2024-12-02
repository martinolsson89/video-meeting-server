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
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

app.get('/', (req, res) => {
    res.send(`WebRTC Signaling Server is running on port ${port}`);
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);

        // Notify others in the room that the user has left
        socket.to(roomId).emit('user-disconnected', {
            id: socket.id,
            userName: userName,
        });
    });

    // Listen for 'join-room' event to handle room joining
    socket.on('join-room', ({ roomId, userName }) => {
        console.log(`User ${userName} is joining room ${roomId}`);

        // Store the user's name and room ID in the socket object
        socket.userName = userName;
        socket.roomId = roomId;

        // Join the specified room
        socket.join(roomId);

        // Notify existing users in the room about the new user
        socket.to(roomId).emit('user-connected', {
            id: socket.id,
            userName: userName,
        });

        // Send the list of existing peers in the room to the new user
        const connectedPeers = [];
        const clients = io.sockets.adapter.rooms.get(roomId);

        if (clients) {
            clients.forEach((clientId) => {
                if (clientId !== socket.id) {
                    const clientSocket = io.sockets.sockets.get(clientId);
                    if (clientSocket) {
                        connectedPeers.push({
                            id: clientSocket.id,
                            userName: clientSocket.userName,
                        });
                    }
                }
            });
        }

        socket.emit('existing-peers', { peers: connectedPeers });

        // Handle SDP exchange (offer/answer)
        socket.on('exchangeSDP', (data) => {
            console.log('SDP exchange from', socket.id, 'to', data.target);
            io.to(data.target).emit('exchangeSDP', {
                sdp: data.sdp,
                sender: socket.id,
            });
        });

        // Handle ICE candidates
        socket.on('candidate', (data) => {
            console.log('ICE candidate from', socket.id, 'to', data.target);
            io.to(data.target).emit('candidate', {
                candidate: data.candidate,
                sender: socket.id,
            });
        });

        // Handle chat messages
        // socket.on('chat-message', (message) => {
        //     // Broadcast the message to other users in the room
        //     socket.to(roomId).emit('chat-message', {
        //         message: message,
        //         userName: userName,
        //     });
        // });

    });
});

server.listen(port, () => {
    console.log(`Signaling server running on http://localhost:${port}`);
});
