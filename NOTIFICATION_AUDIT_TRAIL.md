# Notification Audit Trail Documentation

## Overview

The Certificate Monitor includes a comprehensive **Notification Audit Trail** system that logs every email and Teams message sent by the application. This ensures complete accountability - no one can claim they didn't receive an alert!

## Features

### 1. Complete Alert Logging
Every notification attempt is recorded with:
- **Certificate Information**: EAI Name, EAI Number, URL
- **Alert Type**: Email or Teams
- **Recipients/Webhook**: Full list of email addresses or Teams webhook URL
- **Status**: `sent` or `failed`
- **Timestamp**: Exact time the alert was sent
- **Error Message**: Full error details if the alert failed

### 2. Statistics Dashboard
The Alert Logs page displays real-time statistics for the last 7 days:
- **Total Sent**: All successful alerts across both channels
- **Total Failed**: All failed alerts across both channels
- **Email Alerts**: Sent vs Failed count for email notifications
- **Teams Alerts**: Sent vs Failed count for Teams notifications

### 3. Advanced Filtering
Filter alerts by:
- **Type**: Email or Teams
- **Status**: Sent or Failed
- **Combined**: Apply both filters simultaneously

### 4. Detailed Alert History
Each alert log entry shows:
- Certificate details (name, EAI number)
- Alert type with color-coded badge
- Full recipient list or webhook URL (with text overflow handling)
- Status badge (green for sent, red for failed)
- Timestamp with relative time (e.g., "2 hours ago")
- Error message for failed alerts

## Database Schema

### alert_logs Table
```sql
CREATE TABLE IF NOT EXISTS alert_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_id INTEGER NOT NULL,
    result_id INTEGER,
    alert_type TEXT NOT NULL CHECK(alert_type IN ('email', 'teams')),
    recipients TEXT,
    webhook_url TEXT,
    status TEXT NOT NULL CHECK(status IN ('sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    FOREIGN KEY (config_id) REFERENCES certificate_configs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alert_logs_config ON alert_logs(config_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_sent_at ON alert_logs(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_logs_status ON alert_logs(status);
```

## API Endpoints

### GET /api/alerts
Get all alert logs with optional filters.

**Query Parameters:**
- `status` (optional): Filter by status (`sent` or `failed`)
- `alert_type` (optional): Filter by type (`email` or `teams`)

**Response:**
```json
{
  "alerts": [
    {
      "id": 1,
      "config_id": 1,
      "eai_name": "Google",
      "eai_number": "EAI-001",
      "alert_type": "email",
      "recipients": "admin@example.com, ops@example.com",
      "webhook_url": null,
      "status": "sent",
      "error_message": null,
      "sent_at": "2025-10-08T14:30:00.000Z"
    }
  ]
}
```

### GET /api/certificates/:id/alerts
Get alert history for a specific certificate.

**Query Parameters:**
- `limit` (optional): Number of alerts to return (default: 50)

**Response:**
```json
{
  "alerts": [
    {
      "id": 1,
      "alert_type": "email",
      "recipients": "admin@example.com",
      "status": "sent",
      "sent_at": "2025-10-08T14:30:00.000Z"
    }
  ]
}
```

### GET /api/alerts/stats
Get alert statistics for the last 7 days.

**Response:**
```json
{
  "email": {
    "sent": 42,
    "failed": 3
  },
  "teams": {
    "sent": 38,
    "failed": 1
  },
  "total": {
    "sent": 80,
    "failed": 4
  }
}
```

## How It Works

### Backend Logging (notifications.js)
When `sendCertificateAlert()` is called:

1. **Email Alert Flow:**
   ```javascript
   if (config.email_recipients) {
     // Send email
     results.email = await sendEmail(config.email_recipients, subject, htmlBody);

     // Log to database
     await db.query(`
       INSERT INTO alert_logs
       (config_id, result_id, alert_type, recipients, webhook_url, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)
     `, [
       config.id,
       result.id || null,
       'email',
       config.email_recipients,
       null,
       results.email.success ? 'sent' : 'failed',
       results.email.error || null
     ]);
   }
   ```

2. **Teams Alert Flow:**
   ```javascript
   if (config.teams_webhook_url) {
     // Send Teams message
     results.teams = await sendTeamsMessage(config.teams_webhook_url, teamsCard);

     // Log to database
     await db.query(`
       INSERT INTO alert_logs
       (config_id, result_id, alert_type, recipients, webhook_url, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)
     `, [
       config.id,
       result.id || null,
       'teams',
       null,
       config.teams_webhook_url,
       results.teams.success ? 'sent' : 'failed',
       results.teams.error || null
     ]);
   }
   ```

### Frontend Display (Alerts.jsx)
The Alert Logs page provides:

1. **Real-time Statistics:**
   - Fetched on page load and filter changes
   - Displays last 7 days of activity
   - Separate counts for email and Teams

2. **Interactive Filters:**
   ```javascript
   const [statusFilter, setStatusFilter] = useState('');
   const [typeFilter, setTypeFilter] = useState('');

   useEffect(() => {
     loadData(); // Re-fetches when filters change
   }, [statusFilter, typeFilter]);
   ```

3. **Alert Table:**
   - Certificate name and EAI number
   - Alert type with icon (email or Teams)
   - Recipients/webhook (truncated if long)
   - Status badge (color-coded)
   - Timestamp (formatted and relative)
   - Error message (if failed)

## Access Control

- **All Users**: Can view alert logs
- **Admin Only**: Can modify system settings that affect notifications
- **Navigation**: Alert Logs link appears in main navigation for all authenticated users

## Benefits

1. **Accountability**: Complete audit trail of all notifications
2. **Troubleshooting**: Identify failed alerts and error messages
3. **Compliance**: Demonstrate notification attempts for security/compliance requirements
4. **Analytics**: Track notification success rates by channel
5. **Transparency**: Users can verify they received notifications

## Example Use Cases

### Verify Alert Delivery
1. Navigate to Alert Logs page
2. Search for specific certificate using filters
3. Check status column for successful delivery
4. View recipient list to confirm correct addresses

### Troubleshoot Failed Alerts
1. Filter by Status: "Failed"
2. Review error messages in the Error column
3. Identify common issues (SMTP errors, webhook timeouts, etc.)
4. Fix configuration in Settings or Certificate pages

### Generate Reports
1. Use API endpoints to fetch alert data
2. Filter by date range (last 7 days provided by stats)
3. Export data for compliance reporting
4. Analyze success rates by alert type

## Data Retention

Alert logs are subject to the same data retention policy as certificate results:
- Default: 30 days
- Configurable in System Settings
- Cleanup runs daily at 2:00 AM
- Alerts linked to deleted certificates are automatically removed (ON DELETE CASCADE)

## Future Enhancements

Potential improvements for the audit trail system:
- Date range selector (beyond last 7 days)
- Export to CSV/Excel
- Per-user alert preferences
- Alert acknowledgment tracking
- Scheduled reports via email
- Integration with external logging systems (Splunk, ELK, etc.)
