# 🚀 Complete Launch Guide - Certificate Expiry Monitor

## ✅ What's Been Built

### Backend (Node.js + Express + SQLite)
- ✅ Full REST API with authentication
- ✅ Real-time SSE streaming for certificate checks
- ✅ Automated scheduler (checks every 15 min)
- ✅ Email & Teams notifications
- ✅ Data retention (30-day cleanup)
- ✅ SQLite database with 4 tables

### Frontend (React + Mantine v8.0.1)
- ✅ Login page
- ✅ Dashboard with real-time monitoring
- ✅ Certificate management (CRUD)
- ✅ Real-time certificate checking with SSE
- ✅ Responsive UI with Mantine v8.0.1 components

---

## 🎯 How to Launch Everything

### Step 1: Start the Backend Server

Open a terminal in the project root directory:

```bash
# Make sure you're in the project root
cd /Users/arunlal/certificate_check/Certificate_Validation

# Start the backend server
npm start
```

You should see:
```
🚀 Server running on http://localhost:3001
📊 API available at http://localhost:3001/api
[Scheduler] Started - checking every 15 minutes for due certificates
[Retention] Scheduler started - running daily at 2 AM
✅ Ready to monitor certificates!
```

**Backend is now running on: http://localhost:3001**

---

### Step 2: Start the Frontend

Open a **NEW terminal** (keep backend running) and navigate to the frontend:

```bash
# Navigate to frontend directory
cd /Users/arunlal/certificate_check/Certificate_Validation/cert-ui

# Start the frontend dev server
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Frontend is now running on: http://localhost:5173**

---

### Step 3: Access the Application

1. Open your browser
2. Go to: **http://localhost:5173**
3. You'll see the login page

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

---

## 📝 How to Add Certificates and Write to Database

### Method 1: Using the Web UI (Easiest)

1. **Login** at http://localhost:5173
2. Click **"Certificates"** in the sidebar
3. Click **"Add Certificate"** button
4. Fill in the form:
   - **EAI Number**: `EAI-001`
   - **EAI Name**: `Production API`
   - **URL**: `https://google.com` (or any HTTPS URL)
   - **Environment**: Select `prod`
   - **Check Frequency**: `4` hours
   - **Alert Threshold**: `30` days
   - **Email Recipients**: `team@example.com` (optional)
   - **Teams Webhook URL**: Your Teams webhook (optional)
5. Click **"Create"**

✅ **The certificate is now saved to the database!**

### Method 2: Using the API (curl)

```bash
# Login first to get session cookie
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# Add a certificate
curl -X POST http://localhost:3001/api/certificates \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "eai_number": "EAI-002",
    "eai_name": "GitHub API",
    "url": "https://api.github.com",
    "environment": "prod",
    "alert_threshold_days": 30,
    "email_recipients": "team@example.com",
    "check_frequency_hours": 4
  }'
```

---

## 🔍 How to Check Certificates

### Option 1: Manual Check via UI

1. Go to **Dashboard** in the UI
2. Click **"Check All Certificates"** button
3. Watch real-time results stream in!
4. Results are saved to the database automatically

### Option 2: Automatic Checks (Scheduler)

- The scheduler runs **every 15 minutes** automatically
- Each certificate is checked based on its `check_frequency_hours` setting
- Results are automatically saved to the database
- Alerts are sent on Monday/Friday if thresholds are exceeded

---

## 🗄️ How to View the Database

### Option 1: SQLite Command Line

```bash
sqlite3 ./data/certificates.db

# View all certificates
SELECT * FROM certificate_configs;

# View latest check results
SELECT * FROM certificate_results ORDER BY checked_at DESC LIMIT 10;

# Exit
.quit
```

### Option 2: DB Browser for SQLite (GUI)

1. Download: https://sqlitebrowser.org/
2. Install and open
3. File → Open Database
4. Select: `./data/certificates.db`
5. Browse tables visually

### Option 3: VS Code Extension

1. Install "SQLite Viewer" extension
2. Right-click `data/certificates.db` in file explorer
3. Select "Open Database"

---

## 📊 Database Tables

### 1. `users`
Stores user accounts (admin, user, viewer roles)

### 2. `certificate_configs`
Your configured certificates - this is where new certificates are saved when you add them via UI or API

### 3. `certificate_results`
Historical check results - every time a certificate is checked, a new row is inserted here

### 4. `system_settings`
System configuration (SMTP, retention, etc.)

---

## 🎬 Quick Start Workflow

### 1️⃣ Start both servers:

**Terminal 1 (Backend):**
```bash
cd /Users/arunlal/certificate_check/Certificate_Validation
npm start
```

**Terminal 2 (Frontend):**
```bash
cd /Users/arunlal/certificate_check/Certificate_Validation/cert-ui
npm run dev
```

### 2️⃣ Add a certificate:

1. Open http://localhost:5173
2. Login: admin / admin123
3. Go to "Certificates"
4. Click "Add Certificate"
5. Fill form with a test URL (e.g., https://google.com)
6. Click "Create"

### 3️⃣ Check the certificate:

1. Go to "Dashboard"
2. Click "Check All Certificates"
3. Watch real-time results!

### 4️⃣ View the data in database:

```bash
sqlite3 ./data/certificates.db "SELECT * FROM certificate_configs;"
sqlite3 ./data/certificates.db "SELECT * FROM certificate_results;"
```

---

## 🔧 Troubleshooting

### Backend won't start
- Check if port 3001 is already in use: `lsof -i :3001`
- Kill any existing process: `kill -9 <PID>`

### Frontend won't start
- Check if port 5173 is already in use: `lsof -i :5173`
- Make sure you're in the `cert-ui` directory

### Can't login
- Make sure backend is running
- Check browser console for errors
- Clear cookies and try again

### API errors
- Make sure both backend and frontend are running
- Check backend terminal for error logs
- Check `logs/app.log` for detailed errors

---

## 📁 Project Structure

```
Certificate_Validation/
├── data/
│   └── certificates.db          ← SQLite database
├── logs/
│   └── app.log                  ← Backend logs
├── cert-ui/                     ← Frontend directory
│   ├── src/
│   │   ├── api.js              ← API client
│   │   ├── App.jsx             ← Main app
│   │   ├── AuthContext.jsx     ← Auth state
│   │   ├── components/
│   │   │   └── Layout.jsx      ← App layout
│   │   └── pages/
│   │       ├── Login.jsx       ← Login page
│   │       ├── Dashboard.jsx   ← Dashboard
│   │       └── Certificates.jsx ← Cert management
│   └── package.json
├── server.js                    ← Backend API server
├── cert-checker.js              ← Certificate checking
├── scheduler.js                 ← Auto-scheduling
├── notifications.js             ← Email/Teams alerts
├── db.js                        ← Database wrapper
└── package.json

```

---

## 🎉 You're All Set!

**Backend:** http://localhost:3001
**Frontend:** http://localhost:5173

**Login:** admin / admin123

Start adding certificates and monitoring SSL expiry dates!

---

## 📝 Next Steps

1. ✅ Add your first certificate via UI
2. ✅ Check it manually to see results
3. ✅ View results in database
4. Configure SMTP for email alerts (optional)
5. Add Teams webhook for Teams notifications (optional)
6. Change admin password for security

---

## 🆘 Need Help?

- Full technical design: [TechnicalDesign.md](TechnicalDesign.md)
- Backend setup: [SETUP.md](SETUP.md)
- Quick reference: [QUICK_START.md](QUICK_START.md)
