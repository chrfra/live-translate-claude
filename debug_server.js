require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Add CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Create simplified WebSocket server for debugging
const wss = new WebSocket.Server({ server });

console.log('🔧 Debug server starting...');
console.log('🔑 API key status:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');

wss.on('connection', (ws, request) => {
    console.log('✅ Client connected from:', request.socket.remoteAddress);
    
    // Send immediate confirmation
    ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connected successfully'
    }));
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Received:', data);
            
            // Immediate response
            if (data.type === 'start') {
                if (process.env.OPENAI_API_KEY) {
                    ws.send(JSON.stringify({
                        type: 'status',
                        message: 'API key is configured and ready!'
                    }));
                } else {
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'OpenAI API key not configured. Please add OPENAI_API_KEY to environment variables.'
                    }));
                }
            }
        } catch (error) {
            console.error('❌ Message parsing error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('👋 Client disconnected');
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        apiKey: process.env.OPENAI_API_KEY ? 'configured' : 'missing'
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Debug server running on port ${PORT}`);
    console.log(`🌐 Health: http://localhost:${PORT}/health`);
});