# 🏀 Shot Tracker

Shot Tracker is a mobile application designed to help basketball players and coaches track shooting performance in a simple, visual, and structured way.

Born from real training sessions, the app aims to make effort visible — especially in environments where data is often underutilized, like amateur and women’s basketball.

---

## ✨ Features

- 📍 Shot tracking by court position (2PT & 3PT)
- 🎯 Session-based training flow
- 📊 Automatic statistics calculation (makes, attempts, percentages)
- 🔥 Heatmap visualization of performance
- 🧠 Smart training insights per session
- 📋 Workout plans (training templates)
- 👥 Designed for both players and coaches

---

## 📱 Tech Stack

### Frontend
- React Native
- Expo
- TypeScript

### UI & Visualization
- React Native SVG (custom basketball court & heatmaps)
- Custom component system

### Backend (Cloud)
- Supabase
  - PostgreSQL database
  - Authentication (email/password)
  - Auto-generated APIs

### Tools
- Git & GitHub
- Expo CLI
- Node.js

---

## 🧩 Architecture

The app follows a simple and scalable structure:

- **Client (React Native)** handles UI, interaction, and lightweight calculations
- **Supabase (Backend)** handles:
  - Data persistence (sessions, spots, results)
  - Authentication
  - Secure access via Row Level Security (RLS)

---

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/shot-tracker.git
cd shot-tracker
