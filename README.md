# NvFresh — Fresh Meat Delivery Platform

A complete meat & seafood delivery platform: a mobile-first customer web app, a separate
admin panel, and a shared Node.js/Express/SQLite backend.

## Project Structure

```
NvFresh/
├── server/      Node.js + Express + SQLite REST API (shared backend)
├── customer/    Customer-facing React + Vite app (mobile-first)
└── admin/       Admin panel React + Vite app (desktop-first)
```

## Tech Stack

- **Frontend**: React, Vite, React Router, plain CSS, React Icons
- **Backend**: Node.js, Express, Mongoose, Multer, JWT
- **Database**: MongoDB (Atlas)

## Quick Start

You'll run three processes in three terminals: the API server, the customer app, and the
admin app.

### 0. Set up MongoDB Atlas (one-time)

1. Create a free cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas) (the free
   "M0" tier is enough for this app).
2. **Database Access** → add a database user with a username/password (not your Atlas
   login — a separate DB user).
3. **Network Access** → add IP address `0.0.0.0/0` (allow from anywhere) — needed since
   your backend host's IP isn't fixed on most platforms.
4. **Database → Connect → Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your DB user's password, and add a database name before the
   `?`, e.g. `.../nvfresh?retryWrites=true...`.

### 1. Backend (API server)

```bash
cd server
cp .env.example .env
# paste your connection string into MONGODB_URI in .env
npm install
npm start
```

The API runs at `http://localhost:5000`. On first run it connects to your Atlas cluster
and seeds (only if the collections are empty):
- 6 sample products (with placeholder images in `uploads/seed/`)
- 1 admin account: **username `admin`, password `nvfresh123`**
- Default business settings (UPI ID, phone number)

You should see `Connected to MongoDB` in the console — if you instead see a connection
error, double-check your `MONGODB_URI`, DB user password, and that `0.0.0.0/0` is
allowed under Network Access in Atlas.

Uploaded product/QR images are stored inside your MongoDB Atlas cluster via GridFS by
default (served back out at `/api/files/...`) — no separate file storage service needed.
See **File Storage** below for how to switch providers later.

### 2. Customer website

```bash
cd customer
npm install
npm run dev
```

Opens at `http://localhost:5173`. Vite is pre-configured to proxy `/api` and `/uploads`
requests to the backend on port 5000, so no extra config is needed.

### 3. Admin website

```bash
cd admin
npm install
npm run dev
```

Opens at `http://localhost:5174`. Log in with `admin` / `nvfresh123`.

> Run `npm run build` in `customer/` or `admin/` to produce a production build in `dist/`
> (served by any static host — the API stays a separate Node process).

## Customer App Features

- Sticky header with logo, tagline, and cart icon
- Hero section, category filter chips, live search
- Featured products grid (2-column mobile layout) with weight selector, Add to Cart, Buy Now
- Product details page with benefits, storage & delivery info
- Cart with quantity steppers and order summary
- **Advance-only payment flow**: shows 25% advance due, a QR/UPI/phone placeholder, and an
  order form (name, phone, address, transaction ID)
- **Customer login** (Firebase — phone/OTP or Google): required before checkout; "My Orders"
  shows the signed-in customer's order history and live status
- About, Contact, Privacy Policy, Terms pages
- Bottom navigation: Home, Categories, Cart, Profile
- Toast notifications, skeleton loaders, empty states, hover/tap micro-animations

## Admin App Features

- Login (JWT-based, 8-hour session)
- Dashboard: product/order/customer counts, revenue, advance collected, recent orders
- Product management: add/edit/delete, image upload, category, badges, stock
- Orders table: customer, phone, products, amount, advance paid, transaction ID, and an
  inline status dropdown (Pending / Preparing / Delivered / Cancelled)
- Customers list with search and per-customer order counts
- Settings: business name, phone number, UPI ID, QR code image upload

## API Overview

All routes are prefixed with `/api`.

| Method | Route                     | Auth | Description                    |
|--------|----------------------------|------|--------------------------------|
| GET    | /products                  | No   | List products (`?category=`, `?search=`) |
| GET    | /products/:id              | No   | Get single product             |
| POST   | /products                  | Admin | Create product                 |
| PUT    | /products/:id              | Admin | Update product                 |
| DELETE | /products/:id              | Admin | Delete product                 |
| POST   | /orders                    | Customer | Place an order (requires customer sign-in) |
| GET    | /orders/mine                | Customer | The signed-in customer's own order history |
| GET    | /orders                    | Admin | List all orders                |
| PUT    | /orders/:id/status         | Admin | Update order status            |
| GET    | /customers                 | Admin | List customers (`?search=`)    |
| POST   | /auth/login                | No   | Admin login → JWT              |
| POST   | /upload                    | Admin | Upload an image (multipart)    |
| GET    | /settings                  | No   | Get business/payment settings  |
| PUT    | /settings                  | Admin | Update settings                |
| GET    | /dashboard/stats           | Admin | Aggregate dashboard stats      |

