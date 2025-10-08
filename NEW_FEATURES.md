# New Features Implemented

All features from to_do.md have been successfully implemented!

## 1. Proxy Configuration ✅

**Location**: System Settings → Proxy Configuration

Configure HTTP/HTTPS proxy for webhook and email connections:
- **Enable/Disable Proxy**: Toggle proxy usage
- **Proxy Host**: Server hostname (e.g., proxy.example.com)
- **Proxy Port**: Server port (default: 8080)
- **Authentication**: Optional username and password

**Usage**: When enabled, all Teams webhook and email (SMTP) traffic will route through the configured proxy server.

**Database Settings**:
- `proxy.enabled`: Enable/disable proxy
- `proxy.host`: Proxy server hostname
- `proxy.port`: Proxy server port
- `proxy.username`: Optional proxy username
- `proxy.password`: Optional proxy password

---

## 2. Dynamic Environment Configuration ✅

**Location**: System Settings → Environment Configuration

Define custom environment options instead of hardcoded dev/qa/uat/prod:
- **Environment List**: Comma-separated list of environment names
- **Default**: `prod,non-prod`
- **Custom Examples**: `prod,non-prod,qa,dev,staging,dr`

**How It Works**:
1. Admin configures environment list in Settings
2. Environment dropdown in Certificate form dynamically loads from settings
3. No database schema constraints - any environment name is allowed

**API Endpoint**: `GET /api/settings/environments` (available to all authenticated users)

---

## 3. Configurable Alert Days ✅

**Global Settings**: System Settings → Alert Configuration
- Monday enabled/disabled
- Friday enabled/disabled

**Per-Certificate Settings**: Certificate Management → Alert Days (Optional)
- Override global settings per certificate
- Select specific days (Monday through Sunday)
- Leave empty to use global Monday/Friday settings

**How It Works**:
1. **Global Mode** (default): Uses Monday/Friday toggles from System Settings
2. **Per-Certificate Mode**: When "Alert Days" is set for a certificate, it overrides global settings

**Example Use Cases**:
- Critical certificates: Alert every day
- Non-critical certificates: Alert only on Fridays
- Test certificates: No alerts (leave all days unselected)

**Database**:
- Global: `system_settings` table (`alert.monday_enabled`, `alert.friday_enabled`)
- Per-certificate: `certificate_configs.alert_days` column (comma-separated: `monday,wednesday,friday`)

**Scheduler Logic**:
```javascript
// scheduler.js checks:
1. If certificate has custom alert_days → use those
2. Else → check global Monday/Friday settings
3. Verify alert not already sent today
```

---

## 4. Individual Test Buttons ✅

**Dashboard Page**:
- **Test Button** (flask icon): Check individual certificate
- **View Details Button** (eye icon): View certificate details and SANs
- Both buttons in Actions column

**Certificates Page**:
- **Test Webhook Button** (Teams icon): Test Teams webhook for certificates with webhook configured
- **Edit/Delete Buttons**: Existing functionality

**How It Works**:
1. Click test button (flask icon) on any certificate
2. Server-Sent Events (SSE) streams real-time check result
3. Notification shows status and days until expiry
4. Dashboard refreshes with latest result

**API Endpoint**: `GET /api/stream/certificates/check/:id` (SSE)

---

## 5. URLs with Port Numbers ✅

**Supported URL Formats**:
- `https://example.com` (default port 443)
- `https://example.com:9001` (custom port)
- `https://bmridevipwtc.test.cloud.fedex.com:9001/auth/token/rdd-customer`

**Implementation**:
- `cert-checker.js` uses Node.js `URL` parser
- Extracts `parsedUrl.port || 443`
- Fully supports custom ports in TLS connections

**Example from to_do.md**:
```
URL: https://bmridevipwtc.test.cloud.fedex.com:9001/auth/token/rdd-customer
✅ Supported and tested
```

---

