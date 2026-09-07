# ZeroFeed

ZeroFeed is a multi-client productivity and focus-enforcement system designed to eliminate algorithmic recommendation feeds across YouTube, Twitter/X, and LinkedIn using an enterprise policy lock and accountability partner verification.

---

## 🏛️ Monorepo Architecture

```text
ZeroFeed/
├── backend/          # Central Express + TypeScript + Prisma API (Port 4000)
├── desktop/          # Electron desktop application (Forge + Webpack)
├── web/              # Web portal & tenant configuration UI (Port 3001)
├── extension/        # Chrome Extension (Manifest V3 + Vite build pipeline)
└── release/          # Production release packages (.zip)
```

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js**: v20+ 
- **Docker & Docker Compose** (for PostgreSQL)

### 2. Start the Backend & Database
```bash
# From project root
docker compose up -d --build
docker compose exec api npx prisma migrate dev --name init
```

Verify backend health:
```bash
curl http://localhost:4000/health
```

### 3. Run Applications
- **Run all components concurrently**:
  ```bash
  npm run dev
  ```
- **Web Portal only**:
  ```bash
  npm run dev:web
  ```
  Open: [http://localhost:3001](http://localhost:3001)

- **Desktop App only**:
  ```bash
  npm run dev:desktop
  ```

- **Extension Watcher (Vite)**:
  ```bash
  npm run dev:extension
  ```
  In Google Chrome: Navigate to `chrome://extensions` → Enable **Developer mode** → Click **Load unpacked** → Select `extension/dist`.

---

## 📦 Production Builds

- **Build Extension**:
  ```bash
  npm run build:extension
  ```
- **Package Extension for Chrome Web Store**:
  ```bash
  npm run release:extension
  ```
  Generates `release/zerofeed-extension.zip`.

---

## 🧪 Testing

```bash
npm run test:desktop   # Runs 6/6 Electron policy-enforcer tests
npm run test:backend   # Runs 11/11 Express API unit & integration tests
```
