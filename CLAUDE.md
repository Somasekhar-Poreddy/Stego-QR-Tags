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
- `call_logs` — Masked call records with hashed phones
- `message_logs` — WhatsApp/SMS delivery records with hashed phones
- `otp_codes` — OTP storage with expiry
- `pending_disconnects` — Scheduled call terminations (survives server restart)

## Exotel IVR Architecture

Two Exotel flows are configured in AppBazaar — **Flow A** and **Flow B**. The system uses **Passthru** applets (HTTP status code routing) and **SwitchCase** applets for branching logic.

**Flow A** (entry point when someone dials the ExoPhone):
```
Greeting → Passthru (/api/webhooks/exotel/greeting)
             ├─ 200 OK    → Connect (/api/webhooks/exotel/connect)  [owner callback]
             └─ non-200   → Transfer to Flow B                       [stranger IVR]
```

**Flow B** (stranger verification — vehicle last-4 digits + 4-digit PIN):
```
Gather (vehicle last 4) → Passthru (/api/webhooks/exotel/store-vehicle)
  → Gather (4-digit PIN) → Passthru (/api/webhooks/exotel/verify)
      ├─ 200 OK  → Connect (/api/webhooks/exotel/connect)  [owner phone returned]
      └─ non-200 → loop back to Gather (or hang up after 3 attempts)
```

**Passthru applet behavior:** Calls a URL, branches based on HTTP status code:
- **200 OK** → follows the "success" path
- **Any non-200 status (404, etc.)** → follows the "failure" path

**SwitchCase applet behavior:** Routes the call to different branches based on a variable or condition value — used for multi-way branching in the IVR flow.

**Owner callback detection** (`/webhooks/exotel/greeting`): Matches caller phone (from `CallFrom` query param) against registered QR owners' phones. If match found AND a contact_request exists within callback window (default 60 min), returns **200** → skips IVR → connects owner to stranger. Otherwise returns **404** → normal stranger IVR via Flow B.

**In-memory IVR caches** (5-min TTL, keyed by CallSid):
- `pendingVehicle` — stores vehicle last-4 digits between Gather and Verify
- `verifiedCalls` — stores owner phone + qrId for Connect applet
- `attemptCount` — tracks verification attempts (max 3) and callback rate limits

## Shiprocket Integration

Credentials stored in `settings` table: `shiprocket_email`, `shiprocket_password`, `shiprocket_pickup_pincode`, `shiprocket_auto_ship`, `shiprocket_default_weight/length/breadth/height`.

**Shipping flow (admin):** Create order → Assign courier (select from rate list) → Generate AWB → Request pickup → Track.

**Public rate calculator:** `POST /api/shipping/rates` with `delivery_pincode` — returns available couriers with rates.

**Webhook:** `POST /api/webhooks/shiprocket/status` — auto-updates order status based on Shiprocket delivery events.

**Orders table shipping columns:** `shiprocket_order_id`, `shiprocket_shipment_id`, `awb_code`, `courier_name`, `courier_id`, `tracking_url`, `shipping_cost`, `estimated_delivery`, `shipped_at`, `delivered_at`.

## Settings Pattern

All API credentials and configuration stored as key-value pairs in `settings` table. Accessed via `getCommsSettings()` with 30-second cache. Same pattern for Exotel, Zavu, and Shiprocket credentials. Admin configures via Settings screen tabs (General, Communications, Cost Control, API Keys, Shipping, FAQ).
