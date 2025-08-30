require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const OpenAI = require('openai');

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

// Create WebSocket server with better error handling
const wss = new WebSocket.Server({ 
    server,
    path: '/',
    verifyClient: (info) => {
        console.log('WebSocket connection attempt from:', info.origin);
        return true;
    }
});

// Check for OpenAI API key
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is not set!');
    console.log('📝 Please set your OpenAI API key in the environment variables.');
    console.log('🔧 For Hugging Face Spaces: Add OPENAI_API_KEY as a secret in Space settings');
    console.log('🔧 For local development: Add OPENAI_API_KEY=your_key_here to your .env file');
    
    // Don't exit, let the server start but show error to users
}

// Initialize OpenAI client (will be null if no API key)
let openai = null;
if (apiKey) {
    openai = new OpenAI({
        apiKey: apiKey
    });
    console.log('✅ OpenAI client initialized successfully');
} else {
    console.log('⚠️ OpenAI client not initialized - API key missing');
}

const languageMap = {
    'sv': 'Swedish',
    'en': 'English', 
    'zh': 'Chinese'
};

class RealtimeTranslator {
    constructor(ws) {
        this.ws = ws;
        this.openaiWs = null;
        this.isConnected = false;
        this.audioBuffer = [];
        this.currentTranscript = '';
        this.inputLanguage = 'sv';
        this.outputLanguage = 'sv';
        this.lastSpeechTime = Date.now();
        this.silenceThreshold = 2000; // 2 seconds of silence before new speaker
    }

    async connect() {
        try {
            if (!apiKey) {
                console.log('❌ Cannot connect to OpenAI - API key not set');
                this.sendToClient({ 
                    type: 'error', 
                    message: 'OpenAI API key not configured. Please add OPENAI_API_KEY to the environment variables.' 
                });
                return;
            }
            
            console.log('Attempting to connect to OpenAI Realtime API...');
            console.log('Using API key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT SET');
            
            // Connect to OpenAI Realtime API
            this.openaiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });

            this.openaiWs.on('open', () => {
                console.log('✅ Connected to OpenAI Realtime API');
                this.isConnected = true;
                
                // Configure the session
                this.sendToOpenAI({
                    type: 'session.update',
                    session: {
                        modalities: ['text', 'audio'],
                        instructions: `You are a real-time transcription and translation assistant. 
                        Transcribe speech accurately and translate it to the target language. 
                        Detect speaker changes and indicate when a new person starts speaking.`,
                        voice: 'alloy',
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: {
                            model: 'whisper-1'
                        }
                    }
                });
                console.log('Session configuration sent to OpenAI');
            });

