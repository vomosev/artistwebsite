# Artistwebsite

A polished artist portfolio built with a Next.js App Router frontend and a separately deployed Express/MySQL API. The public site presents an artist profile, featured work, a filterable gallery, artwork details, and contact information. Session-protected administration tools support profile and portfolio management.

## Production URLs

- Public portfolio: <https://artistwebsite.geo-drops.com>
- Backend API: <https://artistwebsite-api.geo-drops.com:5094>
- API health check: <https://artistwebsite-api.geo-drops.com:5094/health>

The frontend API client is intentionally fixed to the production API URL. It does not read an alternate API hostname from the environment and does not proxy API traffic through Next.js.

## Technology

- Node.js
- Next.js App Router
- React
- Express
- MySQL via `mysql2`
- MySQL-backed `express-session`
- `bcrypt` password hashing
- Helmet security headers
- HTTPS backend transport
- PM2 for the production Next.js process

## Prerequisites

Install or provide:

- Node.js 18.18 or newer
- npm
- MySQL 8.0 or a compatible MySQL server
- A MySQL account with permission to create and modify the application tables
- Valid TLS certificate and private-key files for the backend
- PM2 for production frontend process management
- DNS records for the production frontend and API hostnames
- A reverse proxy or load balancer for the public frontend HTTPS endpoint

Install PM2 globally if it is not already available:

```sh
npm install --global pm2
```

## Installation

Clone or copy the project, enter its directory, and install dependencies:

```sh
cd /home/arx-app/backends/artistwebsite
npm install
```

For repeatable production installation when a lock file is present, use:

```sh
npm ci
```

Create the local environment file:

```sh
cp .env.example .env
```

Replace every placeholder in `.env` with deployment-specific values. Do not commit `.env` or any credentials.

## Environment Variables

The Express server loads `.env` before loading application modules. The frontend production process may receive `PORT` through PM2.

| Variable | Required | Purpose |
| --- | --- | --- |
| `BACKEND_PORT` | Yes | HTTPS port used by the Express API. The fixed production API URL expects port `5094`. |
| `DB_HOST` | Yes | Hostname or IP address of the external MySQL server. |
| `DB_USER` | Yes | MySQL account used by the backend connection pool. |
| `DB_PASSWORD` | Yes | Password for the MySQL account. |
| `DB_NAME` | Yes | Database containing users, sessions, profile, and artwork records. |
| `SESSION_SECRET` | Yes | Long, random secret used to sign session cookies. Use a high-entropy production value and keep it private. |
| `NODE_ENV` | Yes | Runtime mode. Use `development` during development and `production` for secure production behavior. |
| `PORT` | Production frontend | Port consumed by the Next.js process started through PM2. The supplied PM2 configuration sets it to `5094`. |

The repository contains only safe placeholders in `.env.example`. Never place real database credentials, session secrets, certificates, or private keys in source control.

## MySQL Setup

Create the database named by `DB_NAME` if it does not already exist:

