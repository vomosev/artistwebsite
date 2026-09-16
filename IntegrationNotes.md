# Integration Notes for artistwebsite

## Overview

Artistwebsite is a Next.js App Router portfolio with a separately deployed HTTPS Express API and an external MySQL database. It includes:

- A public artist profile and featured-work presentation
- A filterable artwork gallery with accessible detail dialogs
- Curated fallback content when public API requests are unavailable
- Session-based signup, login, and logout
- An authenticated administration dashboard for profile and artwork management
- MySQL-backed session persistence
- Production metadata, sitemap, robots rules, error handling, and responsive styling

The production endpoints are fixed in the application:

- Frontend: `https://artistwebsite.geo-drops.com`
- Backend API: `https://artistwebsite-api.geo-drops.com:5094`

The browser API helper in `lib/api.js` always targets the production backend URL and includes credentials with requests. The frontend and backend are intended to be deployed separately; using the same numeric port is valid when they run on different hosts.

Public pages load data after the browser mounts. If profile or artwork requests fail, `components/HomeExperience.jsx` substitutes curated fallback content and displays a discreet availability notice. Administrative features require a valid server-side session and do not fall back to local content.

## Prerequisites

Install or provision the following:

- Node.js 18.17 or newer; Node.js 20 LTS is recommended
- npm
- MySQL 8.x or a compatible external MySQL service
- A MySQL user with permission to read and modify the application database
- PM2 for production frontend process management
- DNS records for:
  - `artistwebsite.geo-drops.com`
  - `artistwebsite-api.geo-drops.com`
- A valid TLS certificate and private key for the backend API
- Network access from the backend host to the MySQL server
- Firewall access to the configured backend HTTPS port, such as `5094`

Install PM2 globally if it is not already available:

```bash
npm install --global pm2
```

The backend reads its TLS files from these exact locations:

- `/home/arx-app/backends/certs/certificate.crt`
- `/home/arx-app/backends/certs/private.key`

The certificate must be valid for `artistwebsite-api.geo-drops.com`, and the user running the backend must have read access to both files. Keep the private key inaccessible to unrelated users.

The PM2 frontend configuration expects the repository at:

```text
/home/arx-app/backends/artistwebsite
```

If the project is installed elsewhere, the required `cwd` in `ecosystem.config.js` will not match the deployment.

## Installation

### 1. Place the project in the required directory

For the provided PM2 configuration:

```bash
mkdir -p /home/arx-app/backends
cd /home/arx-app/backends
git clone <repository-url> artistwebsite
cd artistwebsite
```

If the files are delivered without Git, copy them into:

```text
/home/arx-app/backends/artistwebsite
```

### 2. Install Node.js dependencies

The frontend and backend share the root `package.json`:

```bash
cd /home/arx-app/backends/artistwebsite
npm install
```

For a repeatable deployment where a lock file is available, use:

```bash
npm ci
```

The project depends on Next.js, React, Express, CORS, dotenv, mysql2, bcrypt, express-session, and Helmet.

### 3. Create the MySQL database

Connect as a MySQL administrator and create the database if it does not already exist:

```sql
CREATE DATABASE artistwebsite
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Create or grant access to the application account as appropriate for the MySQL environment. For example:

```sql
CREATE USER 'artistwebsite_user'@'%' IDENTIFIED BY 'replace-with-a-strong-password';
GRANT SELECT, INSERT, UPDATE, DELETE ON artistwebsite.* TO 'artistwebsite_user'@'%';
FLUSH PRIVILEGES;
```

Restrict the account host instead of using `%` whenever the backend has a stable address.

### 4. Import the schema

From the project root:

```bash
mysql \
  -h mysql.example.internal \
  -u artistwebsite_user \
  -p \
  artistwebsite < schema.sql
```

Enter the MySQL password when prompted.

`schema.sql` creates the utf8mb4 tables for:

- Users
- Persisted sessions
- The singleton artist profile
- Ordered portfolio artworks

It also establishes unique email and artwork-slug constraints, indexes, timestamps, publication and featured flags, and idempotent starter profile and portfolio records.

### 5. Configure environment variables

Create a local environment file from the safe template:

```bash
cp .env.example .env
```

Edit `.env` and replace all placeholders with deployment-specific values:

```bash
chmod 600 .env
```

Do not commit `.env`. The repository keeps `.env.example` while ignoring local environment files.

Generate a strong session secret, for example:

```bash
openssl rand -base64 48
```

### 6. Install the backend TLS files

Create the expected certificate directory:

```bash
mkdir -p /home/arx-app/backends/certs
```

Install the certificate and private key at:

```text
/home/arx-app/backends/certs/certificate.crt
/home/arx-app/backends/certs/private.key
```

Apply restrictive permissions suitable for the service account:

```bash
chmod 644 /home/arx-app/backends/certs/certificate.crt
chmod 600 /home/arx-app/backends/certs/private.key
```

Do not store the private key in the repository.

### 7. Prepare the launcher

Ensure the backend launcher is executable:

```bash
chmod +x START.sh
```

## Environment Variables

All variables are read from the deployment environment or the root `.env` file.

### `BACKEND_PORT`

HTTPS port on which the Express backend API listens.

Example:

```dotenv
BACKEND_PORT=5094
```

The production browser client is fixed to `https://artistwebsite-api.geo-drops.com:5094`, so the production API must be reachable on port `5094` unless the application code and deployment contract are intentionally revised together.

