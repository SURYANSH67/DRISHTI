#!/bin/bash
# Auto-reconnecting tunnel daemon for DRISHTI AI

while true; do
  echo "=================================================="
  echo "Launching secure public tunnel on port 8000..."
  echo "=================================================="
  ssh -p 443 -o StrictHostKeyChecking=no -o ServerAliveInterval=10 -o ServerAliveCountMax=3 -R 80:localhost:8000 a.pinggy.io
  
  echo "Tunnel disconnected or timed out. Reconnecting in 5 seconds..."
  sleep 5
done
