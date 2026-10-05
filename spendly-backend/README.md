# Spendly backend

The API uses Node.js 18.11+, Express, MySQL, bcrypt password hashing, and seven-day JWTs. It serves the single-file frontend from a local static server; do not open `index.html` directly with `file://`.

## Setup on Windows / PowerShell

1. Install Node.js 18.11+ and MySQL Server 8.4 LTS using the official MySQL Community installer. Start the MySQL Server service, then open PowerShell in `spendly-backend`. The MySQL client can also be run from `C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe` if it is not on `PATH`.
2. Install packages and create your local environment file:

   ```powershell
   npm.cmd install
   Copy-Item .env.example .env
   ```

3. In MySQL, create the database, application user, and grant access. Replace the sample password with your own secure value:

   ```powershell
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS spendly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER IF NOT EXISTS 'spendly_user'@'localhost' IDENTIFIED BY 'replace_with_a_strong_password'; GRANT ALL PRIVILEGES ON spendly.* TO 'spendly_user'@'localhost';"
   ```

4. Create the database tables without dropping existing data:

   ```powershell
   cmd /c "mysql -u root -p spendly < schema.sql"
   ```

   If `mysql` is not recognized after installing MySQL, first verify the default client path exists (`C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe`). If it does, either invoke that executable by its full path or add that `bin` directory to your user `Path` in Windows Environment Variables, then open a new terminal. Do not change machine-wide settings unless required.

5. Edit `.env`: set `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `PORT`. Replace `JWT_SECRET` with a unique random secret of at least 32 characters. For example, generate one with:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   `FRONTEND_ORIGIN` should match the exact origin from which you serve `index.html` (the default is `http://127.0.0.1:5500`). To enable Spendly AI and bill-photo classification, set `ANTHROPIC_API_KEY` to your own Anthropic API key in this backend-only `.env`. Without it, the rest of the app works and AI endpoints return HTTP 503; there is no fake/offline AI fallback. Keep `.env` private; it is excluded by `.gitignore`.

6. Start the API:

   ```powershell
   npm.cmd start
   ```

   In another PowerShell window, check it with:

   ```powershell
   Invoke-RestMethod http://localhost:3000/api/health
   ```

7. From the project root, serve the frontend with VS Code Live Server (port 5500) or another static server on an allowed origin. The `.vscode/launch.json` browser configuration expects `http://127.0.0.1:5500/index.html`. Open the served page, create an account, and sign in.

## API smoke test

Run these commands in PowerShell while the API is running. Use a new email address:

```powershell
$auth = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/auth/register `
  -ContentType 'application/json' `
  -Body (@{ name = 'Test User'; email = 'test@example.com'; password = 'a-long-test-password'; avatar = 'female' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($auth.token)" }
$expense = Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/expenses `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ desc = 'Coffee'; amt = 4.5; cat = '☕ Beverages'; date = (Get-Date -Format 'yyyy-MM-dd'); notes = ''; recurring = $false } | ConvertTo-Json)
Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/expenses -Headers $headers
Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/expenses/$($expense.expense.id)" `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ desc = 'Coffee'; amt = 5; cat = '☕ Beverages'; date = (Get-Date -Format 'yyyy-MM-dd'); notes = 'Updated'; recurring = $false } | ConvertTo-Json)
Invoke-RestMethod -Method Get -Uri http://localhost:3000/api/user/settings -Headers $headers
Invoke-RestMethod -Method Put -Uri http://localhost:3000/api/user/settings `
  -Headers $headers -ContentType 'application/json' `
  -Body (@{ budget = 300; income = 2000; currency = '$' } | ConvertTo-Json)
Invoke-RestMethod -Method Delete -Uri "http://localhost:3000/api/expenses/$($expense.expense.id)" -Headers $headers
```

The auth endpoints are `POST /api/auth/register` and `POST /api/auth/login`. All expense, memory, and user-settings endpoints require `Authorization: Bearer <token>`. Memories have `GET`/`POST /api/memories` and `DELETE /api/memories/:id` so the existing Snap/Memory interface remains persistent. `GET /api/auth/me` is available to retrieve the authenticated profile.

Spendly AI uses `POST /api/ai/chat` and `POST /api/ai/classify-snap`; both require the current user's JWT. The chat route builds its financial snapshot using SQL queries scoped to that token's user ID, and the AI provider key stays on the backend.

## Notes

- `schema.sql` creates `users`, `expenses`, `user_settings`, and `memories`; each user's rows are protected by ownership checks and foreign keys.
- The browser stores only the JWT in `localStorage`. Expense/settings/memory data is fetched from MySQL through the API.
- For production, serve both frontend and API over HTTPS, set a restrictive `FRONTEND_ORIGIN`, use a managed secret store for `.env` values, and run migrations with a dedicated deployment process.
