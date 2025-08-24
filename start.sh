#!/bin/bash

# MonkeyType Clone Startup Script
echo "🐒 Starting MonkeyType Clone..."

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "❌ MongoDB is not running. Please start MongoDB first:"
    echo "   sudo systemctl start mongod"
    echo "   OR"
    echo "   docker run -d -p 27017:27017 --name mongodb mongo:latest"
    exit 1
fi

echo "✅ MongoDB is running"

# Create .env file if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating .env file..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env with your configuration"
fi

# Seed database if needed
echo "🌱 Seeding database with sample data..."
cd backend
node src/scripts/seedDatabase.js
cd ..

# Start backend in background
echo "🚀 Starting backend server..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend
echo "🎨 Starting frontend development server..."
cd frontend
npm run dev &
FRONTEND_PID=$!

# Function to cleanup processes
cleanup() {
    echo ""
    echo "🛑 Shutting down servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "✅ Servers stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

echo ""
echo "🎉 MonkeyType Clone is running!"
echo "📱 Frontend: http://localhost:5173"
echo "🔧 Backend:  http://localhost:3001"
echo "📊 Health:   http://localhost:3001/health"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for processes
wait