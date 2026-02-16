# Assembly Production Monitoring System

A comprehensive web-based system for monitoring and managing assembly line production for K9, K10, and K11 vehicle types.

## 🚀 Quick Start

### 1. Setup Supabase

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run `database/schema.sql` in SQL Editor
4. Copy Project URL and anon key

### 2. Configure Application

Edit `assets/scripts/app.js`:

```javascript
const SUPABASE_URL = "YOUR_SUPABASE_URL_HERE";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";
```

### 3. Deploy to GitHub Pages

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/assembly-production-system.git
git push -u origin main
```

Enable Pages in repository settings → Pages → Source: main branch

### 4. Login
Default credentials:
- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Change password immediately after first login!**

## 📚 Documentation

- **[Complete Setup Guide](docs/Setup.md)** - Detailed installation instructions
- **[Architecture](docs/Architecture.md)** - System design and technical details
- **[User Guide](docs/README.md)** - Features and usage instructions

## ✨ Features

- ✅ 4-tier role-based access control
- ✅ Real-time production monitoring
- ✅ Request management (station & parts)
- ✅ Interactive analytics dashboard
- ✅ PDF & Excel export
- ✅ Responsive design

## 📁 Project Structure

```
assembly-production-system/
├── index.html                 # Main dashboard
├── login.html                 # Login page
├── assets/
│   ├── scripts/
│   │   └── app.js            # Application logic
│   ├── styles/
│   │   └── style.css         # Styling
│   └── img/
│       └── logo.png          # Company logo (add yours)
├── database/
│   └── schema.sql            # Database schema
└── docs/
    ├── Architecture.md       # Technical documentation
    ├── Setup.md              # Setup guide
    └── README.md             # User guide
```

## 🔧 Tech Stack

- HTML5, CSS3, Vanilla JavaScript
- Supabase (PostgreSQL)
- Chart.js, jsPDF, SheetJS
- GitHub Pages

## 📄 License

MIT License - see LICENSE file

## 👥 Support

For issues and questions, see the [Setup Guide](docs/Setup.md) troubleshooting section.

---

**Version**: 1.0.0  
**Last Updated**: February 14, 2026  
**Authour**: Adham Morsy