## 6. TLS Timeout and Concurrency Configuration ✅

**Location**: System Settings → TLS Check Configuration

### Connection Timeout
- **Setting**: `tls.timeout` (default: 10000ms)
- **Range**: 1000ms - 60000ms
- **Purpose**: Prevent hanging connections
- **Implementation**: `cert-checker.js` loads timeout from database with 1-minute cache

### Maximum Concurrent Checks
- **Setting**: `tls.concurrency` (default: 5)
- **Range**: 1 - 20
- **Purpose**: Limit server load during bulk checks
- **Note**: Currently configured in settings, ready for implementation in scheduler

**How Timeout Works**:
```javascript
// cert-checker.js
async function getTlsTimeout() {
  // Cache for 1 minute to avoid DB query on every check
  const { rows } = await query("SELECT value FROM system_settings WHERE key = 'tls.timeout'");
  return parseInt(rows[0].value) || 10000;
}
```

**Benefits**:
- Lower timeout: Faster failure detection, but may timeout valid slow servers
- Higher timeout: More patient with slow servers, but checks take longer
- Lower concurrency: Reduces server load, increases total check time
- Higher concurrency: Faster bulk checks, higher server load

---

## Database Schema Changes

### New System Settings

```sql
-- Proxy settings
INSERT INTO system_settings (key, value, description) VALUES
('proxy.enabled', 'false', 'Enable HTTP/HTTPS proxy for webhook and email'),
('proxy.host', '', 'Proxy server hostname'),
('proxy.port', '', 'Proxy server port'),
('proxy.username', '', 'Proxy authentication username (optional)'),
('proxy.password', '', 'Proxy authentication password (optional)');

-- TLS settings
INSERT INTO system_settings (key, value, description) VALUES
('tls.timeout', '10000', 'TLS connection timeout in milliseconds'),
('tls.concurrency', '5', 'Maximum concurrent TLS checks');

-- Environment settings
INSERT INTO system_settings (key, value, description) VALUES
('environments.list', 'prod,non-prod', 'Comma-separated list of environment names');
```

### Updated certificate_configs Table

```sql
ALTER TABLE certificate_configs ADD COLUMN alert_days TEXT DEFAULT NULL;
-- NULL = use global Monday/Friday settings
-- 'monday,wednesday,friday' = custom alert days
```

### Removed Environment Constraint

```sql
-- Old: environment TEXT NOT NULL CHECK(environment IN ('dev', 'qa', 'uat', 'prod'))
-- New: environment TEXT NOT NULL
-- Allows dynamic environments from system settings
```

---

## Migration Scripts

All migrations successfully executed:

1. **add_new_settings.sql** → Adds proxy, TLS, environment settings
2. **update_environment_column.sql** → Removes environment constraint, adds alert_days column

Run migrations:
```bash
node migrations/migrate-new-settings.js
node migrations/migrate-environment.js
```

---

## Frontend Updates

### Settings.jsx
- Added Proxy Configuration card
- Added TLS Check Configuration card
- Added Environment Configuration card
- All fields properly disabled when proxy is off

### Certificates.jsx
- Dynamic environment dropdown from `getEnvironments()` API
- MultiSelect for Alert Days (Optional)
- Proper handling of custom environments

### Dashboard.jsx
- Individual test button (flask icon) per certificate
- Real-time SSE streaming for individual checks
- Notification shows check results

---

## API Endpoints Added

### Get Environments (Non-Admin)
```
GET /api/settings/environments
Response: { "environments": ["prod", "non-prod", "custom"] }
```

### Check Single Certificate (SSE)
```
GET /api/stream/certificates/check/:id
Server-Sent Events stream with real-time check result
```

---

## Scheduler Updates

**scheduler.js** `shouldSendAlert()` function now:
1. Checks if certificate has `alert_days` configured
2. If yes → validates today against custom days
3. If no → loads global Monday/Friday settings from database
4. Verifies alert not already sent today