### `DB_HOST`

Hostname or IP address of the external MySQL server.

Example:

```dotenv
DB_HOST=mysql.example.internal
```

The backend host must be able to resolve and connect to this address.

### `DB_USER`

MySQL account used by the Express backend.

Example:

```dotenv
DB_USER=artistwebsite_user
```

This account needs access to the tables created by `schema.sql`.

### `DB_PASSWORD`

Password for the configured MySQL account.

Example:

```dotenv
DB_PASSWORD=your-secret-here
```

Use a strong secret and do not commit it to source control.

### `DB_NAME`

Name of the MySQL database containing the application tables.

Example:

```dotenv
DB_NAME=artistwebsite
```

This must be the same database into which `schema.sql` was imported.

### `SESSION_SECRET`

Long random secret used to sign Express session cookies.

Example:

```dotenv
SESSION_SECRET=replace-with-a-long-random-secret
```

Generate a cryptographically strong value. Changing it invalidates existing signed sessions, so rotate it deliberately.

### `NODE_ENV`

Runtime environment controlling production security behavior.

Production example:

```dotenv
NODE_ENV=production
```

Use `production` for the deployed service so production cookie and error-disclosure behavior is enabled. For isolated development, `development` may be used.

### `PORT`

Port supplied to Next.js by the required PM2 configuration.

Example:

```dotenv
PORT=5094
```

`ecosystem.config.js` sets `NODE_ENV` to `production` and `PORT` to `5094`. The provided npm frontend commands also explicitly use port `5094`.

A safe `.env` layout is:

```dotenv
BACKEND_PORT=5094
DB_HOST=mysql.example.internal
DB_USER=artistwebsite_user
DB_PASSWORD=your-secret-here
DB_NAME=artistwebsite
SESSION_SECRET=replace-with-a-long-random-secret
NODE_ENV=production
PORT=5094
```

Because both services use `5094` by default, they cannot bind that port simultaneously on the same network interface. The intended production topology places the frontend and backend on separate hosts.

## Running the Application

### Backend API

Before starting the backend, confirm:

- `.env` contains valid database credentials.
- `schema.sql` has been imported.
- The TLS files exist at the required paths.
- The backend can connect to MySQL.
- The configured backend port is available.

Start the Express HTTPS API in the foreground:

```bash
cd /home/arx-app/backends/artistwebsite
npm run server
```

This runs:

```bash
node server/index.js
```

At startup, the backend loads dotenv, verifies MySQL connectivity, and creates an HTTPS server on `BACKEND_PORT`.

Check the health endpoint:

```bash
curl https://artistwebsite-api.geo-drops.com:5094/health
```

A healthy API returns exactly:

```json
{"status":"ok"}
```

Do not disable TLS verification in production. For initial certificate troubleshooting only, `curl -k` can distinguish a certificate-chain issue from an unavailable process, but it should not be used as the normal health check.

### Detached backend startup with `START.sh`

Run:

```bash
cd /home/arx-app/backends/artistwebsite
./START.sh
```

`START.sh` changes to the project directory and starts `npm run server` as a detached background task. It maintains persistent log and PID files so the backend can continue after the shell exits. Keep those generated files out of source control as configured by `.gitignore`.

Before starting another instance, use the PID file maintained by the script to verify that an older backend process is not already running.

### Frontend development server

Run the Next.js development server with:

```bash
cd /home/arx-app/backends/artistwebsite
npm run dev
```

This executes:

```bash
next dev -p 5094
```

The frontend will be available on port `5094` of the machine running it.

The browser API endpoint is not derived from a local environment variable. `lib/api.js` always calls:

```text
https://artistwebsite-api.geo-drops.com:5094
```

Therefore, local frontend sessions still require the production-style API hostname to resolve and be reachable over valid HTTPS. The backend CORS policy accepts credentialed HTTPS origins under `*.geo-drops.com`; an arbitrary `http://localhost` origin is not part of the intended integration topology.

If the frontend and backend must be tested on one machine, they need separate listening addresses or ports. Changing only `BACKEND_PORT` is insufficient for browser integration because `lib/api.js` remains fixed to port `5094`.

### Production frontend build

Generate the `.next` production build:

