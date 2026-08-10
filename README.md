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

Uploaded product/QR images are still stored on local disk in `server/uploads/` and
served at `/uploads/...` — this part didn't move to MongoDB (see **Notes** below).

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
| POST   | /products                  | Yes  | Create product                 |
| PUT    | /products/:id              | Yes  | Update product                 |
| DELETE | /products/:id              | Yes  | Delete product                 |
| POST   | /orders                    | No   | Place an order                 |
| GET    | /orders                    | Yes  | List all orders                |
| PUT    | /orders/:id/status         | Yes  | Update order status            |
| GET    | /customers                 | Yes  | List customers (`?search=`)    |
| POST   | /auth/login                | No   | Admin login → JWT              |
| POST   | /upload                    | Yes  | Upload an image (multipart)    |
| GET    | /settings                  | No   | Get business/payment settings  |
| PUT    | /settings                  | Yes  | Update settings                |
| GET    | /dashboard/stats           | Yes  | Aggregate dashboard stats      |

Authenticated routes expect `Authorization: Bearer <token>`.

## WhatsApp Order Notifications (optional)

When a customer places an order, the server can automatically send them a WhatsApp
confirmation via the Meta WhatsApp Cloud API. This is **off by default** — the app works
normally without it, and just logs `WhatsApp not configured — skipping order notification`.

To turn it on:

1. Create a free app at [developers.facebook.com](https://developers.facebook.com) and add
   the **WhatsApp** product. Meta gives you a test phone number to start with.
2. From **WhatsApp → API Setup**, copy your **temporary access token** and **Phone Number ID**.
3. In **WhatsApp → Message Templates**, create and submit a template named
   `order_confirmation` with a **Body** component containing 4 placeholders, e.g.:
   > Hi {{1}}, your NvFresh order #{{2}} for {{3}} has been placed. Advance paid: {{4}}. Confirmed Saturday, delivered fresh this Sunday morning!

   Template approval is usually quick, but isn't instant — submit it first.
4. Copy `server/.env.example` to `server/.env` and fill in the values:
   ```
   WHATSAPP_ACCESS_TOKEN=your_token_here
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
   WHATSAPP_TEMPLATE_NAME=order_confirmation
   ```
5. Restart the server (`npm start`). New orders will now trigger a WhatsApp message to the
   customer's phone number automatically.

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

## Notes

- Product photos ship as generated placeholder SVGs in `server/uploads/seed/` so the app
  runs out of the box with no external image dependencies — swap in real photos from the
  admin panel any time.
- The payment page shows a QR **placeholder** icon plus the UPI ID/phone from Settings;
  swap in a real QR image via Admin → Settings → Upload QR Image.
- `JWT_SECRET` in `server/middleware/auth.js` is a dev default — change it before deploying.
- **Image uploads still live on local disk**, not MongoDB. Product photos and the QR
  code you upload via the admin panel are saved to `server/uploads/` on whichever
  machine runs the backend. This works fine on Render/Railway between requests, but on
  most free tiers that disk gets wiped on redeploy or restart, and it won't work at all
  on Vercel serverless (read-only filesystem). If that becomes a problem, the fix is
  swapping Multer's local disk storage for a hosted file store like Cloudinary or S3 —
  ask if you'd like that built in.
