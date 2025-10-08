# 🚀 Quick Start - Certificate Monitor

## To Launch the Full Application:

### Terminal 1 - Backend:
```bash
cd /Users/arunlal/certificate_check/Certificate_Validation
npm start
```

### Terminal 2 - Frontend:
```bash
cd /Users/arunlal/certificate_check/Certificate_Validation/cert-ui
npm run dev
```

## Then:
- Open browser: **http://localhost:5173**
- Login: **admin** / **admin123**

---

## ✅ What Works Now:

1. **Add Certificates** - Click "Certificates" → "Add Certificate"
2. **Check Certificates** - Click "Check All Certificates" on Dashboard
3. **Real-time Monitoring** - Watch results stream in live
4. **View Database** - `sqlite3 ./data/certificates.db`

---

## 📝 To Add Your First Certificate:

1. Go to http://localhost:5173
2. Login with admin/admin123
3. Click "Certificates" in sidebar
4. Click "Add Certificate" button
5. Fill in:
   - EAI Number: `EAI-001`
   - EAI Name: `Test Certificate`
   - URL: `https://google.com`
   - Environment: `prod`
   - Check Frequency: `4` hours
   - Alert Threshold: `30` days
6. Click "Create"

✅ **Certificate is now in the database!**

Go to Dashboard → Click "Check All Certificates" to test it!

---

See [LAUNCH_GUIDE.md](LAUNCH_GUIDE.md) for complete details.
