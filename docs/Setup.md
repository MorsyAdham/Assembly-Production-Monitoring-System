# Assembly Production Monitoring System - Setup Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Database Configuration](#database-configuration)
4. [Application Configuration](#application-configuration)
5. [GitHub Pages Deployment](#github-pages-deployment)
6. [Initial User Setup](#initial-user-setup)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

1. **Web Browser**
   - Chrome 90+ (recommended)
   - Firefox 88+
   - Safari 14+
   - Edge 90+

2. **Code Editor** (optional, for customization)
   - VS Code (recommended)
   - Sublime Text
   - Any text editor

3. **Git** (for deployment)
   - Download from: https://git-scm.com/
   - Version 2.30+

4. **GitHub Account**
   - Sign up at: https://github.com/

5. **Supabase Account**
   - Sign up at: https://supabase.com/

### Required Skills

- Basic HTML/CSS/JavaScript knowledge (for customization)
- Basic command line usage
- Basic Git operations

---

## Supabase Setup

### Step 1: Create Supabase Project

1. Go to https://supabase.com/ and sign in
2. Click **"New Project"**
3. Fill in project details:
   - **Name**: `assembly-production`
   - **Database Password**: Generate a strong password (save this!)
   - **Region**: Select closest to your users (e.g., US East)
   - **Pricing Plan**: Free tier is sufficient for most use cases
4. Click **"Create new project"**
5. Wait 2-3 minutes for project initialization

### Step 2: Get Project Credentials

1. In your Supabase project dashboard, click **"Settings"** (gear icon)
2. Navigate to **"API"** section
3. Copy the following values:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

**Save these values securely - you'll need them later!**

### Step 3: Disable Row Level Security (RLS)

Since we're using custom authentication, we need to disable RLS:

1. In Supabase dashboard, go to **"Authentication"** → **"Policies"**
2. For each table (users, vehicles, stations, production_status, requests):
   - Click the table name
   - Ensure **"Enable RLS"** is OFF (unchecked)
3. Alternatively, we'll handle this in SQL during database setup

---

## Database Configuration

### Step 1: Access SQL Editor

1. In Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**

### Step 2: Run Database Schema

Copy the entire contents of `database/schema.sql` and paste into the SQL editor.

```sql
-- =====================================================
-- ASSEMBLY PRODUCTION MONITORING SYSTEM DATABASE SCHEMA
-- =====================================================

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ... (rest of schema.sql content)
```

Click **"Run"** button (or press `Ctrl+Enter`)

**Expected Output:**
```
Success. No rows returned.
```

### Step 3: Create First Master Admin User

You need to hash your password first. Use this online tool or the JavaScript console:

**Option A: Browser Console**

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Run this code (replace `your_password` with your desired password):

```javascript
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('Hashed password:', hashHex);
}

hashPassword('your_password');
```

4. Copy the output hash

**Option B: Online Tool**

1. Go to https://emn178.github.io/online-tools/sha256.html
2. Enter your password
3. Copy the SHA256 hash

**Step 4: Insert Master Admin**

Back in Supabase SQL Editor, run:

```sql
INSERT INTO users (username, password_hash, role)
VALUES ('admin', 'YOUR_HASHED_PASSWORD_HERE', 'master_admin');
```

Replace:
- `admin` with your desired username
- `YOUR_HASHED_PASSWORD_HERE` with the hash from Step 3

Click **"Run"**

### Step 5: Verify Database Setup

Run this query to verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected Output:**
```
production_status
requests
stations
users
vehicles
```

Run this query to verify your master admin user:

```sql
SELECT username, role FROM users;
```

**Expected Output:**
```
username  | role
----------|-------------
admin     | master_admin
```

### Step 6: Insert Sample Data (Optional)

For testing, you can insert sample vehicles and stations:

```sql
-- Insert sample vehicles
INSERT INTO vehicles (vehicle_type, vehicle_number) VALUES
('K9', 'K9-M1'),
('K9', 'K9-M2'),
('K10', 'K10-M1'),
('K11', 'K11-M1');

-- Insert production status for K9-M1
INSERT INTO production_status (vehicle_number, station_code, status) VALUES
('K9-M1', 'A01', 'completed'),
('K9-M1', 'A02', 'completed'),
('K9-M1', 'A03', 'in_progress'),
('K9-M1', 'A04', 'pending'),
('K9-M1', 'A05', 'pending'),
('K9-M1', 'A06', 'pending'),
('K9-M1', 'A07', 'pending'),
('K9-M1', 'A08', 'pending'),
('K9-M1', 'A09', 'pending'),
('K9-M1', 'A10', 'pending'),
('K9-M1', 'A11', 'pending');

-- Insert sample requests
INSERT INTO requests (
  vehicle_type, vehicle_number, station_code, 
  part_number, qty, request_type, fastener, 
  status, requested_by
) VALUES
('K9', 'K9-M1', 'A08', NULL, NULL, 'station', false, 'open', 'admin'),
('K9', 'K9-M2', 'A03', 'MS90727-59', 4, 'part', true, 'open', 'admin'),
('K10', 'K10-M1', 'A12', 'AN960-416', 8, 'part', true, 'delivered', 'admin');
```

---

## Application Configuration

### Step 1: Get Project Files

**Option A: Clone from GitHub** (if you've already deployed)

```bash
git clone https://github.com/YOUR_USERNAME/assembly-production-system.git
cd assembly-production-system
```

**Option B: Create New Project**

Create the following folder structure:

```
assembly-production-system/
├── index.html
├── login.html
├── assets/
│   ├── scripts/
│   │   └── app.js
│   ├── styles/
│   │   └── style.css
│   └── img/
│       └── logo.png
├── docs/
│   ├── Architecture.md
│   ├── Setup.md
│   └── README.md
└── database/
    └── schema.sql
```

### Step 2: Configure Supabase Connection

Open `assets/scripts/app.js` and find the configuration section at the top:

```javascript
// ==================== SUPABASE CONFIG ====================
const SUPABASE_URL = "YOUR_SUPABASE_URL_HERE";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";
```

Replace:
- `YOUR_SUPABASE_URL_HERE` with your Project URL from earlier
- `YOUR_SUPABASE_ANON_KEY_HERE` with your anon/public key from earlier

**Example:**

```javascript
const SUPABASE_URL = "https://biqwfqkuhebxcfucangt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpcXdmcWt1aGVieGNmdWNhbmd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODk5Mzk2OTksImV4cCI6MjAwNTUxNTY5OX0.abc123...";
```

### Step 3: Add Company Logo (Optional)

Place your company logo in `assets/img/logo.png`

**Recommended specs:**
- Format: PNG with transparency
- Size: 200x200 pixels
- Max file size: 100KB

If you don't have a logo, the system will work fine with a placeholder.

---

## GitHub Pages Deployment

### Step 1: Create GitHub Repository

1. Go to https://github.com/ and sign in
2. Click **"New repository"** (green button)
3. Fill in details:
   - **Repository name**: `assembly-production-system`
   - **Description**: Assembly Production Monitoring System
   - **Public** or **Private**: Your choice (must be Public for free GitHub Pages)
   - **Initialize with README**: Uncheck (we have our own)
4. Click **"Create repository"**

### Step 2: Push Code to GitHub

Open terminal in your project folder and run:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Commit files
git commit -m "Initial commit: Assembly Production System"

# Add remote repository (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/assembly-production-system.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **"Settings"** tab
3. Scroll down to **"Pages"** section (left sidebar)
4. Under **"Source"**:
   - Branch: `main`
   - Folder: `/ (root)`
5. Click **"Save"**
6. Wait 1-2 minutes for deployment

**Your site will be available at:**
```
https://YOUR_USERNAME.github.io/assembly-production-system/
```

### Step 4: Test Deployment

1. Open the URL from Step 3
2. You should see the login page
3. Log in with the master admin credentials you created earlier

---

## Initial User Setup

### Creating Additional Users

1. Log in as **master_admin**
2. You'll see a **"User Management"** section in the dashboard
3. Click **"Add New User"**
4. Fill in:
   - **Username**: Unique username
   - **Password**: Strong password (will be auto-hashed)
   - **Role**: Select appropriate role
     - `master_admin`: Full access + user management
     - `admin`: Full access, no user management
     - `viewer`: Read-only + exports
     - `customer`: Can create requests + view own requests
5. Click **"Add User"**

### Recommended Initial Setup

Create at least:
- 1 master_admin (you)
- 1 admin (for production manager)
- 1 viewer (for management)
- 1 customer (for assembly line workers)

---

## Testing

### Functional Tests

#### Test 1: Authentication

1. Log out if logged in
2. Try logging in with wrong password → Should show error
3. Log in with correct credentials → Should redirect to dashboard
4. Refresh page → Should stay logged in
5. Log out → Should redirect to login page

#### Test 2: Request Creation

1. Log in as **admin** or **customer**
2. Fill in request form:
   - **Vehicle Type**: K9
   - **Vehicle Number**: K9-M1
   - **Station**: A08
   - **Request Type**: Station
3. Click **"Create Request"**
4. Request should appear in table immediately
5. Check request_date is set automatically

#### Test 3: Status Updates (Admin Only)

1. Log in as **admin** or **master_admin**
2. Find an open request
3. Change status to **"Delivered"**
4. Click **"Update"**
5. delivery_date should be set automatically
6. Verify in table

#### Test 4: Data Export

1. Click **"Export to PDF"** button
2. PDF should download with all visible data
3. Click **"Export to Excel"** button
4. Excel file should download with multiple sheets

#### Test 5: Analytics

1. Verify charts are displaying
2. Check data matches table counts
3. Filter data and verify charts update

### Browser Testing

Test in multiple browsers:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Chrome Android)

### Role-Based Access Testing

Test each role:

**master_admin:**
- [ ] Can see User Management section
- [ ] Can add/edit/delete users
- [ ] Can create requests
- [ ] Can update request status
- [ ] Can export data

**admin:**
- [ ] Cannot see User Management section
- [ ] Can create requests
- [ ] Can update request status
- [ ] Can export data

**viewer:**
- [ ] Cannot create requests
- [ ] Cannot update request status
- [ ] Can view all data
- [ ] Can export data

**customer:**
- [ ] Can create requests
- [ ] Can only see own requests (filtered)
- [ ] Cannot update request status
- [ ] Limited export options

---

## Troubleshooting

### Issue: Login page shows "Invalid credentials" even with correct password

**Cause:** Password hash doesn't match

**Solution:**
1. Re-hash your password using the browser console method
2. Update the database:
   ```sql
   UPDATE users 
   SET password_hash = 'NEW_HASH_HERE' 
   WHERE username = 'admin';
   ```

### Issue: "Supabase client is not defined" error

**Cause:** Supabase SDK not loaded

**Solution:**
1. Check internet connection
2. Verify Supabase CDN URL in HTML:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.34.0/dist/supabase.min.js"></script>
   ```
3. Try different CDN version if needed

### Issue: GitHub Pages shows 404 error

**Cause:** Pages not enabled or incorrect branch

**Solution:**
1. Check Settings → Pages is configured correctly
2. Ensure files are in root of `main` branch
3. Wait 2-3 minutes after pushing
4. Clear browser cache

### Issue: Data not showing in dashboard

**Cause:** Database query failing or no data

**Solution:**
1. Open browser console (F12)
2. Check for errors
3. Verify Supabase URL and KEY are correct
4. Check database has data:
   ```sql
   SELECT COUNT(*) FROM requests;
   SELECT COUNT(*) FROM vehicles;
   ```

### Issue: Charts not displaying

**Cause:** Chart.js not loaded or data format issue

**Solution:**
1. Check browser console for errors
2. Verify Chart.js CDN:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
   ```
3. Ensure data arrays are not empty

### Issue: Excel export not working

**Cause:** SheetJS library not loaded

**Solution:**
1. Check if library is loaded in HTML:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
   ```
2. Check browser console for errors

### Issue: PDF export shows blank page

**Cause:** jsPDF library issue or no data

**Solution:**
1. Verify jsPDF and autoTable are loaded:
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
   <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js"></script>
   ```
2. Ensure tables have data before export

### Issue: "Access Denied" on certain actions

**Cause:** Insufficient permissions for user role

**Solution:**
1. Verify user role in database:
   ```sql
   SELECT username, role FROM users WHERE username = 'YOUR_USERNAME';
   ```
2. Check permission matrix in Architecture.md
3. Log in with correct role for the action

---

## Advanced Configuration

### Custom Domain Setup (Optional)

If you want to use a custom domain instead of GitHub Pages URL:

1. Purchase domain from registrar (GoDaddy, Namecheap, etc.)
2. In GitHub repository Settings → Pages:
   - Enter your custom domain
   - Click Save
3. In your domain registrar DNS settings:
   - Add CNAME record: `www` → `YOUR_USERNAME.github.io`
   - Add A records for apex domain:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
4. Wait 24-48 hours for DNS propagation
5. Enable HTTPS in GitHub Pages settings

### Environment-Specific Configurations

For development vs. production environments:

Create two versions of app.js:
- `app.dev.js` (development - points to test Supabase)
- `app.prod.js` (production - points to live Supabase)

Update HTML to load correct file based on domain.

### Backup Configuration

Set up automated backups:

1. **Database Backups:**
   - Use Supabase automatic backups (daily)
   - Set up manual backup schedule (weekly)
   - Export to CSV and store in cloud storage

2. **Code Backups:**
   - GitHub repository (automatic)
   - Tagged releases for major versions
   - Keep local backup of current version

---

## Maintenance Schedule

### Daily
- Monitor Supabase dashboard for errors
- Check user-reported issues

### Weekly
- Review access logs
- Verify backups completed successfully
- Check disk space usage

### Monthly
- Security patch review
- Performance analysis
- User access audit

### Quarterly
- Full system backup
- Capacity planning
- Feature usage analysis

---

## Support & Resources

### Documentation
- **Architecture**: See `docs/Architecture.md`
- **README**: See `docs/README.md`
- **This Guide**: `docs/Setup.md`

### External Resources
- **Supabase Docs**: https://supabase.com/docs
- **GitHub Pages Docs**: https://docs.github.com/pages
- **Chart.js Docs**: https://www.chartjs.org/docs

### Getting Help

1. Check this troubleshooting section first
2. Review error messages in browser console
3. Check Supabase logs in dashboard
4. Search GitHub Issues for similar problems
5. Create new GitHub Issue with:
   - Error message
   - Steps to reproduce
   - Browser and OS version
   - Screenshots if applicable

---

## Next Steps

After completing setup:

1. ✅ Create additional user accounts
2. ✅ Add vehicles to the system
3. ✅ Initialize production status for vehicles
4. ✅ Train users on the system
5. ✅ Create standard operating procedures (SOPs)
6. ✅ Set up regular backup schedule
7. ✅ Plan for system updates and maintenance

**Your Assembly Production Monitoring System is now ready to use!**