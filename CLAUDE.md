# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install              # Install all workspace dependencies (must use pnpm, not npm/yarn)
pnpm run dev              # Start backend + frontend dev servers concurrently
pnpm run build            # Typecheck + build backend + build frontend
pnpm run typecheck        # Typecheck all workspaces (frontend, backend, scripts)
```

Individual workspaces:
```bash
pnpm --filter @workspace/api-server dev        # Backend only (Express, port 3000)
pnpm --filter @workspace/stegofy-qr dev        # Frontend only (Vite, port 5173)
pnpm --filter @workspace/api-server build      # Build backend → backend/dist/
pnpm --filter @workspace/stegofy-qr build      # Build frontend → frontend/dist/
```

## Architecture

**Monorepo** with pnpm workspaces: `frontend/` (React + Vite + Tailwind), `backend/` (Express + TypeScript), `scripts/` (utilities).

**Database:** Supabase (Postgres + Auth + RLS). Backend uses `supabaseAdmin` (service role) for server operations and direct Postgres pool (`getCommsPool()`) for comms tables with RLS that blocks anon/authenticated access.

**Deployment:** Render — single combined service (`stegofy-api`) hosting both backend Express server and frontend static files. The backend serves the built frontend via `SERVE_FRONTEND=true`. Custom domain: **stegotags.stegofy.com**. See `render.yaml`.

### Backend (`backend/src/`)

**Entry:** `index.ts` → `app.ts` (Express with raw body capture for webhook signature verification).

**Route registration:** `routes/index.ts` — all routers mounted here.

**Route files and their responsibilities:**
- `routes/health.ts` — `/api/healthz`
- `routes/admin-users.ts` — Admin user CRUD, requires super_admin role
- `routes/admin-inventory.ts` — QR inventory management
- `routes/admin-config.ts` — Settings CRUD, vendor email config
- `routes/admin-vendor-email.ts` — Vendor email notifications via Resend
- `routes/comms-public.ts` — Public endpoints: OTP, contact calls/messages (no auth)
- `routes/comms-admin.ts` — Admin comms dashboard, delivery trails (requires super_admin)
- `routes/comms-webhooks.ts` — Exotel/Zavu webhooks + IVR flow (see Exotel section below)
- `routes/shipping.ts` — Shiprocket: public rate calculator + admin shipping operations + delivery webhook
- `routes/track-scan.ts` — QR scan analytics with IP hashing/encryption

**Admin auth pattern:** Routes call `requireSuperAdmin(req, res)` which validates the Bearer token against Supabase Auth, then checks `admin_users` table for `super_admin` role. Returns user ID or sends 401/403.

**Services:**
- `commsRouter.ts` — Multi-provider failover: Zavu WhatsApp → Exotel WhatsApp → SMS. Rate limiting, cost caps, call duration enforcement.
- `commsCredentials.ts` — All config from `settings` table (key-value), 30s cache TTL, fail-soft defaults. `getCommsSettings()` is the main entry point.
- `exotelService.ts` — Exotel API: masked calls (`connectCallViaExotel`), SMS, WhatsApp, disconnect.
- `zavuService.ts` — Zavu WhatsApp API.
- `shiprocketService.ts` — Shiprocket API client with 9-day token cache. Functions: `checkServiceability`, `createShiprocketOrder`, `assignCourier`, `requestPickup`, `trackByOrderId`, `cancelShipment`, `createReturn`, `getNdrList`, `handleNdr`.
- `phoneHash.ts` — `normalizePhone()` (→ E.164), `hashPhone()` (HMAC-SHA256), `isValidIndianMobile()` (validates +91[6-9]XXXXXXXXX).

### Frontend (`frontend/src/`)

**Routing:** `app/AppRouter.tsx` — wouter-based. Public routes under `/app/*`, admin routes under `/admin/*`.

**Key directories:**
- `app/screens/` — User-facing screens (home, QR management, checkout, orders, scan/public profile)
- `admin/screens/` — Admin panel (dashboard, orders, settings, contact requests, products, inventory, analytics)
- `services/` — API clients (`adminService.ts`, `orderService.ts`, `contactRequestService.ts`)
- `app/context/` — React contexts (AuthContext, CartContext)
- `lib/` — Utilities (`supabase.ts`, `apiUrl.ts`, `adminAuth.ts`)

**Auth:** Supabase Auth with phone OTP. Admin auth via `ensureFreshSession()` + `VITE_ADMIN_USER_IDS` env var.

### Database Tables

**Supabase-managed (RLS enabled, frontend can query):**
- `qr_codes` — QR profiles with type, data (JSON), pin_code, emergency_contact
- `contact_requests` — Stranger contact attempts (requester_phone in plaintext, admin-visible only)
- `orders` / `order_items` — E-commerce orders with shipping columns (shiprocket_order_id, awb_code, courier_name, tracking_url, etc.)
- `products` / `product_variants` — Shop inventory
- `qr_scans` — Scan analytics with masked/hashed/encrypted IP
- `settings` — Key-value config (API credentials, feature flags, routing preferences)
- `admin_users` — Admin accounts with roles and permissions

**Server-only (RLS with no policies, accessed via Postgres pool):**
- `call_logs` — Masked call records. Phones stored as both HMAC hash and plaintext (`caller_phone`, `callee_phone`) so QR owners can see who reached them. Also stores `vehicle_last4` (entered during IVR) and `recording_url`.
- `message_logs` — WhatsApp/SMS delivery records. Plaintext `recipient_phone` alongside hash for owner activity feeds.
- `otp_codes` — OTP storage with expiry
- `pending_disconnects` — Scheduled call terminations (survives server restart)

## Call & Message Activity

Owners and admins surface the comms logs through `routes/activity.ts`:
- `GET /api/me/activity` — unified feed for every QR the caller owns
- `GET /api/me/qr/:qrId/activity` — feed scoped to one owned QR
- `GET /api/admin/users/:userId/activity` — super-admin per-user drilldown

`qr_codes.id → call_logs.qr_id / message_logs.qr_id` is the join key. Cross-DB: `qr_codes` lives in Supabase, logs live in the comms Postgres pool, so the routes resolve owned `qr_id`s via Supabase first, then `WHERE qr_id = ANY($1)` against the pool.

Frontend surfaces:
- `/app/activity` — top-level feed (entry from `MyQRScreen` "View Activity" button)
- `ManageQRScreen` "Activity" tab — per-QR feed
- `UsersScreen` user-detail modal "Comms" tab — admin per-user feed
- `CommunicationsScreen` user filter — scopes the recent-50 feed to one user (passes `?userId=` to `/admin/comms/health`)

## Exotel IVR Architecture

Two Exotel flows are configured in AppBazaar — **Flow A** and **Flow B**. The system uses **Passthru** applets (HTTP status code routing), **SwitchCase** applets for branching logic, and **Gather** applets for DTMF input.

**Flow A** (entry point when someone dials the ExoPhone):
```
Greeting: "Thank you for calling Stego Tags. This service helps you contact the vehicle owner securely."
  → Transfer to Flow B (always)
```

Flow A currently has no Passthru or callback detection. The backend endpoint `/webhooks/exotel/greeting` exists with owner callback logic but is **not yet wired up** in Exotel AppBazaar.

**Flow B** (stranger verification — vehicle last-4 digits + 4-digit PIN):
```
Gather (vehicle last 4) → Passthru (/api/webhooks/exotel/store-vehicle)
  → Gather (4-digit PIN) → Passthru (/api/webhooks/exotel/verify)
      → SwitchCase on response body:
          ├─ "verified"      → Connect (/api/webhooks/exotel/connect)
          ├─ "retry"         → loop back to Gather
          └─ "max_attempts"  → hang up
```

**Passthru applet behavior:** Calls a URL, branches based on HTTP status code:
- **200 OK** → follows the "success" path
- **Any non-200 status (404, etc.)** → follows the "failure" path

**SwitchCase applet behavior:** Routes the call to different branches based on `{"select":"keyword"}` in the Passthru response body — used for multi-way branching (verified/retry/max_attempts).

**Connect applet** (`/webhooks/exotel/connect`): Looks up verified call in memory cache, returns owner phone number. Plays greeting to callee. Enforces `max_conversation_duration` (default 60s from settings).

**In-memory IVR caches** (5-min TTL, keyed by CallSid):
- `pendingVehicle` — stores vehicle last-4 digits between Gather and Verify
- `verifiedCalls` — stores owner phone + qrId for Connect applet
- `attemptCount` — tracks verification attempts (max 3) and callback rate limits

**Not yet implemented:**
- Owner callback detection (code exists at `/webhooks/exotel/greeting` but Flow A has no Passthru applet to call it)

**Connect Applet API variants (Exotel):**

Two ways to configure the Connect applet in AppBazaar:

| Variant | URL response format | When to use |
|---------|---------------------|-------------|
| **Dynamic URL** | `application/json` — `{ "destination": { "numbers": ["+91..."] }, "max_conversation_duration": N, ... }` | When you need playback greeting, duration enforcement |
| **Dial Whom** | `text/plain` — just the E.164 phone number | Simple redirect with no extra config |

**We use Dynamic URL.** The Connect applet in AppBazaar is configured with:
`https://stegotags.stegofy.com/api/webhooks/exotel/connect`
Our `/webhooks/exotel/connect` handler returns full JSON (numbers array + duration + callee greeting).

**Belt-and-suspenders:** `/webhooks/exotel/verify` also returns `"destination": "+91..."` in its response body so the Connect applet can dial even if it reads directly from the Passthru response rather than separately GETting `/connect`.

## Shiprocket Integration

Credentials stored in `settings` table: `shiprocket_email`, `shiprocket_password`, `shiprocket_pickup_pincode`, `shiprocket_auto_ship`, `shiprocket_default_weight/length/breadth/height`.

**Shipping flow (admin):** Create order → Assign courier (select from rate list) → Generate AWB → Request pickup → Track.

**Public rate calculator:** `POST /api/shipping/rates` with `delivery_pincode` — returns available couriers with rates.

**Webhook:** `POST /api/webhooks/shiprocket/status` — auto-updates order status based on Shiprocket delivery events.

**Orders table shipping columns:** `shiprocket_order_id`, `shiprocket_shipment_id`, `awb_code`, `courier_name`, `courier_id`, `tracking_url`, `shipping_cost`, `estimated_delivery`, `shipped_at`, `delivered_at`.

## Settings Pattern

All API credentials and configuration stored as key-value pairs in `settings` table. Accessed via `getCommsSettings()` with 30-second cache. Same pattern for Exotel, Zavu, and Shiprocket credentials. Admin configures via Settings screen tabs (General, Communications, Cost Control, API Keys, Shipping, FAQ).
