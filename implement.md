# Typing Speed Test Website Prompt (Monkeytype-like)

## Objective
Build a **typing speed test website inspired by Monkeytype**.

---

## Core Requirements
- Minimalist, distraction-free UI (light and dark themes).
- Typing test modes:
  - By time (15s, 30s, 60s, 120s).
  - By word count (10, 25, 50, 100 words).
- Show real-time stats:
  - **WPM (words per minute)**
  - **Accuracy %** (correct vs. incorrect keystrokes)
  - **Characters typed**
  - **Errors highlighted in real-time**
- Display random word sequences from a predefined word bank.
- Restart / retry test with keyboard shortcut (`Tab` or `Enter`).
- Responsive layout (desktop, tablet, mobile).

---

## Advanced Features (Phase 2)
- User accounts with history tracking.
- Leaderboard (global + friends).
- Custom word lists (technical, coding, quotes).
- Multiplayer race mode (real-time WebSocket).
- Export stats (CSV/JSON).

---

## Tech Stack Recommendation
- **Frontend**: React + TailwindCSS (clean component structure, fast rendering).
- **Backend**: Node.js (Express/Fastify) with MongoDB or MySQL for storing users/scores.
- **Real-time**: WebSockets (Socket.IO or native ws).
- **Hosting**: Vercel/Netlify for frontend, AWS (ECS/Lambda/RDS/DynamoDB) for backend.

---

## Performance & UX
- Focus on **low input latency** (fast keystroke handling).
- Handle edge cases:
  - Backspace errors
  - Holding keys
  - Pasting text (should be disabled)
- Smooth animations with **Framer Motion** for transitions.

---

## Deliverable
Deliver a **production-grade, extensible architecture**, prioritizing **speed, simplicity, and maintainability**.
