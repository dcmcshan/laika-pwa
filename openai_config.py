#!/usr/bin/env python3
"""
OpenAI Configuration for Cursor AI Integration
Set your OpenAI API key here or via environment variable
"""

import os

# OpenAI Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# Instructions for setup
SETUP_INSTRUCTIONS = """
🤖 **Cursor AI with OpenAI Integration Setup**

To enable real AI responses, you need to set your OpenAI API key:

**Option 1: Environment Variable (Recommended)**
export OPENAI_API_KEY="your-api-key-here"

**Option 2: Edit this file**
Edit openai_config.py and set OPENAI_API_KEY = "your-api-key-here"

**Get an API key:**
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Set it using one of the methods above

**Then restart the server:**
python3 server.py
"""

def get_openai_config():
    """Get OpenAI configuration"""
    return {
        "openai_api_key": OPENAI_API_KEY,
        "openai_model": OPENAI_MODEL
    }

def is_openai_configured():
    """Check if OpenAI is properly configured"""
    return bool(OPENAI_API_KEY and OPENAI_API_KEY != "your-api-key-here")

if __name__ == "__main__":
    print(SETUP_INSTRUCTIONS)
    if is_openai_configured():
        print("✅ OpenAI API key is configured")
    else:
        print("❌ OpenAI API key is NOT configured")
        print("\nSet your API key with:")
        print('export OPENAI_API_KEY="your-api-key-here"')
