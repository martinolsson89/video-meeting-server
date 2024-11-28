const WebSocket = require('ws');
const http = require('http');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket signaling server is running.\n');
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('A client connected.');

    ws.on('message', (message) => {
        console.log('Received:', message);

        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => {
        console.log('A client disconnected.');
    });
});

const PORT = 8080;
server.listen(PORT, () => {
    console.log(`WebSocket signaling server is running on ws://localhost:${PORT}`);
});