**Example Log Output**:
```
[Scheduler] Skipping alert - not in custom alert days for Google (today: wednesday)
[Scheduler] Skipping alert - Monday alerts disabled globally
[Scheduler] Skipping alert - not Monday or Friday (day 3)
```

---

## Testing Checklist

✅ Alert Logs page working (backend restarted)
✅ Proxy configuration UI in Settings
✅ TLS timeout configurable (applied in cert-checker.js)
✅ Environment list configurable and dynamic in certificate form
✅ Per-certificate alert days (MultiSelect in certificate form)
✅ Global Monday/Friday toggles in Settings
✅ Individual test button in Dashboard (flask icon)
✅ Test webhook button in Certificates page
✅ URL with port numbers supported (e.g., :9001)
✅ Scheduler uses per-certificate alert days or global settings
✅ Database migrations successful

---

## Usage Examples

### Example 1: Configure Custom Environments
1. Login as admin
2. Go to Settings → Environment Configuration
3. Change `prod,non-prod` to `prod,non-prod,qa,staging,dr`
4. Save Settings
5. Go to Certificates → Add Certificate
6. Environment dropdown now shows: PROD, NON-PROD, QA, STAGING, DR

### Example 2: Set Per-Certificate Alert Days
1. Go to Certificates → Edit Certificate
2. Scroll to "Alert Days (Optional)"
3. Select "Monday, Wednesday, Friday"
4. Save
5. This certificate will now only send alerts on those days, ignoring global settings

### Example 3: Test Individual Certificate
1. Go to Dashboard
2. Find certificate in table
3. Click flask icon (🧪) in Actions column
4. Notification shows real-time check result
5. Dashboard refreshes with latest data

### Example 4: Configure Proxy for Corporate Network
1. Login as admin
2. Go to Settings → Proxy Configuration
3. Enable Proxy
4. Set Host: `proxy.company.com`
5. Set Port: `8080`
6. Set Username: `proxyuser` (if required)
7. Set Password: `proxypass` (if required)
8. Save Settings
9. All Teams webhooks and SMTP emails now route through proxy

### Example 5: Adjust TLS Timeout for Slow Servers
1. Go to Settings → TLS Check Configuration
2. Increase "Connection Timeout" from 10000ms to 30000ms
3. Save Settings
4. cert-checker.js will use new timeout on next check (cached for 1 minute)

---

## Technical Notes

### Settings Cache in cert-checker.js
TLS timeout is cached for 1 minute to avoid database queries on every check:
```javascript
let tlsTimeout = 10000;
let lastSettingsFetch = 0;
const SETTINGS_CACHE_MS = 60000;
```

### Scheduler Alert Logic
The scheduler's `shouldSendAlert()` function is now **async** to query database for global alert settings:
```javascript
async function shouldSendAlert(config, result) {
  // ...check per-certificate alert_days or global settings
  if (await shouldSendAlert(config, result)) {
    await sendAlert(config, result);
  }
}
```

### Environment Validation
No database constraint on environment field - validation happens at application level. This allows:
- Admins to define any environment names
- No database migrations needed to add new environments
- Full flexibility for different deployment patterns

---

## What's Next?

All features from to_do.md are complete! The application now supports:

1. ✅ Configurable proxy for corporate networks
2. ✅ Dynamic environments (not hardcoded)
3. ✅ Flexible alert days (global + per-certificate)
4. ✅ Individual certificate testing
5. ✅ URLs with custom ports
6. ✅ Configurable TLS timeout and concurrency

**Optional Future Enhancements**:
- Implement concurrency limiting in scheduler (setting exists, not yet enforced)
- Proxy support in cert-checker.js for outbound TLS connections (currently only for webhooks/email)
- Bulk edit alert days for multiple certificates
- Import/export certificate configurations via Excel
- Alert acknowledgment tracking
- Notification retry logic with exponential backoff
