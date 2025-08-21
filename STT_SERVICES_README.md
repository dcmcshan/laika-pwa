# LAIKA STT Testing Interface

## Overview

The LAIKA STT Testing Interface provides a way to test and compare Speech-to-Text (STT) capabilities using LAIKA's existing robust STT system. This tool allows you to:

- Record audio directly in the browser
- Test the audio against LAIKA's robust STT node and Web Speech API
- Compare accuracy and performance
- Configure LAIKA's STT node parameters

## How It Works

The `/stt` page integrates with LAIKA's existing ROS2-based STT system:

1. **LAIKA Robust STT Node** - Uses the existing `robust_stt_node` from the `large_models` package
   - Publishes to `/vocal_detect/asr_result` topic
   - Multi-level fallback: OpenAI Realtime → OpenAI Whisper → Local Whisper
   - Wake word detection with "LAIKA" [[memory:6555275]]

2. **Web Speech API** - Browser-based speech recognition for comparison

## Prerequisites

### 1. ROS2 Environment
Ensure LAIKA's ROS2 workspace is built and sourced:

```bash
cd ros2_ws
source /opt/ros/humble/setup.bash
colcon build --packages-select large_models laika_nodes
source install/setup.bash
```

### 2. ROS2 Bridge Server
Install and run the ROS2 bridge server for WebSocket communication:

```bash
# Install rosbridge_server
sudo apt install ros-humble-rosbridge-server

# Or build from source
cd ros2_ws/src
git clone https://github.com/RobotWebTools/rosbridge_suite.git
cd ..
colcon build --packages-select rosbridge_server
source install/setup.bash
```

### 3. Environment Variables
Set up API keys for LAIKA's STT system:

```bash
# Required for OpenAI Whisper and Realtime APIs
export OPENAI_API_KEY="your-openai-api-key"
```

## Usage

### 1. Start LAIKA's STT System

```bash
# Launch the complete STT-LLM-TTS-ACT pipeline
ros2 launch laika_nodes laika_stt_llm_tts_act.launch.py

# Or launch just the STT node
ros2 launch large_models robust_stt_node.launch.py
```

### 2. Start ROS2 Bridge Server

```bash
# In a separate terminal
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

### 3. Access the STT Testing Interface

Open your browser and navigate to: `http://localhost:5000/stt`

### 4. Test STT Functionality

1. **Record Audio**: Click the red RECORD button and speak
2. **Select Providers**: Choose which STT systems to test
3. **Process Audio**: Click "Process with All Selected"
4. **View Results**: Compare transcriptions from different providers
5. **Configure LAIKA**: Set LAIKA's STT node parameters

## Features

### Audio Recording
- High-quality audio recording in the browser
- Real-time audio visualization
- Playback controls
- Download recorded audio

### STT Comparison
- **LAIKA Robust STT**: Multi-level fallback system
  - OpenAI Realtime API (primary)
  - OpenAI Whisper API (fallback)
  - Local Whisper model (final fallback)
- **Web Speech API**: Browser-based comparison

### LAIKA Integration
- Configure LAIKA's STT node parameters via ROS2
- Set wake word (default: "LAIKA")
- Enable/disable wake word detection
- Real-time status monitoring

### ROS2 Bridge
- WebSocket connection to ROS2 nodes
- Automatic reconnection handling
- Parameter management
- Topic subscription/publishing

## Configuration

### LAIKA STT Node Parameters

The interface can configure these ROS2 parameters for the `robust_stt_node`:

- `enable_wakeup`: Enable/disable wake word detection
- `awake_word`: Set the wake word (default: "LAIKA")
- `awake_method`: Wake word detection method
- `mode`: Recording mode

### ROS2 Bridge Configuration

The ROS2 bridge connects to `ws://localhost:9090` by default. You can modify this in `js/ros2-bridge.js`:

```javascript
this.wsUrl = 'ws://your-ros2-bridge-host:9090';
```

## Troubleshooting

### ROS2 Bridge Connection Issues
- Ensure `rosbridge_server` is running
- Check firewall settings for port 9090
- Verify ROS2 nodes are active

### STT Node Issues
- Check that `robust_stt_node` is running
- Verify API keys are set correctly
- Monitor ROS2 logs for errors

### Audio Recording Issues
- Ensure microphone permissions are granted
- Check browser compatibility
- Try different audio formats

## Architecture

```
Browser (STT Interface)
    ↓ WebSocket
ROS2 Bridge Server
    ↓ ROS2 Topics
LAIKA Robust STT Node
    ↓ Multi-level Fallback
1. OpenAI Realtime API
2. OpenAI Whisper API  
3. Local Whisper Model
```

## Development

### Adding New STT Providers

1. Add provider configuration to `STT_PROVIDERS` in `stt-comparison.js`
2. Implement processing function
3. Update UI in `stt.html`

### ROS2 Integration

The interface uses the ROS2 bridge to:
- Subscribe to `/vocal_detect/asr_result` for STT results
- Set parameters on the `robust_stt_node`
- Monitor node status

### Customization

- Styles are embedded in `stt.html`
- JavaScript logic is in `js/stt-comparison.js`
- ROS2 bridge is in `js/ros2-bridge.js`

## Future Enhancements

- [ ] Real-time audio streaming to ROS2
- [ ] Direct microphone input to STT node
- [ ] Batch processing of multiple audio files
- [ ] Export comparison results
- [ ] Custom vocabulary support
- [ ] Language detection and multi-language support

## Support

For issues or questions:
1. Check ROS2 node logs
2. Monitor browser console for errors
3. Verify ROS2 bridge connection status
4. Check the `/stt` page status indicators
