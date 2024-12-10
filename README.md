# Video Meeting Server

This repository contains a **React client application** and a **Node.js signaling server** for real-time communication. Below are the installation instructions.

## Prerequisites

Ensure you have the following installed:

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/martinolsson89/video-meeting-server.git
cd <repository-directory>
```

### 2. Set Up the Server
Navigate to the `server` folder and install dependencies:
```bash
cd server
npm install express cors socket.io ws janode
```

Start the server:
```bash
node index.js
```

### 3. Set Up the Client
Navigate to the `client` folder and install dependencies:
```bash
cd client
npm install react-router-dom react-bootstrap bootstrap simple-peer uuid socket.io-client process
```

Start the client application:
```bash
npm start
```
