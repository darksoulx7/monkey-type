# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a typing speed test website inspired by Monkeytype. The project is currently in the planning/specification phase, with the main requirements documented in `implement.md`.

## Project Requirements

Based on `implement.md`, this project should implement:

**Core Features:**
- Minimalist typing test UI with light/dark themes
- Multiple test modes: time-based (15s, 30s, 60s, 120s) and word count-based (10, 25, 50, 100 words)
- Real-time statistics: WPM, accuracy %, character count, error highlighting
- Random word sequences from predefined word bank
- Keyboard shortcuts for restart/retry (Tab or Enter)
- Responsive design for all devices

**Advanced Features (Phase 2):**
- User accounts with history tracking
- Global and friends leaderboards
- Custom word lists (technical, coding, quotes)
- Multiplayer race mode with real-time WebSockets
- Stats export (CSV/JSON)

## Recommended Tech Stack

**Frontend:** React + TailwindCSS
**Backend:** Node.js (Express/Fastify) with MongoDB or MySQL
**Real-time:** WebSockets (Socket.IO or native ws)
**Animations:** Framer Motion
**Hosting:** Vercel/Netlify for frontend, AWS services for backend

## Performance Requirements

- Focus on low input latency for fast keystroke handling
- Handle edge cases: backspace errors, key holding, disabled text pasting
- Smooth animations and transitions
- Production-grade, extensible architecture prioritizing speed, simplicity, and maintainability

## Development Status

Currently, this repository contains only the project specification. No code has been implemented yet. When development begins, follow the architecture and requirements outlined in `implement.md`.