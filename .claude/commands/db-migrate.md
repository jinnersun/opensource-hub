---
name: db-migrate
description: Create and apply D1 database migrations for OpenSource-Hub.
allowed_tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
---

# /db-migrate

Create and apply a D1 database migration.

## Goal

Create a properly sequenced migration file and apply it to the D1 database.

## Steps

### 1. Determine Migration Number
```bash
ls migrations/*.sql | sort
```
Pick the next available sequence number.

### 2. Create Migration File
Create `migrations/{NNN}_{description}.sql` with:
- Header comment (description, date)
- DDL/DML statements
- All SQL using `?` parameter placeholders (if dynamic values needed, note in comments)

### 3. Review Against Existing Schema
Before writing SQL, check the current schema:
```bash
# Read relevant CREATE TABLE statements from existing migrations
grep -n "CREATE TABLE" migrations/*.sql
```

Refer to field reference:
- `raw_apps` PK: `github_repo_id` (INTEGER)
- `apps` PK: `id` (TEXT, `app_{repo_id}`)
- `apps_library` PK: `id` (INTEGER AUTOINCREMENT), UNIQUE `github_repo_id`
- Translation tables: `app_translations.app_id` ↔ `apps.id`; `apps_library_translations.library_id` ↔ `apps_library.id`

### 4. Apply Migration
```bash
cd web
wrangler d1 execute opensource-hub-db --file ../migrations/{NNN}_{description}.sql
```

### 5. Verify
```bash
wrangler d1 execute opensource-hub-db --command "PRAGMA table_info(table_name);"
```

## Common Files Touched
- `migrations/{NNN}_{description}.sql` (NEW)

## Rules
- Never use `SELECT *` — always list columns
- Always use parameterized queries with `?`
- Add `IF NOT EXISTS` for CREATE statements
- Consider backward compatibility before DROP operations
- Add indexes for new JOIN/FK columns
