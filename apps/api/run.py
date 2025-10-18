#!/usr/bin/env python3
"""
Start script for the PDF Annotation API
"""

import uvicorn
import os
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    # Configuration
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    reload = os.getenv("RELOAD", "true").lower() == "true"

    print(f"Starting PDF Annotation API on {host}:{port}")
    print(f"Reload enabled: {reload}")

    uvicorn.run("app.main:app", host=host, port=port, reload=reload, log_level="info")
