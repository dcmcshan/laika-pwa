#!/usr/bin/env python3
"""
Test script for LAIKA Architecture API
Tests all endpoints to ensure they work correctly
"""

import requests
import json
import time
import sys

def test_endpoint(url, name):
    """Test an API endpoint and return results"""
    try:
        print(f"🔍 Testing {name}...")
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ {name}: OK")
            if isinstance(data, dict):
                print(f"   📊 Response keys: {list(data.keys())}")
            elif isinstance(data, list):
                print(f"   📊 Response items: {len(data)}")
            return True
        else:
            print(f"❌ {name}: HTTP {response.status_code}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"❌ {name}: Connection refused (server not running)")
        return False
    except requests.exceptions.Timeout:
        print(f"❌ {name}: Timeout")
        return False
    except Exception as e:
        print(f"❌ {name}: Error - {e}")
        return False

def main():
    """Test all architecture API endpoints"""
    base_url = "http://localhost:8081"
    
    print("=" * 60)
    print("🧪 LAIKA Architecture API Test Suite")
    print("=" * 60)
    print(f"Testing endpoints at: {base_url}")
    print("=" * 60)
    
    endpoints = [
        (f"{base_url}/api/services/status", "All Services Status"),
        (f"{base_url}/api/service/status/stt", "STT Service Status"),
        (f"{base_url}/api/service/status/llm", "LLM Service Status"),
        (f"{base_url}/api/service/status/tts", "TTS Service Status"),
        (f"{base_url}/api/system/stats", "System Statistics"),
        (f"{base_url}/api/pubsub/log", "PubSub Log"),
        (f"{base_url}/api/architecture/overview", "Architecture Overview"),
    ]
    
    results = []
    for url, name in endpoints:
        result = test_endpoint(url, name)
        results.append(result)
        time.sleep(0.5)  # Small delay between requests
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary")
    print("=" * 60)
    
    passed = sum(results)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    
    if passed == total:
        print("🎉 All tests passed! Architecture API is working correctly.")
        return 0
    else:
        print("⚠️  Some tests failed. Check server status and configuration.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