```sql
CREATE DATABASE artistwebsite
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Import the schema from the project root:

```sh
mysql -h "$DB_HOST" -u "$DB_USER" -p "$DB_NAME" < schema.sql
```

Alternatively, specify values directly:

```sh
mysql -h database.example.internal -u application_user -p artistwebsite < schema.sql
```

The password is requested interactively and should not be placed in shell history.

The schema creates:

- `users` for authenticated accounts
- `sessions` for persisted Express sessions
- A singleton artist profile
- Ordered portfolio artwork records
- Unique email and artwork slug constraints
- Publication and featured flags
- Supporting indexes and timestamps
- Idempotent starter profile and portfolio content

The starter data does not provide a reusable administrator password. Create an account through the signup page or `POST /api/auth/signup`.

Running `schema.sql` again is designed to preserve compatibility with an existing installation and safely reapply starter records where appropriate.

## Required Backend TLS Files

The Express API creates an HTTPS server directly and reads its certificate files from these exact absolute paths:

```text
/home/arx-app/backends/certs/certificate.crt
/home/arx-app/backends/certs/private.key
```

Both files must exist and be readable by the operating-system user running the backend.

Recommended permissions should allow the service account to read the files while preventing unnecessary access to the private key. The certificate must be valid for the API hostname:

```text
artistwebsite-api.geo-drops.com
```

If an intermediate certificate chain is required, `certificate.crt` must contain the chain in the format expected by Node.js. The server will not start successfully if either required file is missing, unreadable, malformed, or does not match the other file.

## Development and Local Commands

### Start the Next.js frontend

```sh
npm run dev
```

The development server listens on:

```text
http://localhost:5094
```

The frontend still sends runtime API requests to:

```text
https://artistwebsite-api.geo-drops.com:5094
```

There is no local API URL override. Public portfolio content has curated fallback data when profile or artwork requests are unavailable, but authentication and administration require access to the production API hostname.

Because the API accepts credentialed browser requests only from approved HTTPS `*.geo-drops.com` origins, a browser page served from `http://localhost:5094` is not an approved production API origin. Full browser-based authentication testing must use the deployed HTTPS frontend origin or an appropriately configured deployment under the approved domain policy.

### Start the Express backend

After configuring `.env`, importing `schema.sql`, and installing the required certificate files:

```sh
npm run server
```

This executes:

```sh
node server/index.js
```

The server:

1. Loads environment variables.
2. Creates the MySQL connection pool.
3. verifies database connectivity.
4. Configures the MySQL-backed session store.
5. Loads the TLS certificate and private key.
6. Starts the HTTPS API on `BACKEND_PORT`.

Verify the running API:

```sh
curl https://artistwebsite-api.geo-drops.com:5094/health
```

A healthy process returns exactly:

```json
{"status":"ok"}
```

## Available npm Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Starts Next.js development mode on port `5094`. |
| `npm run build` | Generates the optimized production build in `.next`. |
| `npm start` | Starts the built Next.js application on port `5094`. |
| `npm run server` | Starts the HTTPS Express backend using `server/index.js`. |

A successful production build must exist before running `npm start` or starting the frontend with PM2.

## Production Frontend Deployment with PM2

The supplied `ecosystem.config.js` launches:

```text
node_modules/.bin/next start
```

It uses:

- Application name: `artistwebsite`
- Working directory: `/home/arx-app/backends/artistwebsite`
- `NODE_ENV=production`
- `PORT=5094`

Install dependencies and build before starting PM2:

```sh
cd /home/arx-app/backends/artistwebsite
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
```

Useful PM2 commands:

```sh
pm2 status
pm2 logs artistwebsite
pm2 restart artistwebsite
pm2 stop artistwebsite
pm2 delete artistwebsite
```

After deploying frontend changes, rebuild and restart:

```sh
cd /home/arx-app/backends/artistwebsite
npm ci
npm run build
pm2 restart artistwebsite
```

The Next.js process serves HTTP internally on port `5094`. The canonical public frontend URL uses HTTPS without an explicit port, so the deployment should place an HTTPS reverse proxy or load balancer in front of the Next.js process.

## Backend Launch with `START.sh`

`START.sh` changes to the project directory and starts `npm run server` as a detached background process. Backend output and the process ID are written to persistent project log and PID files.

Ensure the script is executable:

```sh
chmod +x START.sh
```

Launch the backend:

```sh
./START.sh
```

Before using the launcher, ensure:

- `.env` contains valid production settings.
- The MySQL schema has been imported.
- The MySQL server is reachable.
- The required certificate and private key exist.
- No other process is already using `BACKEND_PORT`.

Consult the generated log file if the detached process does not remain running. Common startup failures include invalid database credentials, unavailable MySQL, a missing schema, an occupied port, and missing or invalid TLS files.

