# Backup Guide

## Before Making Major Changes

### 1. Git Commit Current State
```bash
git add .
git commit -m "Backup before major changes"
```

### 2. Create Branch for Changes
```bash
git checkout -b feature/your-feature-name
```

### 3. Database Backup (if applicable)
- Export Supabase data if needed
- Save any environment variables

### 4. File Backup Checklist
- [ ] `package.json` - Dependencies
- [ ] Environment files (`.env*`)
- [ ] Database schema (`supabase/migrations/`)
- [ ] Custom configurations
- [ ] Important source files

## Recovery Process

### 1. Restore from Git
```bash
git checkout main
git reset --hard HEAD~1  # Go back one commit
```

### 2. Restore Dependencies
```bash
npm install
```

### 3. Restore Environment
- Copy environment variables
- Restart development server

## Emergency Contacts
- Repository: [Your Git Repository URL]
- Supabase Project: [Your Supabase Dashboard URL]
