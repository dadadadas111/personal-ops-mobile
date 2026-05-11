# AGENTS.md

## Repo shape
- This repo is a **single Expo / React Native app at the repository root**. It is **not** a workspace/monorepo in its current layout.
- Source entrypoints are `index.ts` -> `App.tsx`.
- `App.tsx` bootstraps the app by calling `configureNotifications()`, `initDatabase()`, and `syncJournalNotifications()` before rendering the tab navigator.
- The six shipped screen modules live in `src/screens`: `Dashboard`, `Schedule`, `Progress`, `Finance`, `Journal`, and `Settings`.
- Most app behavior is concentrated in `src/lib/`:
  - `database.ts` = SQLite schema + CRUD + backup import/export
  - `journalReminders.ts` = notification scheduling
  - `backup.ts` = file export/import flow

## Commands
- Use `pnpm`; `pnpm-lock.yaml` is present and CI installs with `pnpm install --frozen-lockfile`.
- Main scripts from root `package.json`:
  - `pnpm start`
  - `pnpm android`
  - `pnpm ios`
  - `pnpm web`
  - `pnpm typecheck`
  - `pnpm prebuild:android`
  - `pnpm build:apk`
- There is **no dedicated lint or test script** in `package.json`. Do not invent `pnpm test` or `pnpm lint` unless you add them.

## Data and product invariants
- The app is intentionally **offline-first**. SQLite is the local source of truth.
- The database file is `personal_ops.db` (`src/lib/database.ts`) and initialization enables `PRAGMA journal_mode = WAL`.
- `src/lib/database.ts` seeds and persists important app metadata such as `schema_version`, `active_device_id`, and journal reminder settings.
- Backup/restore is a **full snapshot flow**, not merge/sync:
  - `exportBackupPayload()` serializes app tables into a JSON payload.
  - `importBackupPayload()` deletes current table contents and inserts the snapshot inside an exclusive transaction.
- Keep the MVP assumptions from `HANDOFF.md`: single-device authoritative flow, manual backup/export/import first, no backend-auth/sync/conflict-resolution work unless the task explicitly changes product scope.

## Notifications and Settings behavior
- Journal reminders are stored in app meta and rescheduled by `syncJournalNotifications()`.
- `syncJournalNotifications()` requests permission, cancels **all** scheduled notifications, then recreates enabled daily journal reminders. Be careful when changing reminder behavior.
- `SettingsScreen.tsx` is the control surface for reminder editing plus backup export/import.

## Android / release gotchas
- `app.config.ts` is the app config source of truth. It pulls `version` from `package.json` and derives `android.versionCode` from `ANDROID_VERSION_CODE` (default `1`).
- Stable mobile identity matters: iOS bundle ID and Android package are both `io.github.dadadadas111.personalops`.
- Native Android sources already exist under `android/`. Current checked-in config includes min/compile/target SDK `24/35/35`, `newArchEnabled=true`, `hermesEnabled=true`, and Gradle `8.14.3`.
- `pnpm build:apk` runs `expo prebuild --platform android --non-interactive` and then `./gradlew assembleRelease` inside `android/`.
- The GitHub Actions workflow `.github/workflows/release-android.yml` still assumes the app lives under `apps/personal-ops-mobile`, but the actual app is at repo root. If you touch release automation, fix those stale paths first.
- Release updates depend on keeping the **same signing key** across versions; `HANDOFF.md` calls this out explicitly.

## Source priority
- Trust executable sources first: `package.json`, `app.config.ts`, `src/lib/database.ts`, `src/lib/backup.ts`, `App.tsx`, and `.github/workflows/release-android.yml`.
- `HANDOFF.md` is useful product/architecture context and currently matches the codebase better than `docs/mobile-app-technical-spec.md` in a few places.
- `docs/mobile-app-technical-spec.md` still describes a recommended `apps/personal-ops-mobile/` layout; treat that as stale when it conflicts with the current repo-root app structure.