```bash
cd /home/arx-app/backends/artistwebsite
npm install
npm run build
```

Start it directly for a foreground verification:

```bash
npm start
```

The start script executes:

```bash
next start -p 5094
```

### Production frontend with PM2

The required `ecosystem.config.js` launches:

- Application name: `artistwebsite`
- Executable: `node_modules/.bin/next`
- Arguments: `start`
- Working directory: `/home/arx-app/backends/artistwebsite`
- `NODE_ENV`: `production`
- `PORT`: `5094`

Build before starting PM2:

```bash
cd /home/arx-app/backends/artistwebsite
npm ci
npm run build
pm2 start ecosystem.config.js
```

Inspect the process:

```bash
pm2 status
pm2 logs artistwebsite
pm2 describe artistwebsite
```

After a new build, restart the frontend:

```bash
pm2 restart artistwebsite
```

Persist the PM2 process list and configure operating-system startup:

```bash
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`, then run `pm2 save` again if required.

### Authentication and session behavior

Authentication uses server-side Express sessions persisted in the MySQL `sessions` table.

The browser request helper sends credentials with API requests. Successful signup or login regenerates the session and stores only minimal user information in the session. Passwords are hashed with bcrypt, and password hashes are never returned by the API.

In production:

- Use HTTPS for both frontend and API.
- Keep `NODE_ENV=production`.
- Preserve credentialed CORS behavior.
- Do not place frontend and API behind configurations that strip cookie headers.
- Ensure the system clock is accurate on the API and database hosts.
- Do not delete active session rows unless forced logout is intended.

The administration page at `/admin` verifies the current session at runtime and redirects unauthenticated users to `/login`.

### API endpoints

#### Health

- `GET /health`

#### Authentication

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

#### Public portfolio

- `GET /api/profile`
- `GET /api/artworks`
- `GET /api/artworks/:slug`

Public artwork listing returns published works only.

#### Authenticated portfolio management

- `PUT /api/profile`
- `POST /api/artworks`
- `PUT /api/artworks/:slug`
- `DELETE /api/artworks/:slug`

Authenticated management requests can include drafts and support publication, featured status, ordering, editing, and deletion workflows.

## Project Structure

### Root configuration and deployment files

- `package.json` — CommonJS project metadata, dependencies, and npm scripts for the Next.js frontend and Express backend.
- `next.config.js` — Production-ready Next.js configuration with React strict mode and security and performance settings.
- `ecosystem.config.js` — Required PM2 definition for the production Next.js process.
- `START.sh` — Executable detached launcher for the Express backend, including persistent logging and PID tracking.
- `.env.example` — Safe environment-variable template without real credentials.
- `.gitignore` — Excludes dependencies, builds, local environment files, logs, PID files, editor files, and operating-system artifacts.
- `README.md` — Full project-level operating and deployment documentation.
- `schema.sql` — MySQL schema, indexes, constraints, sessions, and starter portfolio data.

### Next.js application

- `app/layout.jsx` — Root App Router layout, global CSS import, metadata, Open Graph data, and canonical production URL.
- `app/page.jsx` — Public homepage that renders `HomeExperience` without build-time or server-side API requests.
- `app/globals.css` — Responsive public, authentication, modal, error, loading, and admin visual system.
- `app/login/page.jsx` — Metadata-aware login page using `AuthForm`.
- `app/signup/page.jsx` — Metadata-aware signup page with portfolio and login navigation.
- `app/admin/page.jsx` — Noindex administration page using `AdminDashboard`.
- `app/error.jsx` — Client-side error boundary with safe messaging and recovery actions.
- `app/not-found.jsx` — Branded 404 page linked to the canonical homepage.
- `app/robots.js` — Allows public crawling while disallowing `/admin`, `/login`, and `/signup`.
- `app/sitemap.js` — Sitemap metadata for `https://artistwebsite.geo-drops.com`.

### Frontend components

- `components/HomeExperience.jsx` — Runtime profile and artwork loading with `Promise.allSettled`, curated fallback content, and availability messaging.
- `components/SiteHeader.jsx` — Sticky responsive navigation and artist branding.
- `components/Hero.jsx` — Editorial profile and featured-artwork hero.
- `components/PortfolioGrid.jsx` — Category filtering, responsive artwork cards, empty states, and detail selection.
- `components/ArtworkModal.jsx` — Accessible portal-safe artwork dialog with focus management, scroll locking, Escape handling, and previous/next navigation.
- `components/AboutSection.jsx` — Biography, location, practice statement, and profile details.
- `components/ContactSection.jsx` — Validated email contact, optional social links, copyright, and footer navigation.
- `components/AuthForm.jsx` — Shared login/signup validation and session API integration.
- `components/AdminDashboard.jsx` — Session verification and complete profile and artwork management interface.

