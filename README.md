# Live Translate Claude

Real-time speech transcription and translation app using OpenAI's Realtime API. Transcribes speech in Swedish, English, or Chinese and translates it live to any of these languages.

## Features

- 🎤 **Real-time Speech Transcription**: Uses OpenAI Realtime API for accurate speech-to-text
- 🌍 **Multi-language Support**: Swedish, English, and Chinese
- 🔄 **Live Translation**: Instant translation as you speak
- 👥 **Speaker Detection**: Automatically detects when a new person starts speaking
- 📝 **Word-by-Word Translation**: Shows individual word translations for language learning
- 🎨 **Clean, Responsive UI**: Works on desktop and mobile devices

## Prerequisites

- Node.js (version 14 or higher)
- OpenAI API key with access to the Realtime API
- Modern web browser with microphone access

## Setup

1. **Clone and install dependencies:**
   ```bash
   cd ~/workspace/cursor-claude/live-translate-claude
   npm install
   ```

2. **Set up your OpenAI API Key:**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit the .env file and add your OpenAI API key
   # Get your API key from: https://platform.openai.com/api-keys
   ```

3. **Run the application:**
   ```bash
   npm start
   ```

4. **Open in browser:**
   Navigate to `http://localhost:3000`

## Usage

1. **Select Languages:**
   - Choose your input language (the language you're speaking)
   - Choose your output language (the language you want the translation in)

2. **Start Listening:**
   - Click "Start Listening"
   - Allow microphone access when prompted
   - Start speaking!

3. **View Results:**
   - **Original Text**: Shows the transcribed speech in your input language
   - **Translated Text**: Shows the real-time translation in your output language
   - **Word-by-Word**: Shows individual word translations for learning

## Supported Languages

- **Swedish (sv)** - Default input language
- **English (en)**
- **Chinese (zh)**

## Technical Details

### Architecture
- **Frontend**: Vanilla JavaScript with WebSocket connection
- **Backend**: Node.js with Express and WebSocket server
- **AI Integration**: OpenAI Realtime API for transcription and GPT-4 for translation

### Audio Processing
- Sample rate: 24kHz
- Format: PCM16
- Real-time audio streaming via WebSocket
- Automatic speaker change detection based on silence periods

### Translation Pipeline
1. Real-time audio → OpenAI Realtime API → Speech-to-text
2. Transcribed text → GPT-4 → Full sentence translation
3. Transcribed text → GPT-4 → Word-by-word translation

## Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `PORT`: Server port (optional, defaults to 3000)

## Browser Requirements

- Chrome, Firefox, Safari, or Edge (latest versions)
- HTTPS required for microphone access (or localhost for development)
- WebSocket support
- Web Audio API support

## Troubleshooting

### "Microphone access denied"
- Check browser permissions for microphone access
- Ensure you're using HTTPS or localhost
- Try refreshing the page and allowing access again

### "Connection error"
- Verify your OpenAI API key is set correctly
- Check your internet connection
- Ensure the OpenAI Realtime API is accessible from your network

### "No transcription appearing"
- Speak clearly and at normal volume
- Check that your microphone is working in other applications
- Try switching to a different language setting

## Development

To contribute or modify the application:

```bash
# Start development server with auto-reload
npm run dev

# The server will restart automatically when you make changes
```

## License

MIT License - see LICENSE file for details.
