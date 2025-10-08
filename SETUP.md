# Certificate Expiry Monitor - Setup Guide

## ✅ Backend Setup Complete!

The backend application has been successfully set up with all core features.

### What's Been Built

#### Core Files Created:
- `package.json` - Project dependencies and scripts
- `server.js` - Main Express server with all API endpoints
- `db.js` - SQLite database wrapper
- `schema-sqlite.sql` - Database schema
- `init-db.js` - Database initialization script
- `auth.js` - Authentication middleware
- `logger.js` - Logging utility
- `cert-checker.js` - SSL certificate checking service
- `notifications.js` - Email and Teams notification service
- `scheduler.js` - Automated certificate checking scheduler
- `data-retention.js` - Automated data cleanup service

#### Database Tables:
1. **users** - User accounts (admin/user/viewer roles)
2. **certificate_configs** - Certificate monitoring configurations
3. **certificate_results** - Historical check results
4. **system_settings** - System configuration

### Database Location

The SQLite database is located at:
```
./data/certificates.db
```

### How to Open/View the Database

#### Option 1: Using SQLite Command Line
```bash
# Install sqlite3 if not already installed
# macOS: already included
# Linux: sudo apt-get install sqlite3

# Open the database
sqlite3 ./data/certificates.db

# Once inside, you can run SQL commands:
.tables                           # List all tables
.schema                          # Show all table schemas
SELECT * FROM users;             # View users
SELECT * FROM certificate_configs; # View certificates
SELECT * FROM certificate_results; # View results
.quit                            # Exit
```

#### Option 2: Using DB Browser for SQLite (GUI)
1. Download from: https://sqlitebrowser.org/
2. Install the application
3. Open DB Browser for SQLite
4. Click "Open Database"
5. Navigate to `./data/certificates.db`
6. Browse tables, run queries, etc.

#### Option 3: Using VS Code Extension
1. Install "SQLite Viewer" or "SQLite" extension in VS Code
2. Right-click on `./data/certificates.db` in the file explorer
3. Select "Open Database"

#### Option 4: Using DBeaver (Universal Database Tool)
1. Download from: https://dbeaver.io/
2. Create new connection → SQLite
3. Point to `./data/certificates.db`

### Default Login Credentials

**Username:** admin
**Password:** admin123

⚠️ **Important:** Change this password immediately after first login!

### Starting the Application

#### Development Mode (with auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

The server will start on: http://localhost:3001

### API Endpoints Available

#### Authentication
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

#### Certificate Management
- `GET /api/certificates` - List all certificates
- `GET /api/certificates/:id` - Get single certificate
- `POST /api/certificates` - Create certificate config
- `PUT /api/certificates/:id` - Update certificate config
- `DELETE /api/certificates/:id` - Delete certificate config
- `POST /api/certificates/test-webhook` - Test Teams webhook

#### Certificate Checking (Real-time SSE)
- `GET /api/stream/certificates/check-all` - Check all certificates (streaming)
- `GET /api/stream/certificates/check/:id` - Check single certificate (streaming)

#### Results
- `GET /api/results` - Get results with filters
- `GET /api/results/latest` - Get latest result per certificate
- `GET /api/dashboard-stats` - Get summary statistics

#### User Management (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `DELETE /api/users/:id` - Delete user

#### System Settings (Admin only)
- `GET /api/settings` - Get all settings
- `PUT /api/settings/:key` - Update setting

### Automated Features

1. **Certificate Checker Scheduler**
   - Runs every 15 minutes
   - Checks certificates based on their individual check_frequency_hours setting
   - Sends alerts on Monday/Friday only
   - Prevents duplicate alerts (once per day per certificate)

2. **Data Retention Scheduler**
   - Runs daily at 2 AM
   - Cleans up old certificate results (default: 30 days)
   - Optimizes database after cleanup

### Environment Variables

Edit `.env` file to configure:
- `PORT` - Server port (default: 3001)
- `DB_PATH` - Database location
- `FRONTEND_URL` - Frontend URL for CORS
- `SMTP_*` - Email settings (when ready)

### Testing the API

You can test the API using curl:

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  -c cookies.txt

# Get certificates (using saved cookie)
curl http://localhost:3001/api/certificates \
  -b cookies.txt

# Create a certificate config
curl -X POST http://localhost:3001/api/certificates \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "eai_number": "EAI-001",
    "eai_name": "Production API",
    "url": "https://google.com",
    "environment": "prod",
    "alert_threshold_days": 30,
    "email_recipients": "team@example.com",
    "check_frequency_hours": 4
  }'
```

### Next Steps

1. **Start the backend server:**
   ```bash
   npm start
   ```

2. **Access the database** using any of the methods above

3. **Build the frontend** (React + Mantine + Tailwind):
   - Initialize React project with Vite
   - Install Mantine v8 and Tailwind CSS
   - Create login page
   - Create certificate management UI
   - Add real-time monitoring with SSE

4. **Configure SMTP** (when ready to send emails):
   - Update `.env` with SMTP credentials
   - Update `smtp.enabled` in system_settings table to 'true'

### Troubleshooting

**Database locked error:**
- Close any open connections to the database
- Restart the server

**Port already in use:**
- Change PORT in `.env` file
- Or stop the process using port 3001

**Authentication errors:**
- Make sure to save and send cookies with requests
- Check that session hasn't expired (24 hours)

### File Structure

```
Certificate_Validation/
├── data/
│   └── certificates.db          # SQLite database
├── logs/
│   └── app.log                  # Application logs
├── node_modules/                # Dependencies
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── package.json                 # Project metadata
├── server.js                    # Main server
├── db.js                        # Database wrapper
├── schema-sqlite.sql            # Database schema
├── init-db.js                   # Database initialization
├── auth.js                      # Authentication
├── logger.js                    # Logging utility
├── cert-checker.js              # Certificate checking
├── notifications.js             # Notifications (email/Teams)
├── scheduler.js                 # Automated checking
├── data-retention.js            # Data cleanup
├── README.md                    # Project overview
├── TechnicalDesign.md           # Full technical design
└── SETUP.md                     # This file
```

## 🎉 You're all set!

The backend is ready to use. Start the server and begin monitoring certificates!
