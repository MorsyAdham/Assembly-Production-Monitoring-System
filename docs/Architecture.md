# Assembly Production Monitoring System - Architecture

## System Overview

The Assembly Production Monitoring System is a web-based application designed to track and manage assembly line production for K9, K10, and K11 vehicle types. The system provides real-time monitoring, request management, analytics, and role-based access control.

## Technology Stack

### Frontend
- **HTML5**: Semantic markup for structure
- **CSS3**: Custom styling with modern features (Grid, Flexbox, CSS Variables)
- **Vanilla JavaScript (ES6+)**: Application logic and interactivity
- **Chart.js**: Data visualization and analytics
- **jsPDF + autoTable**: PDF report generation
- **SheetJS (xlsx)**: Excel export functionality

### Backend
- **Supabase**: PostgreSQL database with REST API
  - Real-time subscriptions for live updates
  - Row Level Security (RLS) disabled - using custom auth
  - RESTful API endpoints

### Hosting
- **GitHub Pages**: Static file hosting
- **Supabase Cloud**: Backend database and API

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│     │  login.html  │  │  index.html  │  │   Reports    │     │
│     │   (Auth UI)  │  │  (Dashboard) │  │  (Exports)   │     │
│     └──────────────┘  └──────────────┘  └──────────────┘     │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                     Application Layer (app.js)               │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  Authentication Module                               │   │
│   │  - Custom session management                         │   │
│   │  - SHA-256 password hashing                          │   │
│   │  - Role-based access control                         │   │
│   └──────────────────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  Data Management Module                              │   │
│   │  - Vehicle tracking                                  │   │
│   │  - Station progress monitoring                       │   │
│   │  - Request management                                │   │
│   └──────────────────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  Analytics & Reporting Module                        │   │
│   │  - Chart generation                                  │   │
│   │  - PDF export                                        │   │
│   │  - Excel export                                      │   │
│   └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ Supabase Client SDK
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                       Supabase Backend                       │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  PostgreSQL Database                                 │   │
│   │  - users                                             │   │
│   │  - vehicles                                          │   │
│   │  - stations                                          │   │
│   │  - production_status                                 │   │
│   │  - requests                                          │   │
│   └──────────────────────────────────────────────────────┘   │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  Database Functions & Triggers                       │   │
│   │  - Auto delivery date setter                         │   │
│   │  - Timestamp management                              │   │
│   └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

## Database Schema

### Tables

#### 1. `users`
Manages user authentication and authorization.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| username | TEXT | Unique username |
| password_hash | TEXT | SHA-256 hashed password |
| role | TEXT | User role (master_admin, admin, viewer, customer) |
| created_at | TIMESTAMP | Account creation timestamp |

**Indexes:**
- `idx_users_username` on username for fast login lookups

#### 2. `vehicles`
Tracks individual vehicles in production.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vehicle_type | TEXT | K9, K10, or K11 |
| vehicle_number | TEXT | Unique identifier (e.g., K9-M1) |
| created_at | TIMESTAMP | Vehicle creation timestamp |

**Indexes:**
- `idx_vehicle_type` for filtering by type

#### 3. `stations`
Template stations for each vehicle type.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vehicle_type | TEXT | K9, K10, or K11 |
| station_code | TEXT | Station identifier (A01-A16) |

**Unique Constraint:** (vehicle_type, station_code)

**Station Configuration:**
- **K9**: A01 through A11 (11 stations)
- **K10**: A01, A12 through A16 (6 stations)
- **K11**: A01, A12 through A16 (6 stations)

#### 4. `production_status`
Tracks production progress for each vehicle at each station.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vehicle_number | TEXT | Foreign key to vehicles |
| station_code | TEXT | Station identifier |
| status | TEXT | pending, in_progress, or completed |
| updated_at | TIMESTAMP | Last update timestamp |

**Indexes:**
- `idx_prod_vehicle` for vehicle lookups
- `idx_prod_status` for status filtering

#### 5. `requests`
Manages station and part requests.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| vehicle_type | TEXT | K9, K10, or K11 |
| vehicle_number | TEXT | Foreign key to vehicles |
| station_code | TEXT | Station identifier |
| part_number | TEXT | Part number (for part requests) |
| qty | INTEGER | Quantity requested |
| request_type | TEXT | 'station' or 'part' |
| fastener | BOOLEAN | Is this a fastener request? |
| request_date | TIMESTAMP | Auto-generated on creation |
| delivery_date | TIMESTAMP | Auto-set when status changes to delivered |
| status | TEXT | 'open' or 'delivered' |
| requested_by | TEXT | Username of requester |

**Indexes:**
- `idx_requests_status` for status filtering
- `idx_requests_vehicle` for vehicle lookups
- `idx_requests_date` for date-based queries

