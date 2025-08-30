class LiveTranslateApp {
    constructor() {
        this.ws = null;
        this.mediaRecorder = null;
        this.audioContext = null;
        this.isRecording = false;
        this.currentTranscript = '';
        this.currentTranslation = '';
        this.speakers = new Map();
        this.currentSpeaker = 1;
        
        this.initializeElements();
        this.attachEventListeners();
        this.updateLanguageLabels();
    }
    
    initializeElements() {
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.inputLanguage = document.getElementById('inputLanguage');
        this.outputLanguage = document.getElementById('outputLanguage');
        this.originalText = document.getElementById('originalText');
        this.translatedText = document.getElementById('translatedText');
        this.wordByWordText = document.getElementById('wordByWordText');
        this.status = document.getElementById('status');
        this.originalTitle = document.getElementById('originalTitle');
        this.translatedTitle = document.getElementById('translatedTitle');
    }
    
    attachEventListeners() {
        this.startButton.addEventListener('click', () => this.startListening());
        this.stopButton.addEventListener('click', () => this.stopListening());
        this.inputLanguage.addEventListener('change', () => this.updateLanguageLabels());
        this.outputLanguage.addEventListener('change', () => this.updateLanguageLabels());
    }
    
    updateLanguageLabels() {
        const languageNames = {
            'sv': 'Swedish',
            'en': 'English',
            'zh': 'Chinese'
        };
        
        const inputLang = languageNames[this.inputLanguage.value];
        const outputLang = languageNames[this.outputLanguage.value];
        
        this.originalTitle.textContent = `Original Text (${inputLang})`;
        this.translatedTitle.textContent = `Translated Text (${outputLang})`;
    }
    
    showStatus(message, type = 'connecting') {
        this.status.textContent = message;
        this.status.className = `status ${type}`;
        this.status.style.display = 'block';
    }
    
    hideStatus() {
        this.status.style.display = 'none';
    }
    
    async startListening() {
        try {
            this.showStatus('Requesting microphone access...', 'connecting');
            
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                } 
            });
            
            this.showStatus('Connecting to OpenAI Realtime API...', 'connecting');
            
            // Connect to our WebSocket server
            this.ws = new WebSocket('ws://localhost:3000');
            
            this.ws.onopen = () => {
                this.showStatus('Connected! Start speaking...', 'connected');
                this.setupAudioRecording(stream);
                this.startButton.style.display = 'none';
                this.stopButton.style.display = 'inline-block';
                this.isRecording = true;
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleRealtimeMessage(data);
            };
            
            this.ws.onclose = () => {
                this.showStatus('Connection closed', 'error');
                this.stopListening();
            };
            
            this.ws.onerror = (error) => {
                this.showStatus('Connection error: ' + error.message, 'error');
                this.stopListening();
            };
            
        } catch (error) {
            this.showStatus('Error accessing microphone: ' + error.message, 'error');
        }
    }
    
    setupAudioRecording(stream) {
        this.audioContext = new AudioContext({ sampleRate: 24000 });
        const source = this.audioContext.createMediaStreamSource(stream);
        
        // Create a script processor for real-time audio processing
        const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (event) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                const audioData = event.inputBuffer.getChannelData(0);
                const int16Array = new Int16Array(audioData.length);
                
                // Convert float32 to int16
                for (let i = 0; i < audioData.length; i++) {
                    int16Array[i] = Math.max(-32768, Math.min(32767, Math.floor(audioData[i] * 32768)));
                }
                
                // Send audio data to server
                this.ws.send(JSON.stringify({
                    type: 'audio',
                    data: Array.from(int16Array),
                    inputLanguage: this.inputLanguage.value,
                    outputLanguage: this.outputLanguage.value
                }));
            }
        };
        
        source.connect(processor);
        processor.connect(this.audioContext.destination);
        
        this.processor = processor;
        this.audioStream = stream;
    }
    
    handleRealtimeMessage(data) {
        switch (data.type) {
            case 'transcript':
                this.updateTranscript(data.text, data.isFinal);
                break;
            case 'translation':
                this.updateTranslation(data.text);
                break;
            case 'word_translation':
                this.updateWordByWord(data.words);
                break;
            case 'speaker_change':
                this.handleSpeakerChange();
                break;
            case 'error':
                this.showStatus('Error: ' + data.message, 'error');
                break;
        }
    }
    
    updateTranscript(text, isFinal) {
        if (isFinal) {
            this.currentTranscript += text;
            this.originalText.textContent = this.currentTranscript;
            
            // Scroll to bottom
            this.originalText.scrollTop = this.originalText.scrollHeight;
        } else {
            // Show partial transcript
            const partialText = this.currentTranscript + text;
            this.originalText.textContent = partialText;
        }
    }
    
    updateTranslation(text) {
        this.currentTranslation = text;
        this.translatedText.textContent = this.currentTranslation;
        
        // Scroll to bottom
        this.translatedText.scrollTop = this.translatedText.scrollHeight;
    }
    
    updateWordByWord(words) {
        this.wordByWordText.innerHTML = '';
        
        words.forEach(wordPair => {
            const wordElement = document.createElement('span');
            wordElement.className = 'word-translation';
            wordElement.innerHTML = `
                <span class="original-word">${wordPair.original}</span>
                <span class="translated-word">→ ${wordPair.translated}</span>
            `;
            this.wordByWordText.appendChild(wordElement);
        });
    }
    
    handleSpeakerChange() {
        this.currentSpeaker++;
        this.currentTranscript += '\n\n';
        this.currentTranslation += '\n\n';
        this.originalText.textContent = this.currentTranscript;
        this.translatedText.textContent = this.currentTranslation;
    }
    
    stopListening() {
        this.isRecording = false;
        
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        
        if (this.audioStream) {
            this.audioStream.getTracks().forEach(track => track.stop());
            this.audioStream = null;
        }
        
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.startButton.style.display = 'inline-block';
        this.stopButton.style.display = 'none';
        this.hideStatus();
    }
    
    clearTranscripts() {
        this.currentTranscript = '';
        this.currentTranslation = '';
        this.originalText.textContent = 'Press "Start Listening" to begin transcription...';
        this.translatedText.textContent = 'Translation will appear here...';
        this.wordByWordText.textContent = 'Word-by-word translations will appear here...';
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new LiveTranslateApp();
});