---
title: Live Translate Claude
emoji: 🎤
colorFrom: blue
colorTo: green
sdk: docker
pinned: false
license: mit
app_port: 3000
---

# Live Translate Claude

Real-time speech transcription and translation app using OpenAI's Realtime API. Transcribes speech in Swedish, English, or Chinese and translates it live to any of these languages.

## Features

- 🎤 **Real-time Speech Transcription**: Uses OpenAI Realtime API for accurate speech-to-text
- 🌍 **Multi-language Support**: Swedish, English, and Chinese
- 🔄 **Live Translation**: Instant translation as you speak
- 👥 **Speaker Detection**: Automatically detects when a new person starts speaking
- 📝 **Word-by-Word Translation**: Shows individual word translations for language learning
- 🎨 **Clean, Responsive UI**: Works on desktop and mobile devices

## Usage

1. **Set your OpenAI API Key** in the Hugging Face Spaces settings
2. **Select Languages**: Choose input and output languages
3. **Click "Start Listening"**: Allow microphone access
4. **Start Speaking**: Watch real-time transcription and translation

## Configuration

Add your OpenAI API key as a secret in the Hugging Face Spaces settings:
- Key: `OPENAI_API_KEY`
- Value: Your OpenAI API key from https://platform.openai.com/api-keys

## Supported Languages

- **Swedish (sv)** - Default input language
- **English (en)**
- **Chinese (zh)**

## Technical Details

- **Frontend**: Vanilla JavaScript with WebSocket connection
- **Backend**: Node.js with Express and WebSocket server
- **AI Integration**: OpenAI Realtime API for transcription and GPT-4 for translation
- **Deployment**: Docker container on Hugging Face Spaces

## Local Development

```bash
# Clone the repository
git clone https://github.com/chrfra/live-translate-claude.git
cd live-translate-claude

# Set up environment
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run with Docker
docker-compose up --build

# Or run locally
npm install
npm start
```

## License

MIT License