# LAIKA STT Services - Speech-to-Text Comparison Tool

## Overview

The LAIKA STT Services provide a comprehensive testing and comparison interface for multiple Speech-to-Text (STT) providers. This tool allows you to:

- Record audio directly in the browser
- Test the audio against multiple STT providers simultaneously
- Compare accuracy and performance across providers
- Configure which STT provider LAIKA's `/stt` node should use

## Supported STT Providers

1. **Web Speech API** (Browser-based)
   - Uses the browser's built-in speech recognition
   - No API key required
   - Best for real-time transcription

2. **Whisper (Local)**
   - Runs OpenAI's Whisper model locally
   - No API key required
   - Privacy-focused (audio never leaves your machine)
   - Requires installation of `openai-whisper`

3. **OpenAI Whisper (Cloud)**
   - Uses OpenAI's cloud-based Whisper API
   - Requires `OPENAI_API_KEY`
   - High accuracy, supports multiple languages

4. **OpenAI Realtime**
   - Uses OpenAI's Realtime API
   - Requires `OPENAI_API_KEY`
   - Optimized for streaming/real-time transcription

5. **ElevenLabs STT**
   - Uses ElevenLabs' speech-to-text service
   - Requires `ELEVENLABS_API_KEY`
   - Note: ElevenLabs primarily focuses on TTS

## Setup

### 1. Install Dependencies

```bash
# Install Python dependencies
pip install -r requirements_stt.txt

# For local Whisper support, also install:
pip install openai-whisper
```

### 2. Configure API Keys

Create a `.env` file in the `laika-pwa` directory:

```bash
# OpenAI API Key (for Whisper and Realtime)
OPENAI_API_KEY=your_openai_api_key_here

# ElevenLabs API Key (if available)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### 3. Start the Services

```bash
# Make the startup script executable
chmod +x start_stt_services.sh

# Start the STT services
./start_stt_services.sh
```

Or manually:

```bash
python stt_services.py
```

The services will start on port 5001 by default.

## Usage

### Web Interface

1. Open your browser and navigate to: `http://localhost:5001/stt`
2. Click the **RECORD** button to start recording audio
3. Click **STOP** when finished
4. Select which STT providers you want to test
5. Click **Process with All Selected** to run the comparison
6. View the results for each provider

### LAIKA STT Node Configuration

The interface allows you to configure which STT provider the LAIKA `/stt` node should use:

1. In the **LAIKA /stt Node Configuration** section, select your preferred provider
2. Click **Save LAIKA Configuration**
3. LAIKA will now use the selected provider for speech-to-text operations

### API Endpoints

The STT services expose the following REST API endpoints:

#### STT Processing Endpoints

- `POST /api/stt/whisper/local` - Process audio with local Whisper
- `POST /api/stt/openai/whisper` - Process audio with OpenAI Whisper API
- `POST /api/stt/openai/realtime` - Process audio with OpenAI Realtime API
- `POST /api/stt/elevenlabs` - Process audio with ElevenLabs STT

All endpoints accept multipart/form-data with an `audio` file field.

#### Configuration Endpoints

- `GET /api/laika/stt/config` - Get current LAIKA STT configuration
- `POST /api/laika/stt/config` - Set LAIKA STT configuration

#### Health Check

- `GET /api/health` - Service health check

## Features

### Audio Recording
- High-quality audio recording in the browser
- Real-time audio visualization
- Playback controls
- Download recorded audio

### Comparison Results
- Side-by-side comparison of all selected providers
- Processing time metrics
- Error handling and status indicators
- Transcript display with confidence scores (when available)

### LAIKA Integration [[memory:6555277]]
- Configure which STT provider LAIKA uses for the `/stt` node
- Persistent configuration storage
- Easy switching between providers

## Troubleshooting

### Microphone Access
- Ensure your browser has permission to access the microphone
- Check system privacy settings for microphone access

### API Keys
- Verify API keys are correctly set in the `.env` file
- Check API key quotas and limits

### Local Whisper
- Ensure `openai-whisper` is installed: `pip install openai-whisper`
- First run will download the model (may take time)
- Check available disk space for model storage

### Port Conflicts
- If port 5001 is in use, modify the port in `stt_services.py`
- Update the URL in your browser accordingly

## Performance Notes

- **Local Whisper**: First run downloads the model. Subsequent runs are faster.
- **Web Speech API**: Requires active internet connection despite being "browser-based"
- **Cloud APIs**: Performance depends on network latency and file size
- **Audio Format**: WebM format is used by default, automatically converted when needed

## Privacy Considerations

- **Local Options**: Web Speech API and Local Whisper keep audio on your machine
- **Cloud Options**: OpenAI and ElevenLabs send audio to their servers
- **Storage**: Uploaded audio files are temporarily stored and immediately deleted after processing

## Development

### Adding New STT Providers

1. Add provider configuration to `STT_PROVIDERS` in `stt-comparison.js`
2. Implement processing function in `stt_services.py`
3. Add API endpoint in `stt_services.py`
4. Update UI in `stt.html` if needed

### Customizing the Interface

- Styles are embedded in `stt.html` for easy customization
- JavaScript logic is in `js/stt-comparison.js`
- Backend logic is in `stt_services.py`

## Future Enhancements

- [ ] Real-time streaming transcription
- [ ] WebSocket support for live transcription
- [ ] Batch processing of multiple audio files
- [ ] Export comparison results to CSV/JSON
- [ ] Language detection and multi-language support
- [ ] Custom vocabulary and domain-specific models
- [ ] Audio preprocessing options (noise reduction, etc.)

## Support

For issues or questions about the STT services, please check:
1. This README file
2. Console logs in browser developer tools
3. Server logs in the terminal running `stt_services.py`
4. The `/api/health` endpoint for service status