## Separate Frontend and Backend Deployment

The architecture expects the frontend and backend to be independently deployed:

### Frontend deployment

- Hostname: `artistwebsite.geo-drops.com`
- Public protocol: HTTPS
- Internal Next.js port: `5094`
- Managed by the supplied PM2 configuration
- Requires a completed `.next` production build
- Does not connect directly to MySQL

### Backend deployment

- Hostname: `artistwebsite-api.geo-drops.com`
- Public protocol: HTTPS
- Public API port: `5094`
- Started with `npm run server` or `START.sh`
- Connects to the external MySQL database
- Requires the fixed certificate paths
- Stores sessions in MySQL

The frontend and backend may both use port `5094` only because they are intended to run on separate hosts, containers, network addresses, or otherwise isolated listeners. Do not bind both processes to the same address and port on one machine.

The backend CORS policy accepts credentialed requests from approved HTTPS origins under `*.geo-drops.com`. Arbitrary origins and plain HTTP browser origins are not accepted in production.

## Session and Authentication Behavior

Authentication uses `express-session` with a custom MySQL store.

Key behavior:

- Passwords are hashed with `bcrypt`; plaintext passwords are never stored.
- Only minimal user identity data is placed in the session.
- Session records are persisted in the `sessions` table.
- Sessions can survive API process restarts as long as they remain valid in MySQL.
- Session IDs are regenerated after successful signup or login to reduce session-fixation risk.
- The browser must include credentials with API requests.
- The frontend request helper always uses credentialed requests.
- Production cookies are secure and require HTTPS.
- Cookie and CORS behavior is designed for the separate trusted frontend and API hostnames.
- Session expiry is refreshed through store touch operations where appropriate.
- Expired records are cleaned from the MySQL session table.
- Logout destroys the server-side session and clears the configured cookie.
- Changing `SESSION_SECRET` invalidates existing signed cookies.
- `/admin` verifies the current session at runtime and redirects unauthenticated visitors to `/login`.

The public profile and published artwork endpoints do not require authentication. Profile changes and artwork management operations require an authenticated session.

## API Endpoints

The API base URL is:

```text
https://artistwebsite-api.geo-drops.com:5094
```

All request and response bodies use JSON unless no body is required. Browser clients must include credentials for session-aware requests.

### Health

| Method | Path | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Returns `{"status":"ok"}` when the API process is available. |

### Authentication

| Method | Path | Authentication | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/signup` | Public | Validates name, email, and password, creates a user, and starts a session. |
| `POST` | `/api/auth/login` | Public | Verifies email and password, regenerates the session, and authenticates the user. |
| `POST` | `/api/auth/logout` | Required | Destroys the current session and clears the session cookie. |
| `GET` | `/api/auth/me` | Required | Returns the current authenticated user without exposing password data. |

Example signup body:

```json
{
  "name": "Portfolio Administrator",
  "email": "artist@example.com",
  "password": "use-a-strong-password"
}
```

Example login body:

```json
{
  "email": "artist@example.com",
  "password": "use-a-strong-password"
}
```

### Artist Profile

| Method | Path | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/api/profile` | Public | Returns the singleton artist profile. |
| `PUT` | `/api/profile` | Required | Validates and updates the artist profile. |

The profile supports the public artist identity, headline, introduction, biography, location, practice statement, contact details, and optional external links used by the portfolio.

### Artworks

| Method | Path | Authentication | Description |
| --- | --- | --- | --- |
| `GET` | `/api/artworks` | Public/session-aware | Returns published artwork publicly and supports complete management loading for an authenticated administrator. |
| `GET` | `/api/artworks/:slug` | Public/session-aware | Returns artwork by its unique slug while respecting publication access. |
| `POST` | `/api/artworks` | Required | Validates and creates an artwork. |
| `PUT` | `/api/artworks/:slug` | Required | Validates and updates the artwork identified by its slug. |
| `DELETE` | `/api/artworks/:slug` | Required | Deletes the artwork identified by its slug. |