Admin routes expect `Authorization: Bearer <JWT from /auth/login>`. Customer routes expect
`Authorization: Bearer <Firebase ID token>` — see Customer Login below.

## Customer Login (Firebase — phone/OTP or Google)

Checkout, order placement, and order history all require the customer to be signed in via
Firebase Authentication. This is a **required** setup step — without it, customers can still
browse and add to cart, but Login/Checkout/My Orders will show a "Sign-in isn't set up yet"
error until it's configured.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Get started → Sign-in method** → enable **Phone** and **Google**.
   > Phone/OTP requires attaching a billing account (Firebase's "Blaze" plan) even to stay
   > within the free quota — Google Sign-in is free with no billing account needed. You can
   > enable just Google first and add Phone later.
3. **Authentication → Settings → Authorized domains** → add your production domain(s), e.g.
   `nvfresh.in` and `www.nvfresh.in` (`localhost` is included by default for local dev).
4. **Project settings (gear icon) → General → Your apps** → register a new **Web app** → copy
   the `firebaseConfig` values into `customer/.env`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```
5. The backend also needs to know your project ID, in `server/.env`:
   ```
   FIREBASE_PROJECT_ID=nvfresh-xxxxx
   ```
   (Same value as `VITE_FIREBASE_PROJECT_ID` above.) No service account key or other secret
   is needed on the backend — verifying a customer's sign-in only requires Google's public
   signing certs, fetched at `server/firebaseTokenVerify.js`, not a private credential.
6. Restart both the customer dev server and the backend (or redeploy, setting the same env
   vars in Vercel/Render's environment variable settings).

> Why not the `firebase-admin` SDK? It's the more common approach, but it's a large package
> with dependencies (gRPC, protobuf, etc.) that don't bundle reliably in serverless
> environments like Vercel. Token verification only needs the signature check against
> Google's public certs — `server/firebaseTokenVerify.js` does that directly with the
> `jsonwebtoken` package already used for admin auth, avoiding the bundling problem and the
> service-account secret entirely.

Orders placed before this was added won't have a linked customer identity, so they won't
appear in "My Orders" — only new orders placed after sign-in was enabled do.

## WhatsApp Order Notifications (optional)

When a customer places an order, the server can automatically alert the admin via WhatsApp
(and, once you're ready, send the customer a confirmation too) via the Meta WhatsApp Cloud
API. This is **off by default** — the app works normally without it, and just logs
`WhatsApp not configured — skipping ...`.

### Admin alert (start here)

1. Create a free app at [developers.facebook.com](https://developers.facebook.com) and add
   the **WhatsApp** product. Meta gives you a test phone number to start with.
2. From **WhatsApp → API Setup**, copy your **temporary access token** and **Phone Number ID**.
3. In **WhatsApp → Message Templates**, create and submit a template named `order_alert_admin`
   with a **Body** component and 4 placeholders:
   > New order #{{2}} from {{1}} — {{3}}. Customer phone: {{4}}.

   Template approval is usually quick, but isn't instant — submit it before testing.
4. Copy `server/.env.example` to `server/.env` and fill in:
   ```
   WHATSAPP_ACCESS_TOKEN=your_token_here
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
   WHATSAPP_ADMIN_TEMPLATE_NAME=order_alert_admin
   ```
5. Restart the server (`npm start`). New orders will now alert whatever phone number is set
   in **Admin → Settings** (the same one shown on the customer site's Contact Us page) — no
   separate admin number to configure.

### Customer confirmation (optional, once you want it)

This is off by default so you can turn on the admin alert first without also needing a
second approved template right away.

1. In **WhatsApp → Message Templates**, create and submit a template named
   `order_confirmation` with a **Body** component and 4 placeholders:
   > Hi {{1}}, your NvFresh order #{{2}} for {{3}} has been placed. Advance paid: {{4}}. Confirmed Saturday, delivered fresh this Sunday morning!
2. Add to `server/.env`:
   ```
   WHATSAPP_SEND_CUSTOMER_CONFIRMATION=true
   WHATSAPP_TEMPLATE_NAME=order_confirmation
   ```
3. Restart the server.

> Note: Meta's temporary tokens expire in 24 hours — for production use, generate a
> permanent token from a System User in Meta Business Manager.

## Deploying to Production (e.g. Vercel)

**Vercel only hosts the two frontends — it doesn't run the backend by default.**
`customer/` and `admin/` are static Vite builds, so they deploy to Vercel fine directly.
`server/` still needs to run somewhere as an actual Node process. If you deploy
`admin/` or `customer/` to Vercel by itself and try to log in or load products before
pointing them at a live backend, you'll get a **404** — there's nothing behind it to
answer `/api/...` requests yet.

The good news: now that the database is MongoDB Atlas instead of a local SQLite file,
the backend has no local-disk data to lose, which opens up more hosting options.

### Recommended: backend on Render/Railway, frontends on Vercel

1. **Deploy `server/` to** [Render](https://render.com) or [Railway](https://railway.app):
   - New Web Service → connect your GitHub repo → set the **root directory** to `server`
   - Build command: `npm install` · Start command: `npm start`
   - Add an environment variable `MONGODB_URI` with your Atlas connection string
   - Note the public URL you're given, e.g. `https://nvfresh-api.onrender.com`

2. **Deploy `customer/` and `admin/` to Vercel** as two separate projects (root directory
   `customer` and `admin` respectively) — each already has a `vercel.json` for SPA routing.

3. **In each Vercel project's settings → Environment Variables**, add:
   ```
   VITE_API_URL=https://nvfresh-api.onrender.com/api
   ```
   (using the URL from step 1). Redeploy — Vercel needs a fresh build to pick up the
   new env var.

This keeps the backend as a normal always-on server, which plays more predictably with
a persistent database connection than serverless functions do.

### Alternative: everything on Vercel

Since MongoDB now holds all your data, you *could* also convert `server/` into Vercel
serverless functions and deploy it as a third Vercel project. This is more involved
(wrapping the Express app for Vercel's function runtime, watching out for MongoDB
connection-pooling across cold starts) and isn't set up in this project yet — happy to
build that out if you'd rather go fully serverless.

### Fallback: offline demo login

If you just want to preview the **admin UI** without deploying a backend yet, the login
screen accepts `admin` / `nvfresh123` locally even with no API connection — it silently
falls back to a demo session if the real login request fails. This only gets you past
the login screen, though: pages like Products, Orders, and Customers still need
`VITE_API_URL` pointed at a real, running backend to show actual data.

## File Storage

Uploaded images (product photos, admin's QR code) go through a small storage
abstraction in `server/storage/` instead of talking to a specific backend directly.
Every provider implements the same two methods — `upload(buffer, meta) → { url, key }`
and `delete(key)` — so routes and models only ever handle the `url` string; they don't
know or care which backend produced it.

| `STORAGE_PROVIDER` | Where files live | Notes |
|---|---|---|
| `gridfs` (default) | Inside your MongoDB Atlas cluster (GridFS) | No extra service — just `MONGODB_URI`. Served back out at `/api/files/:id`. |
| `local` | `server/uploads/` on disk | Dev/fallback only. Wiped on redeploy on most hosts; doesn't work on Vercel serverless. |
| `s3` | Amazon S3 or any S3-compatible bucket (R2, Spaces, B2, MinIO) | Run `npm install @aws-sdk/client-s3`, set the `S3_*` vars in `.env`. Files are served directly from the bucket, not proxied through the API. |

Switching providers later (e.g. GridFS → S3 as you scale, or S3 → another cloud) is a
matter of setting env vars — no code changes, no data migration of the `image`/`qr_image`
fields, since they've always just stored a URL string. To add a brand-new backend
(Cloudinary, Azure Blob, GCS, etc.), write one class in `server/storage/` implementing
`StorageProvider` and add a case to the switch in `server/storage/index.js`; use
`S3StorageProvider.js` as a template.

Product photos also ship as generated placeholder SVGs in `server/uploads/seed/` so the
app runs out of the box with no external dependencies — those are static app assets, not
user uploads, and stay on disk regardless of `STORAGE_PROVIDER`. Swap in real photos from
the admin panel any time.

## Notes

- The payment page shows a QR **placeholder** icon plus the UPI ID/phone from Settings;
  swap in a real QR image via Admin → Settings → Upload QR Image.
- `JWT_SECRET` in `server/middleware/auth.js` is a dev default — change it before deploying.
