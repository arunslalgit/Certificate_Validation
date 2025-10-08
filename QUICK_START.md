# Quick Start Guide

## 🚀 Backend is Ready!

All dependencies installed and database initialized.

## How to Access the Database

### Option 1: SQLite Command Line (Easiest)
```bash
sqlite3 ./data/certificates.db
```

Inside sqlite3:
- `.tables` - List all tables
- `.schema` - Show table structures
- `SELECT * FROM users;` - View all users
- `SELECT * FROM certificate_configs;` - View certificates
- `SELECT * FROM certificate_results;` - View check results
- `.quit` - Exit

### Option 2: DB Browser for SQLite (GUI - Recommended)
1. Download: https://sqlitebrowser.org/
2. Install and open
3. File → Open Database → Select `./data/certificates.db`
4. Browse tables, run queries visually

### Option 3: VS Code Extension
1. Install "SQLite Viewer" extension in VS Code
2. Right-click `data/certificates.db` in file explorer
3. Select "Open Database"

## Start the Server

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

Server runs on: **http://localhost:3001**

## Default Login

- **Username:** admin
- **Password:** admin123

## Test the API

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# List certificates
curl http://localhost:3001/api/certificates -b cookies.txt

# Get dashboard stats
curl http://localhost:3001/api/dashboard-stats -b cookies.txt
```

## Project Structure

```
├── data/certificates.db    ← SQLite database here
├── server.js               ← Main API server
├── cert-checker.js         ← Certificate checking logic
├── scheduler.js            ← Auto-check every 15 min
├── notifications.js        ← Email & Teams alerts
└── package.json            ← Dependencies
```

## What's Working

✅ Database initialized with 4 tables
✅ API server with all endpoints
✅ Authentication (cookie-based)
✅ Certificate checking (TLS/SSL)
✅ Automated scheduler (checks every 15 min)
✅ Email & Teams notifications
✅ Data retention (cleans old results)
✅ Per-certificate alert configuration

## Next Steps

1. **Start the server:** `npm start`
2. **View the database** (see options above)
3. **Test the API** with curl or Postman
4. **Build the frontend** (React + Mantine)

## Database Tables

1. **users** - Admin, user, viewer accounts
2. **certificate_configs** - URLs to monitor with team-specific settings
3. **certificate_results** - Historical check results
4. **system_settings** - System configuration

## Quick Commands

```bash
# Initialize database (already done)
npm run init-db

# Start server
npm start

# View database
sqlite3 ./data/certificates.db

# Check logs
tail -f logs/app.log
```

## Need Help?

- Full setup guide: [SETUP.md](SETUP.md)
- Technical design: [TechnicalDesign.md](TechnicalDesign.md)
- Project overview: [README.md](README.md)