Artwork data supports:

- Unique slug
- Title
- Category
- Year
- Medium
- Dimensions
- Description
- Image URL
- Display order
- Published status
- Featured status

Artwork lists use deterministic display ordering. Public requests do not expose unpublished work. Management requests can load drafts and update publishing, featuring, ordering, and artwork details.

### Common API Results

The API uses stable JSON errors and appropriate HTTP statuses, including:

- `400 Bad Request` for invalid payloads
- `401 Unauthorized` when a protected endpoint has no valid session
- `404 Not Found` for unknown routes or records
- `409 Conflict` for duplicate values such as an existing email or artwork slug
- `500 Internal Server Error` for unexpected failures

Production errors do not expose stack traces, password hashes, SQL statements, database credentials, or internal database details.

## Public Runtime Resilience

The public homepage performs profile and artwork requests only after the React application mounts. The requests are settled independently.

If either request fails:

- The affected content is replaced with complete curated fallback content.
- The portfolio remains usable and visually complete.
- A discreet availability notice indicates that live data could not be loaded.
- Authentication and administration still require a working API.

This prevents temporary API or database outages from making the public portfolio blank.

## Security Notes

- Keep `.env` outside version control.
- Use a long, random `SESSION_SECRET`.
- Use a dedicated least-privilege MySQL account.
- Protect the TLS private key from unauthorized access.
- Serve the production frontend and backend only over HTTPS.
- Keep Node.js, Next.js, Express, MySQL, and system packages updated.
- Restrict direct network access to MySQL.
- Do not expose the backend on untrusted origins.
- Back up the MySQL profile, artwork, user, and session data as appropriate.
- The login, signup, and administration routes are excluded from search crawling metadata, but crawler directives are not an access-control mechanism.
- Administrative authorization is enforced by the backend session middleware, not solely by frontend routing.

## Troubleshooting

### The public page shows fallback content

Check:

- The API health endpoint is reachable.
- DNS resolves `artistwebsite-api.geo-drops.com`.
- Port `5094` is allowed through the firewall.
- The backend certificate is valid.
- The API process can connect to MySQL.
- Published artwork and profile records exist.

### Login works in an API client but not in a browser

Check:

- The frontend is being served over HTTPS.
- The browser origin is an approved `*.geo-drops.com` origin.
- Requests include credentials.
- The certificate is trusted and valid.
- Cookies are not blocked by browser policy.
- The API CORS response permits the exact requesting origin.
- The frontend and API system clocks are correct.

### The backend exits immediately

Check:

- Both fixed TLS files exist and are readable.
- `BACKEND_PORT` is available.
- All required environment variables are present.
- MySQL is reachable.
- The database and tables exist.
- Database credentials have the required permissions.
- The backend log produced by `START.sh` contains the startup error.

### PM2 starts Next.js but the site returns a build error

Create the production build before restarting PM2:

```sh
cd /home/arx-app/backends/artistwebsite
npm run build
pm2 restart artistwebsite
```

### Frontend and backend cannot both use port 5094

They must not bind the same network address. Deploy them on separate hosts, containers, or addresses, or otherwise isolate their listeners while preserving the fixed public URLs.

## Project Structure

