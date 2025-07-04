import blake3
import os
import shutil
from pathlib import Path
from typing import Optional
import mimetypes


def calculate_file_hash(file_path: str) -> str:
    """Calculate Blake3 hash of a file."""
    hasher = blake3.blake3()
    with open(file_path, "rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()


def calculate_file_hash_from_bytes(file_content: bytes) -> str:
    """Calculate Blake3 hash from file content bytes."""
    hasher = blake3.blake3()
    hasher.update(file_content)
    return hasher.hexdigest()


def is_pdf_file(filename: str) -> bool:
    """Check if file is a PDF based on extension."""
    return filename.lower().endswith(".pdf")


def get_file_mime_type(filename: str) -> str:
    """Get MIME type of file."""
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type or "application/octet-stream"


def ensure_upload_dir(upload_dir: str) -> Path:
    """Ensure upload directory exists."""
    upload_path = Path(upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path


def generate_unique_filename(original_filename: str, file_hash: str) -> str:
    """Generate unique filename using hash prefix."""
    file_ext = Path(original_filename).suffix
    return f"{file_hash[:16]}{file_ext}"


def save_uploaded_file(file_content: bytes, upload_dir: str, filename: str) -> str:
    """Save uploaded file to disk and return the file path."""
    upload_path = ensure_upload_dir(upload_dir)
    file_path = upload_path / filename

    with open(file_path, "wb") as f:
        f.write(file_content)

    return str(file_path)


def delete_file_if_exists(file_path: str) -> bool:
    """Delete file if it exists."""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception:
        return False


def validate_file_size(file_size: int, max_size: int = 50 * 1024 * 1024) -> bool:
    """Validate file size (default 50MB)."""
    return file_size <= max_size
