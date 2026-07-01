#!/bin/bash

# Exit on any error
set -e

echo "=== Starting EduMind AI Platforms ==="

# Check for API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Warning: OPENAI_API_KEY is not set in the environment. AI completions will fail."
fi

# Function to stop background processes on exit
cleanup() {
    echo "Shutting down servers..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT

# 1. Start FastAPI Backend
echo "Starting backend server on http://localhost:8000..."
export PYTHONPATH=backend
backend/venv/bin/python3 backend/app/main.py &
BACKEND_PID=$!

# 2. Start Vite React Frontend
echo "Starting frontend dev server on http://localhost:5173..."
npm run dev --prefix frontend &
FRONTEND_PID=$!

# Wait for both processes
echo "EduMind AI is running! Press Ctrl+C to terminate both servers."
wait
