#!/usr/bin/env python3
"""
Simple test script to verify the PDF Annotation API is working
"""

import requests
import json
import os
from pathlib import Path

API_BASE_URL = "http://localhost:8000"


def test_health_check():
    """Test the health check endpoint"""
    try:
        response = requests.get(f"{API_BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Health check passed")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Is the server running?")
        return False


def test_root_endpoint():
    """Test the root endpoint"""
    try:
        response = requests.get(f"{API_BASE_URL}/")
        if response.status_code == 200:
            print("✅ Root endpoint working")
            return True
        else:
            print(f"❌ Root endpoint failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Is the server running?")
        return False


def test_list_files():
    """Test listing files endpoint"""
    try:
        response = requests.get(f"{API_BASE_URL}/files")
        if response.status_code == 200:
            files = response.json()
            print(f"✅ Files endpoint working. Found {len(files)} files")
            return True
        else:
            print(f"❌ Files endpoint failed: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to API. Is the server running?")
        return False


def run_tests():
    """Run all tests"""
    print("Testing PDF Annotation API...")
    print("-" * 40)

    tests = [test_health_check, test_root_endpoint, test_list_files]

    passed = 0
    for test in tests:
        if test():
            passed += 1

    print("-" * 40)
    print(f"Tests passed: {passed}/{len(tests)}")

    if passed == len(tests):
        print("🎉 All tests passed! API is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the server logs.")


if __name__ == "__main__":
    run_tests()
