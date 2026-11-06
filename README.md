# Class Hub

A private, self-hosted front end for the S3 EARTH CSE smart-class library: every class
in one organised place, with a proper login, watch-progress tracking and an admin panel.

> **Personal use only.** The videos are unlisted YouTube uploads belonging to ONES
> Coaching and the notes are their course material. This app is built to organise
> content *you are enrolled in* — do not publish it on a public URL or share it.

---

## Run it

Double-click **`start.bat`**. The first run installs dependencies, then opens the app
at <http://localhost:3000>.

To stop the server press `Ctrl+C` in the console window.

### Manual alternative

```bat
npm install
npm run catalogue      :: regenerate data/catalogue.json from the CSVs
npm run dev            :: http://localhost:3000
```

For a production build:

```bat
npm run build
npm start
```

## Accounts

| Account | Username | Password |
| --- | --- | --- |
| Admin (created automatically on first run) | `Joyel` | `joyel1621` |

The admin account is created the first time the app starts. Change the password from
the admin panel once you are in, or edit `data/store.json` while the server is stopped.

- **One device per account.** Signing in replaces the account's active session, so the
  previously signed-in device is signed out on its next page load (it lands on the
  login screen with a notice). This applies to every account, admin included.
- Admins can add users, reset passwords, promote/demote admins, force-sign-out a device
  and delete accounts from **Admin** in the sidebar.
- Passwords are hashed with **scrypt**, never stored in plain text.
- Login is rate-limited to 8 failed attempts per 5 minutes per IP.

## What it does

| Area | Behaviour |
| --- | --- |
| **Dashboard** | Totals, overall progress, continue-watching row, per-subject cards |
| **Subjects** | Modules and lessons, filter by not-started / in-progress / completed |
| **Watch** | YouTube player with resume, auto-save, next/previous, module playlist |
| **Notes** | All 351 PDFs, grouped by subject and module, served locally |
| **Progress** | Per-subject table plus a recent-activity log |
| **Admin** | User accounts, one-device sessions, per-user watch stats |

Progress is saved every ~12 seconds while playing, on pause, on video end, and when
the tab is closed. A lesson counts as complete at **90%** watched.

## Where things live

```
class-hub/
  app/                 pages and API routes
  components/          sidebar, player, forms, admin panel
  lib/                 catalogue loader, JSON store, auth, helpers
  data/catalogue.json  generated from the CSVs (355 lessons, 351 notes)
  data/store.json      users + watch progress  (created at runtime, gitignored)
  data/secret.key      session signing key     (created at runtime, gitignored)
  scripts/             catalogue builder
```

Notes are streamed straight from `..\ones_materials` — they are not copied, so the
app always reflects whatever has been downloaded.

## Rebuilding the catalogue

If you re-scrape the platform and the CSVs change:

```bat
npm run catalogue
```

That reads `../ones_all_videos.csv` and `../ones_materials_manifest.csv` and rewrites
`data/catalogue.json`. Watch progress is keyed by video id, so it survives rebuilds.
"# class-hub" 