**Trigger:** `trigger_set_delivery_date` automatically sets delivery_date when status changes to 'delivered'

## Access Control Model

### Role Hierarchy

```
master_admin (Level 4)
    │
    ├─ Full system access
    ├─ User management (CRUD)
    ├─ Password management
    ├─ All data operations
    └─ All reports
         │
         ▼
    admin (Level 3)
         │
         ├─ All data operations
         ├─ Request management
         ├─ Status updates
         ├─ All reports
         └─ NO user management
              │
              ▼
         customer (Level 2)
              │
              ├─ Create requests
              ├─ View own requests
              ├─ View production status
              └─ Limited exports
                   │
                   ▼
              viewer (Level 1)
                   │
                   ├─ Read-only access
                   ├─ View all data
                   └─ Export reports
```

### Permission Matrix

| Feature | Master Admin | Admin | Customer | Viewer |
|---------|--------------|-------|----------|--------|
| View Dashboard | ✓ | ✓ | ✓ | ✓ |
| View Production Status | ✓ | ✓ | ✓ | ✓ |
| View Requests | ✓ | ✓ | Own Only | ✓ |
| Create Request | ✓ | ✓ | ✓ | ✗ |
| Update Request Status | ✓ | ✓ | ✗ | ✗ |
| Delete Request | ✓ | ✓ | ✗ | ✗ |
| Create Vehicle | ✓ | ✓ | ✗ | ✗ |
| Update Production Status | ✓ | ✓ | ✗ | ✗ |
| Export Reports | ✓ | ✓ | Limited | ✓ |
| Manage Users | ✓ | ✗ | ✗ | ✗ |
| Change Passwords | ✓ | ✗ | ✗ | ✗ |

## Security Architecture

### Authentication Flow

1. **Login Process:**
   ```
   User enters credentials
   → Hash password with SHA-256
   → Query database for matching user
   → Validate credentials
   → Store session in sessionStorage
   → Redirect to dashboard
   ```

2. **Session Management:**
   - Session data stored in `sessionStorage` (cleared on browser close)
   - No tokens - simple username/role storage
   - Session validated on each page load
   - Auto-redirect if not authenticated

3. **Password Security:**
   - Passwords hashed using SHA-256 before storage
   - Never transmitted or stored in plain text
   - Password changes require re-hashing

### Security Considerations

**Strengths:**
- Password hashing prevents plain-text exposure
- Session-based authentication
- Role-based authorization
- Server-side data validation via Supabase

**Limitations (Acknowledged Trade-offs):**
- Client-side session storage (vulnerable to XSS)
- No refresh tokens or JWT
- No HTTPS enforcement on static hosting
- SHA-256 is not ideal for passwords (bcrypt would be better, but requires server-side)

**Mitigation:**
- Use HTTPS URLs only
- Content Security Policy headers (via GitHub Pages)
- Regular security audits
- User education on strong passwords

## Data Flow

### Request Creation Flow

```
User creates request
    ↓
Validate form data (client-side)
    ↓
Get current user from session
    ↓
Build request object
    ↓
POST to Supabase /requests
    ↓
Database trigger sets request_date
    ↓
Return success/error
    ↓
Update UI with new request
    ↓
Refresh analytics
```

### Status Update Flow

```
Admin/Master Admin updates status
    ↓
Validate permissions
    ↓
PATCH to Supabase /requests
    ↓
If status = 'delivered': trigger sets delivery_date
    ↓
If production_status: update timestamp
    ↓
Return success/error
    ↓
Update UI
    ↓
Refresh analytics
```

## Analytics & Reporting

### Chart Types

1. **Production Status by Vehicle Type**
   - Bar chart showing completed vs. pending stations
   - Grouped by K9, K10, K11

2. **Request Timeline**
   - Line chart showing requests over time
   - Separate lines for open vs. delivered

3. **Request Type Distribution**
   - Pie chart showing station vs. part requests
   - Fastener vs. non-fastener breakdown

4. **Completion Rate**
   - Gauge chart showing overall completion percentage
   - Per vehicle type breakdown

5. **Average Delivery Time**
   - Bar chart showing avg time from request to delivery
   - Grouped by request type

### Export Formats

1. **PDF Reports**
   - Includes all charts
   - Tabular data
   - Filters applied
   - Timestamp and user info

2. **Excel Export**
   - Raw data export
   - Multiple sheets (requests, vehicles, production status)
   - Formatted headers
   - Filter-friendly

3. **CSV Export**
   - Simple comma-separated values
   - For specific tables
   - Easy import to other systems

## Performance Optimization

### Frontend

1. **Lazy Loading**
   - Charts only render when data is available
   - Images lazy-loaded