```text
artistwebsite/
├── .env.example
├── .gitignore
├── README.md
├── START.sh
├── ecosystem.config.js
├── next.config.js
├── package.json
├── schema.sql
├── app/
│   ├── globals.css
│   ├── layout.jsx
│   ├── page.jsx
│   ├── error.jsx
│   ├── not-found.jsx
│   ├── robots.js
│   ├── sitemap.js
│   ├── admin/
│   │   └── page.jsx
│   ├── login/
│   │   └── page.jsx
│   └── signup/
│       └── page.jsx
├── components/
│   ├── AboutSection.jsx
│   ├── AdminDashboard.jsx
│   ├── ArtworkModal.jsx
│   ├── AuthForm.jsx
│   ├── ContactSection.jsx
│   ├── Hero.jsx
│   ├── HomeExperience.jsx
│   ├── PortfolioGrid.jsx
│   └── SiteHeader.jsx
├── lib/
│   └── api.js
└── server/
    ├── index.js
    ├── config/
    │   └── db.js
    ├── controllers/
    │   ├── authController.js
    │   └── portfolioController.js
    ├── middleware/
    │   ├── errorHandler.js
    │   ├── mysqlSessionStore.js
    │   └── requireAuth.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── healthRoutes.js
    │   └── portfolioRoutes.js
    └── utils/
        └── validators.js
```

### Root files

- `package.json` — Project metadata, dependencies, and frontend/backend scripts.
- `next.config.js` — Strict, production-ready Next.js configuration.
- `ecosystem.config.js` — Required PM2 configuration for the production frontend.
- `START.sh` — Detached backend launcher with persistent logs and PID tracking.
- `.env.example` — Safe environment-variable placeholders.
- `.gitignore` — Excludes builds, dependencies, secrets, logs, PIDs, and local artifacts.
- `schema.sql` — MySQL tables, indexes, constraints, and idempotent starter content.
- `README.md` — Installation, operation, API, deployment, and architecture documentation.

### App Router

- `app/layout.jsx` — Root HTML shell, global styles, canonical metadata, and Open Graph data.
- `app/page.jsx` — Public portfolio entry point.
- `app/globals.css` — Complete responsive public, authentication, modal, and admin visual system.
- `app/login/page.jsx` — Branded login page.
- `app/signup/page.jsx` — Account creation page.
- `app/admin/page.jsx` — Noindex authenticated portfolio-management page.
- `app/error.jsx` — Client-side App Router error boundary.
- `app/not-found.jsx` — Styled 404 page.
- `app/robots.js` — Public crawler rules with private application paths disallowed.
- `app/sitemap.js` — Canonical homepage sitemap metadata.

### Frontend components

- `components/HomeExperience.jsx` — Runtime API loading, fallback content, and homepage composition.
- `components/SiteHeader.jsx` — Responsive navigation, branding, and login link.
- `components/Hero.jsx` — Artist introduction and featured artwork presentation.
- `components/PortfolioGrid.jsx` — Filterable artwork grid and modal selection state.
- `components/ArtworkModal.jsx` — Accessible portal-based artwork detail dialog.
- `components/AboutSection.jsx` — Biography, location, practice, and artist details.
- `components/ContactSection.jsx` — Contact links, external links, copyright, and footer.
- `components/AuthForm.jsx` — Validated login and signup workflow.
- `components/AdminDashboard.jsx` — Session verification and complete profile/artwork management.

### Frontend API client

- `lib/api.js` — Browser-safe, credentialed API helper fixed to the production backend, with JSON handling, timeouts, and normalized errors.

### Backend

- `server/index.js` — HTTPS Express bootstrap, security middleware, CORS, sessions, routing, database verification, and error handling.
- `server/config/db.js` — Shared `mysql2/promise` connection pool.
- `server/middleware/mysqlSessionStore.js` — MySQL-only Express session store.
- `server/middleware/requireAuth.js` — Protected-route session authorization.
- `server/middleware/errorHandler.js` — Centralized safe JSON error handling.
- `server/utils/validators.js` — Payload normalization, validation, slug handling, and safe record conversion.
- `server/controllers/authController.js` — Signup, login, logout, and current-user logic.
- `server/controllers/portfolioController.js` — Profile and artwork queries and mutations.
- `server/routes/healthRoutes.js` — API process health route.
- `server/routes/authRoutes.js` — Authentication endpoint definitions.
- `server/routes/portfolioRoutes.js` — Public portfolio and protected management routes.