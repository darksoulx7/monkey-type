# MonkeyType Clone - Typing Speed Test

A modern, minimalist typing speed test website inspired by MonkeyType, built with React and Node.js.

## Features

### Core Features
- ⌨️ **Multiple Test Modes**: Time-based (15s, 30s, 60s, 120s) and word count-based (10, 25, 50, 100 words)
- 📊 **Real-time Statistics**: WPM, accuracy %, character count, error highlighting
- 🌙 **Light/Dark Themes**: Beautiful, distraction-free UI
- ⚡ **Low Input Latency**: Optimized for fast, accurate keystroke handling
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- ⌨️ **Keyboard Shortcuts**: Tab/Enter to restart, Esc to reset

### Advanced Features
- 👤 **User Accounts**: Registration, login, profile management
- 🏆 **Leaderboards**: Global and friends rankings
- 📝 **Custom Word Lists**: Create and share your own word collections
- 🏁 **Multiplayer Races**: Real-time typing races with friends
- 📈 **Detailed Statistics**: Progress tracking, export data (CSV/JSON)
- 🔄 **Real-time Updates**: WebSocket-powered live statistics

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **TailwindCSS** - Utility-first CSS framework
- **Framer Motion** - Smooth animations and transitions
- **Zustand** - Lightweight state management
- **Socket.IO Client** - Real-time WebSocket communication
- **React Router** - Client-side routing
- **Vite** - Fast build tool and dev server

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **MongoDB** - NoSQL database with Mongoose ODM
- **Socket.IO** - Real-time WebSocket server
- **JWT** - JSON Web Token authentication
- **bcrypt** - Password hashing
- **Redis** - Caching and session storage (optional)

## Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB 5+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd monkey-type
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Set up environment variables**
   ```bash
   cd ../backend
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start MongoDB**
   ```bash
   # Using Docker
   docker run -d -p 27017:27017 --name mongodb mongo:latest
   
   # Or start your local MongoDB service
   sudo systemctl start mongod
   ```

6. **Seed the database** (optional)
   ```bash
   cd backend
   node src/scripts/seedDatabase.js
   ```

7. **Start the development servers**

   Backend (Terminal 1):
   ```bash
   cd backend
   npm run dev
   ```

   Frontend (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

8. **Open your browser**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## Configuration

### Backend Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/monkeytype

# Authentication
JWT_SECRET=your-secret-key-change-in-production

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Frontend Configuration

The frontend automatically connects to the backend at `http://localhost:3001`. To change this, update the API URL in `src/utils/api.js`.

## Usage

### Basic Typing Test
1. Visit the homepage
2. Select your preferred test mode (time or word count)
3. Click "Start Test" or press Tab/Enter
4. Start typing! The test begins with your first keystroke
5. View your results: WPM, accuracy, consistency score

### User Account Features
1. Register/Login to save your progress
2. View detailed statistics and progress charts
3. Compete on global and friends leaderboards
4. Create custom word lists for practice

### Multiplayer Races
1. Go to multiplayer section
2. Create a new race or join existing ones
3. Wait for other players to join
4. Race begins automatically with countdown
5. See real-time progress of all participants

## API Documentation

The backend provides a comprehensive REST API and WebSocket interface:

- **API Documentation**: Available at `/docs/api-spec.yaml` (OpenAPI format)
- **WebSocket Events**: Documented in `/docs/websocket-events.md`
- **Health Check**: `GET /health`
- **Metrics**: `GET /metrics` (development only)

## Development

### Project Structure
```
monkey-type/
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── sockets/        # WebSocket handlers
│   │   ├── middleware/     # Auth, validation, etc.
│   │   └── utils/          # Helper functions
│   └── package.json
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Zustand stores
│   │   ├── utils/          # Helper functions
│   │   └── hooks/          # Custom React hooks
│   └── package.json
└── docs/                  # API documentation
```

### Code Style
- ESLint configuration included
- Prettier for code formatting
- Follow existing patterns and conventions

### Testing
```bash
# Backend tests
cd backend
npm test

# Frontend tests  
cd frontend
npm test
```

## Performance Features

- **Optimized Keystroke Handling**: Sub-10ms input latency
- **Smart Caching**: Redis-based caching for improved performance
- **Connection Pooling**: Efficient database connections
- **Gzip Compression**: Reduced payload sizes
- **Rate Limiting**: Protection against abuse
- **Memory Management**: Automatic cleanup of inactive sessions

## Security

- JWT-based authentication with refresh tokens
- Password hashing with bcrypt (12+ rounds)
- Input validation and sanitization
- CORS protection with configurable origins
- Helmet.js security headers
- Rate limiting on API endpoints
- WebSocket authentication and validation

## Deployment

### Using Docker
```bash
# Build and run with Docker Compose
docker-compose up -d
```

### Manual Deployment
1. Build frontend: `npm run build`
2. Set production environment variables
3. Deploy backend to your preferred platform
4. Serve frontend static files
5. Configure reverse proxy (nginx recommended)

### Environment Variables for Production
```env
NODE_ENV=production
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=very-secure-secret-key
CORS_ORIGIN=https://yourdomain.com
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by [MonkeyType](https://monkeytype.com)
- Built with modern web technologies
- Focus on performance, accessibility, and user experience

## Support

For questions or issues:
- Open an issue on GitHub
- Check the API documentation
- Review the WebSocket events documentation

---

**Happy typing! 🐒⌨️**