### Browser API integration

- `lib/api.js` — Browser-safe API client fixed to `https://artistwebsite-api.geo-drops.com:5094`, with credential inclusion, JSON parsing, timeouts, normalized errors, authentication methods, and portfolio CRUD methods.

### Express backend

- `server/index.js` — dotenv loading, Express setup, Helmet, credentialed CORS, JSON limits, MySQL sessions, routes, error handling, database verification, TLS loading, and HTTPS startup.
- `server/config/db.js` — Shared `mysql2/promise` connection pool and database connection check.
- `server/middleware/mysqlSessionStore.js` — Custom MySQL-backed Express session store with expiry cleanup.
- `server/middleware/requireAuth.js` — Session authentication guard.
- `server/middleware/errorHandler.js` — Centralized safe JSON error mapping.
- `server/utils/validators.js` — Normalization, profile and artwork validation, slug handling, URL validation, and MySQL record conversion.
- `server/controllers/authController.js` — Signup, login, logout, session regeneration, bcrypt handling, and current-user responses.
- `server/controllers/portfolioController.js` — Profile and artwork queries, publication filtering, ordering, slug uniqueness, and CRUD behavior.
- `server/routes/healthRoutes.js` — `GET /health`.
- `server/routes/authRoutes.js` — Authentication and current-session routes.
- `server/routes/portfolioRoutes.js` — Public portfolio reads and authenticated management routes.

## Next Steps / Production Considerations

1. **Replace all starter content.**  
   Use `/admin` to update the singleton artist profile and replace the idempotent starter artworks imported by `schema.sql`.

2. **Create the first administrator account securely.**  
   Use the signup page or `POST /api/auth/signup`, then verify that login, logout, and `/api/auth/me` behave correctly. If public signup should not remain available after provisioning, add an explicit registration policy before launch.

3. **Validate the split deployment.**  
   Confirm that:
   - `https://artistwebsite.geo-drops.com` serves the Next.js application.
   - `https://artistwebsite-api.geo-drops.com:5094/health` returns `{"status":"ok"}`.
   - Browser requests include session cookies.
   - CORS responses allow the deployed HTTPS frontend origin.
   - `/admin` redirects unauthenticated visitors.

4. **Protect database access.**  
   Restrict MySQL ingress to the backend host, use a least-privilege account, require encrypted MySQL transport where supported, and back up both portfolio and session tables.

5. **Manage secrets outside source control.**  
   Store `DB_PASSWORD` and `SESSION_SECRET` in a deployment secret manager or protected environment file. Rotate credentials through a controlled process.

6. **Harden TLS operations.**  
   Automate certificate renewal and restart the backend after certificate replacement. Monitor expiry for:
   - `certificate.crt`
   - `private.key`

7. **Plan port exposure carefully.**  
   The API URL explicitly includes `:5094`, so the port must be reachable from user browsers. If a load balancer or reverse proxy terminates HTTPS on another port, preserve external access to the fixed URL or update `lib/api.js` and all deployment documentation together.

8. **Monitor both processes independently.**  
   PM2 manages the Next.js frontend, while `START.sh` manages the detached backend. Add process, log, health, database-connectivity, latency, and disk-space monitoring for both services.

9. **Use production builds only after successful validation.**  
   Run:

   ```bash
   npm ci
   npm run build
   pm2 restart artistwebsite
   ```

   Test login and portfolio editing after every backend, schema, session, CORS, or cookie-related deployment.

10. **Add a database migration strategy.**  
    `schema.sql` is suitable for initial provisioning, but future schema changes should be tracked with ordered, reversible migrations rather than manual production edits.

11. **Review image hosting and optimization.**  
    Verify that artwork image URLs use trusted HTTPS hosts compatible with the Next.js image and security configuration. Set practical file-size and dimension policies for consistent performance.

12. **Test accessibility and resilience.**  
    Validate keyboard navigation, modal focus restoration, reduced-motion behavior, mobile navigation, form errors, empty states, API timeouts, fallback content, and unavailable-admin states.

13. **Review search-engine behavior.**  
    Confirm the canonical URL, Open Graph metadata, sitemap, and robots output in production. The administrative and authentication routes should remain disallowed from crawling, and `/admin` should retain noindex metadata.

14. **Back up before destructive operations.**  
    Artwork deletion is supported by the dashboard. Establish database backups and restoration tests before giving management access to additional users.

## Database Provisioning

A mysql database has been automatically provisioned for this app.

- **Database:** artistwebsite
- **Host:** testdb.gridiron-app.com
- **Port:** 3306
- **User:** artistwebsite
- **Credentials stored in Vault at:** `secret/data/mysql/artistwebsite`

Retrieve the password securely from Vault and set it as an environment variable (e.g. `DB_PASSWORD`) in your deployment settings — do not commit it to source control.
