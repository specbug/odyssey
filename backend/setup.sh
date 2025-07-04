#!/bin/bash

echo "Setting up PDF Annotation Backend..."

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv venv

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
DATABASE_URL=sqlite:///./pdf_annotations.db
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=50000000
ALLOWED_EXTENSIONS=pdf
HOST=0.0.0.0
PORT=8000
RELOAD=true
EOF
fi

# Create uploads directory
echo "Creating uploads directory..."
mkdir -p uploads

echo "Setup complete!"
echo ""
echo "To run the backend:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Run the application: python run.py"
echo "3. Visit http://localhost:8000/docs for API documentation" 