            this.openaiWs.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleOpenAIMessage(message);
                } catch (error) {
                    console.error('Error parsing OpenAI message:', error);
                }
            });

            this.openaiWs.on('close', (code, reason) => {
                console.log(`❌ OpenAI connection closed. Code: ${code}, Reason: ${reason}`);
                this.isConnected = false;
            });

            this.openaiWs.on('error', (error) => {
                console.error('❌ OpenAI connection error:', error);
                this.sendToClient({ type: 'error', message: 'OpenAI connection error: ' + error.message });
            });

        } catch (error) {
            console.error('Failed to connect to OpenAI:', error);
            this.sendToClient({ type: 'error', message: 'Failed to connect to OpenAI' });
        }
    }

    handleOpenAIMessage(message) {
        switch (message.type) {
            case 'input_audio_buffer.speech_started':
                console.log('Speech started');
                this.lastSpeechTime = Date.now();
                break;

            case 'input_audio_buffer.speech_stopped':
                console.log('Speech stopped');
                this.processSpeechEnd();
                break;

            case 'conversation.item.input_audio_transcription.completed':
                const transcript = message.transcript;
                console.log('Transcript:', transcript);
                this.handleTranscription(transcript);
                break;

            case 'response.audio_transcript.delta':
                // Handle real-time transcription updates
                if (message.delta) {
                    this.sendToClient({
                        type: 'transcript',
                        text: message.delta,
                        isFinal: false
                    });
                }
                break;

            case 'response.audio_transcript.done':
                // Final transcription
                if (message.transcript) {
                    this.sendToClient({
                        type: 'transcript',
                        text: message.transcript,
                        isFinal: true
                    });
                    this.translateText(message.transcript);
                }
                break;

            case 'error':
                console.error('OpenAI error:', message);
                this.sendToClient({ type: 'error', message: message.error?.message || 'Unknown error' });
                break;
        }
    }

    async handleTranscription(transcript) {
        if (!transcript || transcript.trim().length === 0) return;

        // Check for speaker change based on silence
        const timeSinceLastSpeech = Date.now() - this.lastSpeechTime;
        if (timeSinceLastSpeech > this.silenceThreshold && this.currentTranscript.length > 0) {
            this.sendToClient({ type: 'speaker_change' });
        }

        this.currentTranscript = transcript;
        this.sendToClient({
            type: 'transcript',
            text: transcript,
            isFinal: true
        });

        // Translate the transcript
        await this.translateText(transcript);
    }

    async translateText(text) {
        if (!text || this.inputLanguage === this.outputLanguage) {
            this.sendToClient({
                type: 'translation',
                text: text
            });
            return;
        }

        if (!openai) {
            this.sendToClient({
                type: 'error',
                message: 'Translation unavailable - OpenAI API key not configured'
            });
            return;
        }

        try {
            // Get full sentence translation
            const translationResponse = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are a professional translator. Translate the following text from ${languageMap[this.inputLanguage]} to ${languageMap[this.outputLanguage]}. Only return the translation, no explanations.`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
            });

            const translation = translationResponse.choices[0].message.content.trim();
            
            this.sendToClient({
                type: 'translation',
                text: translation
            });

            // Get word-by-word translation
            await this.getWordByWordTranslation(text);

        } catch (error) {
            console.error('Translation error:', error);
            this.sendToClient({
                type: 'error',
                message: 'Translation failed'
            });
        }
    }

    async getWordByWordTranslation(text) {
        if (!openai) {
            console.log('⚠️ Skipping word-by-word translation - OpenAI not available');
            return;
        }
        
        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Provide word-by-word translation from ${languageMap[this.inputLanguage]} to ${languageMap[this.outputLanguage]}. 
                        Return a JSON array of objects with "original" and "translated" properties for each significant word.
                        Skip articles, prepositions, and other non-essential words. Focus on nouns, verbs, adjectives, and adverbs.
                        Example: [{"original": "hund", "translated": "dog"}, {"original": "springer", "translated": "runs"}]`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                max_tokens: 500,
                temperature: 0.3
            });

            const wordTranslations = JSON.parse(response.choices[0].message.content.trim());
            
            this.sendToClient({
                type: 'word_translation',
                words: wordTranslations
            });

        } catch (error) {
            console.error('Word-by-word translation error:', error);
            // Don't send error to client for word-by-word since it's less critical
        }
    }

    processSpeechEnd() {
        // Request transcription
        if (this.isConnected) {
            this.sendToOpenAI({
                type: 'input_audio_buffer.commit'
            });
        }
    }

    handleAudioData(audioData, inputLanguage, outputLanguage) {
        this.inputLanguage = inputLanguage;
        this.outputLanguage = outputLanguage;

        if (this.isConnected && this.openaiWs.readyState === WebSocket.OPEN) {
            // Convert audio data to base64 and send to OpenAI
            const buffer = Buffer.from(new Int16Array(audioData).buffer);
            const base64Audio = buffer.toString('base64');
            
            // Only log every 500th audio chunk to avoid spam
            if (!this.audioChunkCounter) this.audioChunkCounter = 0;
            this.audioChunkCounter++;
            
            if (this.audioChunkCounter % 500 === 0) {
                console.log(`📡 Sending audio chunk ${this.audioChunkCounter} to OpenAI (${buffer.length} bytes)`);
            }
            
            this.sendToOpenAI({
                type: 'input_audio_buffer.append',
                audio: base64Audio
            });
        } else {
            if (this.audioChunkCounter % 100 === 0) {
                console.log(`❌ Cannot send audio - OpenAI not connected. Connected: ${this.isConnected}, ReadyState: ${this.openaiWs?.readyState}`);
            }
        }
    }

    sendToOpenAI(message) {
        if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
            this.openaiWs.send(JSON.stringify(message));
        }
    }

    sendToClient(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    disconnect() {
        if (this.openaiWs) {
            this.openaiWs.close();
        }
    }
}

wss.on('connection', (ws, request) => {
    console.log('✅ Client connected from:', request.socket.remoteAddress);
    const translator = new RealtimeTranslator(ws);
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log('📨 Received message type:', data.type);
            
            switch (data.type) {
                case 'start':
                    console.log('🚀 Starting translation session...');
                    await translator.connect();
                    break;
                    
                case 'audio':
                    translator.handleAudioData(data.data, data.inputLanguage, data.outputLanguage);
                    break;
                    
                case 'stop':
                    console.log('⏹️ Stopping translation session...');
                    translator.disconnect();
                    break;
                    
                default:
                    console.log('❓ Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('❌ Error handling message:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Server error: ' + error.message }));
        }
    });
    
    ws.on('close', (code, reason) => {
        console.log(`👋 Client disconnected. Code: ${code}, Reason: ${reason}`);
        translator.disconnect();
    });
    
    ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    
    if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  OPENAI_API_KEY environment variable not set!');
        console.log('Please set your OpenAI API key:');
        console.log('export OPENAI_API_KEY=your_api_key_here');
    }
});