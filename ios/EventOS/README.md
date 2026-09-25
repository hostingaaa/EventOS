# EventOS iOS

Native SwiftUI client for EventOS, talking directly to the same Google Apps
Script backend as `web/` (see `web/src/api/client.ts` for the wire protocol
this mirrors).

## Setup

1. Requires Xcode 16+ and [XcodeGen](https://github.com/yonaskolb/XcodeGen)
   (`brew install xcodegen`).
2. Copy the secrets template and fill in the same values as
   `web/.env.local` (`VITE_API_URL` / `VITE_API_TOKEN`):
   ```
   cp EventOS/Config/Secrets.swift.example EventOS/Config/Secrets.swift
   ```
3. Generate the Xcode project (the `.xcodeproj` is gitignored — regenerate
   it from `project.yml` after pulling):
   ```
   xcodegen generate
   ```
4. Open `EventOS.xcodeproj` in Xcode, or build from the command line:
   ```
   xcodebuild -project EventOS.xcodeproj -scheme EventOS \
     -destination 'platform=iOS Simulator,name=iPhone 16' build
   ```

## What's implemented

- Auth: email/password sign-in and registration against the same
  `authCheckEmail` / `authLogin` / `authRegister` actions and password
  hashing scheme as the web app (accounts are shared between clients).
- Dashboard: event list grouped by month, health badges, filter tabs.
- Event workspace: tasks (list, status changes, create), event-level
  comments, activity log.
- Team overview.

## Not yet ported (web-only for now)

- Generators (AV equipment / transfer list / per-diem / SOW parsing)
- Design workspace (badge/banner/certificate PDF generation)
- Admin panel, task/org templates
- Vendor portal
- File upload from device and in-app file browsing
