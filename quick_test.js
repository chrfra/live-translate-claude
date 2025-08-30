const WebSocket = require('ws');

const ws = new WebSocket('wss://chrfra-cursor-claude-translate.hf.space/');

ws.on('open', () => {
    console.log('Connected');
    ws.send('{"type":"start"}');
    setTimeout(() => process.exit(0), 2000);
});

ws.on('message', (data) => {
    console.log('Response:', data.toString());
});

ws.on('error', (err) => {
    console.log('Error:', err.message);
});

setTimeout(() => process.exit(1), 5000);