2. **Debouncing**
   - Search inputs debounced (300ms)
   - Filter changes debounced

3. **Caching**
   - Session data cached in memory
   - Supabase client reused

4. **Efficient Rendering**
   - Minimal DOM manipulation
   - Event delegation where possible
   - Virtual scrolling for large tables (if needed)

### Backend

1. **Indexing**
   - All foreign keys indexed
   - Common query patterns indexed

2. **Query Optimization**
   - Select only needed columns
   - Use `.single()` for single-record queries
   - Batch operations where possible

3. **Data Limits**
   - Pagination for large datasets
   - Date range filters on requests

## Scalability Considerations

### Current Capacity

- **Users**: Up to 100 concurrent users
- **Vehicles**: Unlimited (practical limit ~1000)
- **Requests**: Up to 10,000 active requests
- **Response Time**: < 1 second for most operations

### Future Enhancements

1. **Backend Improvements**
   - Move to Supabase Edge Functions for complex operations
   - Implement proper JWT-based authentication
   - Add rate limiting

2. **Frontend Enhancements**
   - Progressive Web App (PWA) support
   - Offline mode with service workers
   - Real-time updates with Supabase subscriptions

3. **Features**
   - Advanced analytics (predictive models)
   - Mobile app (React Native)
   - Integration with ERP systems
   - Barcode scanning for parts

## Deployment Architecture

### GitHub Pages Setup

```
Repository: assembly-production-system
Branch: main
    │
    ├── index.html
    ├── login.html
    ├── assets/
    │   ├── scripts/app.js
    │   ├── styles/style.css
    │   └── img/logo.png
    └── docs/ (documentation)

GitHub Actions: (optional)
    - Auto-deploy on push to main
    - Run tests
    - Minify assets
```

### Supabase Setup

```
Project: assembly-production
Region: US East (or closest to users)
    │
    ├── Database: PostgreSQL 15
    ├── API: Auto-generated REST endpoints
    ├── Storage: (for future file uploads)
    └── Realtime: (for future live updates)
```

## Error Handling Strategy

### Client-Side

1. **Form Validation**
   - Required field checks
   - Data type validation
   - Range validation

2. **API Error Handling**
   - Try-catch blocks around all API calls
   - User-friendly error messages
   - Fallback UI states

3. **Network Errors**
   - Retry logic (3 attempts)
   - Offline detection
   - Queue for offline actions (future)

### Server-Side

1. **Database Constraints**
   - CHECK constraints on enums
   - NOT NULL constraints
   - UNIQUE constraints
   - Foreign key constraints

2. **Triggers**
   - Error handling in PL/pgSQL functions
   - Validation before insert/update

## Monitoring & Logging

### Client-Side Logging

```javascript
// Log levels: INFO, WARN, ERROR
console.log('[INFO] User logged in:', username);
console.warn('[WARN] Slow query detected');
console.error('[ERROR] Failed to fetch requests:', error);
```

### Server-Side Monitoring

- Supabase Dashboard: Query performance
- Database logs: Error tracking
- API logs: Request/response tracking

## Maintenance & Updates

### Regular Tasks

1. **Weekly**
   - Review error logs
   - Check disk space
   - Monitor active users

2. **Monthly**
   - Database backup verification
   - Security patch review
   - Performance analysis

3. **Quarterly**
   - User access audit
   - Feature usage analysis
   - Capacity planning

### Update Process

1. Test changes locally
2. Deploy to staging (separate Supabase project)
3. User acceptance testing
4. Deploy to production
5. Monitor for issues
6. Rollback if needed

## Compliance & Best Practices

### Code Standards

- ES6+ JavaScript
- Semantic HTML5
- BEM CSS methodology (optional)
- JSDoc comments for functions
- Consistent naming conventions

### Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader compatible
- High contrast mode support
- Responsive design (mobile-first)

### Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Android)

## Disaster Recovery

### Backup Strategy

1. **Database Backups**
   - Supabase automatic daily backups
   - Manual backup before major changes
   - Export critical data weekly

2. **Code Backups**
   - GitHub repository (version control)
   - Tagged releases for stable versions

### Recovery Procedures

1. **Database Corruption**
   - Restore from latest Supabase backup
   - Verify data integrity
   - Notify users of downtime

2. **Code Issues**
   - Revert to previous Git commit
   - Redeploy to GitHub Pages
   - Clear browser caches

3. **Data Loss**
   - Restore from backup
   - Reconcile with user logs
   - Document incident

## Conclusion

This architecture provides a solid foundation for an Assembly Production Monitoring System with room for growth. The modular design allows for incremental improvements while maintaining system stability. The use of modern web technologies and cloud services ensures reliability, scalability, and maintainability.