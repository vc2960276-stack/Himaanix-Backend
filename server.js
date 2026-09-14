"use strict";

require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
MONGO_URL = "mongodb+srv://vc2960276_db_user:VS4ohu2sZNRpsV3W@cluster0.ng9wd2l.mongodb.net/"
DB_NAME = "test_database"
CORS_ORIGINS = "*"
JWT_SECRET = "9a7b3f2e1c4d5f6789ab0cde1f234567890abcdef1234567890abcdef1234567"
ADMIN_EMAIL = "admin@himaanix.com"
ADMIN_PASSWORD = "admin123"
FRONTEND_URL = "https://himaanix-frontend.vercel.app"
if (!MONGO_URL || !DB_NAME || !JWT_SECRET) {
  console.error("[fatal] Missing MONGO_URL / DB_NAME / JWT_SECRET in environment");
  process.exit(1);
}

const JWT_ALG = "HS256";
const uuid = () => crypto.randomUUID();

// Order tracking configuration (in minutes; demo cadence so users see the
// timeline progress quickly instead of days).
const TRACKING_STAGES = [
  { key: "confirmed", label: "Confirmed",  minutes: 0   },
  { key: "packed",    label: "Packed",     minutes: 2   },
  { key: "shipped",   label: "Shipped",    minutes: 5   },
  { key: "delivered", label: "Delivered",  minutes: 10  },
];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
const IMG = (id) => `https://images.unsplash.com/${id}?w=1000&q=80&auto=format&fit=crop`;

const WOMEN_IMGS = [
  ["photo-1490481651871-ab68de25d43d", "photo-1483985988355-763728e1935b", "photo-1595777457583-95e059d581b8"],
  ["photo-1585487000160-6ebcfceb0d03", "photo-1539109136881-3be0616acf4b", "photo-1571908599407-cdb918ed83bf"],
  ["photo-1594633312681-425c7b97ccd1", "photo-1509631179647-0177331693ae", "photo-1548624313-0396c75e4b1a"],
  ["photo-1576995853123-5a10305d93c0", "photo-1608228088998-57828365d486", "photo-1618354691373-d851c5c3a990"],
  ["photo-1591047139829-d91aecb6caea", "photo-1544441893-675973e31985", "photo-1490481651871-ab68de25d43d"],
  ["photo-1541099649105-f69ad21f3246", "photo-1594633312681-425c7b97ccd1", "photo-1603252109303-2751441dd157"],
  ["photo-1564257577-2d3ee9a7f7b1", "photo-1571908599407-cdb918ed83bf", "photo-1483985988355-763728e1935b"],
  ["photo-1608228088998-57828365d486", "photo-1618354691373-d851c5c3a990", "photo-1576566588028-4147f3842f27"],
];
const MEN_IMGS = [
  ["photo-1490578474895-699cd4e2cf59", "photo-1516826957135-700dedea698c", "photo-1552374196-1ab2a1c593e8"],
  ["photo-1520975916090-3105956dac38", "photo-1552374196-c4480e293c21", "photo-1611601679872-6b4b64bcdd6f"],
  ["photo-1541580621-cd769892f7b0", "photo-1516826957135-700dedea698c", "photo-1617137968427-85924c800a22"],
  ["photo-1602810318383-e386cc2a3ccf", "photo-1489987707025-afc232f7ea0f", "photo-1603252109303-2751441dd157"],
  ["photo-1552374196-1ab2a1c593e8", "photo-1611601679872-6b4b64bcdd6f", "photo-1516826957135-700dedea698c"],
  ["photo-1541099649105-f69ad21f3246", "photo-1602810318383-e386cc2a3ccf", "photo-1594633312681-425c7b97ccd1"],
  ["photo-1617137968427-85924c800a22", "photo-1490578474895-699cd4e2cf59", "photo-1552374196-1ab2a1c593e8"],
  ["photo-1520975916090-3105956dac38", "photo-1516826957135-700dedea698c", "photo-1552374196-c4480e293c21"],
];
const KIDS_IMGS = [
  ["photo-1519689680058-324335c77eba", "photo-1543269664-56d93c1b41a6", "photo-1522771930-78848d9293e8"],
  ["photo-1587616211892-f743fcca64f9", "photo-1519689680058-324335c77eba", "photo-1543269664-56d93c1b41a6"],
  ["photo-1522771930-78848d9293e8", "photo-1587616211892-f743fcca64f9", "photo-1519689680058-324335c77eba"],
  ["photo-1543269664-56d93c1b41a6", "photo-1522771930-78848d9293e8", "photo-1587616211892-f743fcca64f9"],
  ["photo-1519689680058-324335c77eba", "photo-1587616211892-f743fcca64f9", "photo-1522771930-78848d9293e8"],
  ["photo-1543269664-56d93c1b41a6", "photo-1519689680058-324335c77eba", "photo-1587616211892-f743fcca64f9"],
];

const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL"];
const KID_SIZES     = ["2Y", "4Y", "6Y", "8Y", "10Y"];
const DEFAULT_DESC  = "A wardrobe essential crafted from premium fabrics, tailored for a refined silhouette that transitions from day into evening.";
const DEFAULT_DETAILS = [
  "Premium fabric composition",
  "Regular fit — true to size",
  "Machine wash cold, tumble dry low",
  "Imported. Ethically produced.",
];

const mk = (o) => ({
  id: o.id,
  name: o.name,
  price: o.price,
  old_price: o.old_price ?? null,
  category: o.category,
  collection: o.collection ?? null,
  is_new: !!o.is_new,
  is_popular: !!o.is_popular,
  sizes: o.sizes || DEFAULT_SIZES,
  colors: o.colors || ["Ivory", "Camel", "Espresso"],
  description: o.description || DEFAULT_DESC,
  details: o.details || DEFAULT_DETAILS,
  images: (o.images || []).map(IMG),
});

const SEED_PRODUCTS = [
  // WOMEN
  mk({ id: "w-101", name: "Cashmere Draped Blazer", price: 189, old_price: 249, category: "women", is_popular: true, collection: "Winter Monochrome", colors: ["Ivory", "Camel", "Charcoal"], images: WOMEN_IMGS[0] }),
  mk({ id: "w-102", name: "Silk Slip Midi Dress",   price: 145, category: "women", is_new: true, is_popular: true, colors: ["Espresso", "Sand"], images: WOMEN_IMGS[1] }),
  mk({ id: "w-103", name: "Wool Tailored Trouser",  price: 129, category: "women", is_popular: true, colors: ["Camel", "Espresso", "Ivory"], images: WOMEN_IMGS[2] }),
  mk({ id: "w-104", name: "Oversized Knit Sweater", price: 98,  old_price: 139, category: "women", is_new: true, colors: ["Cream", "Sand"], images: WOMEN_IMGS[3] }),
  mk({ id: "w-105", name: "Editorial Trench Coat",  price: 269, category: "women", is_popular: true, collection: "Signature", colors: ["Camel", "Espresso"], images: WOMEN_IMGS[4] }),
  mk({ id: "w-106", name: "High-Waist Denim",       price: 79,  category: "women", is_new: true, colors: ["Ecru", "Deep Indigo"], images: WOMEN_IMGS[5] }),
  mk({ id: "w-107", name: "Silk Neckerchief Blouse", price: 115, category: "women", colors: ["Ivory", "Camel"], images: WOMEN_IMGS[6] }),
  mk({ id: "w-108", name: "Merino Turtleneck",      price: 89,  category: "women", is_popular: true, colors: ["Cream", "Espresso", "Camel"], images: WOMEN_IMGS[7] }),
  // MEN
  mk({ id: "m-201", name: "Structured Wool Overcoat", price: 289, category: "men", is_new: true, collection: "Signature", colors: ["Camel", "Charcoal"], images: MEN_IMGS[0] }),
  mk({ id: "m-202", name: "Fine Gauge Merino Sweater", price: 119, category: "men", is_popular: true, colors: ["Ivory", "Espresso", "Olive"], images: MEN_IMGS[1] }),
  mk({ id: "m-203", name: "Slim Tailored Chino",       price: 89,  category: "men", is_popular: true, colors: ["Camel", "Stone", "Espresso"], images: MEN_IMGS[2] }),
  mk({ id: "m-204", name: "Cotton Poplin Shirt",       price: 79,  old_price: 99, category: "men", colors: ["White", "Sand"], images: MEN_IMGS[3] }),
  mk({ id: "m-205", name: "Cashmere Blend Cardigan",   price: 179, category: "men", is_new: true, colors: ["Cream", "Camel"], images: MEN_IMGS[4] }),
  mk({ id: "m-206", name: "Selvedge Denim Jean",       price: 129, category: "men", is_popular: true, colors: ["Raw Indigo", "Ecru"], images: MEN_IMGS[5] }),
  mk({ id: "m-207", name: "Linen Blend Trouser",       price: 99,  category: "men", colors: ["Sand", "Espresso"], images: MEN_IMGS[6] }),
  mk({ id: "m-208", name: "Heritage Wool Blazer",      price: 249, category: "men", collection: "Signature", colors: ["Charcoal", "Camel"], images: MEN_IMGS[7] }),
  // KIDS
  mk({ id: "k-301", name: "Organic Cotton Tee",  price: 29, category: "kids", is_popular: true, sizes: KID_SIZES, colors: ["Cream", "Sand"], images: KIDS_IMGS[0] }),
  mk({ id: "k-302", name: "Cozy Knit Jumper",    price: 49, category: "kids", is_new: true, sizes: KID_SIZES.slice(0, 4), colors: ["Camel", "Ivory"], images: KIDS_IMGS[1] }),
  mk({ id: "k-303", name: "Soft Denim Overall",  price: 59, category: "kids", sizes: KID_SIZES.slice(0, 4), colors: ["Ecru"], images: KIDS_IMGS[2] }),
  mk({ id: "k-304", name: "Wool Blend Coat",     price: 89, category: "kids", is_new: true, is_popular: true, sizes: KID_SIZES.slice(1), colors: ["Camel", "Espresso"], images: KIDS_IMGS[3] }),
  mk({ id: "k-305", name: "Corduroy Trouser",    price: 39, category: "kids", sizes: KID_SIZES.slice(0, 4), colors: ["Sand", "Espresso"], images: KIDS_IMGS[4] }),
  mk({ id: "k-306", name: "Cotton Poplin Dress", price: 45, category: "kids", is_new: true, sizes: KID_SIZES.slice(0, 4), colors: ["Ivory", "Sand"], images: KIDS_IMGS[5] }),
];

// ---------------------------------------------------------------------------
// Helpers: auth, tracking
// ---------------------------------------------------------------------------
async function hashPassword(pw) { return bcrypt.hash(pw, 10); }
async function verifyPassword(pw, hash) { return bcrypt.compare(pw, hash); }

function signAccessToken(userId, email) {
  return jwt.sign(
    { sub: userId, email, type: "access" },
    JWT_SECRET,
    { algorithm: JWT_ALG, expiresIn: "7d" }
  );
}

function setAuthCookie(res, token) {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 7 * 24 * 3600 * 1000,
  });
}

async function requireAuth(req, res, next) {
  let token = req.cookies?.access_token;
  if (!token) {
    const h = req.headers.authorization || "";
    if (h.startsWith("Bearer ")) token = h.slice(7);
  }
  if (!token) return res.status(401).json({ detail: "Not authenticated" });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALG] });
    if (payload.type !== "access") return res.status(401).json({ detail: "Invalid token type" });
    const user = await req.app.locals.db.collection("users").findOne(
      { id: payload.sub },
      { projection: { password_hash: 0, _id: 0 } }
    );
    if (!user) return res.status(401).json({ detail: "User not found" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ detail: e.name === "TokenExpiredError" ? "Token expired" : "Invalid token" });
  }
}

// Compute tracking timeline + effective status for an order given its
// creation time and any manual overrides (admin can bump status forward).
function buildTracking(order) {
  const createdAt = new Date(order.created_at).getTime();
  const now = Date.now();
  const overrideIdx = order.status_override
    ? TRACKING_STAGES.findIndex((s) => s.key === order.status_override)
    : -1;

  const timeline = TRACKING_STAGES.map((s, i) => {
    const target = new Date(createdAt + s.minutes * 60 * 1000);
    const reached = overrideIdx >= i || now >= target.getTime();
    return {
      key: s.key,
      label: s.label,
      target_at: target.toISOString(),
      completed_at: reached ? target.toISOString() : null,
      completed: reached,
    };
  });

  // Current stage = the last completed one; default confirmed.
  const lastDone = [...timeline].reverse().find((s) => s.completed);
  const current = lastDone ? lastDone.key : "confirmed";
  const estimatedDelivery = timeline[timeline.length - 1].target_at;

  return { timeline, current_status: current, estimated_delivery: estimatedDelivery };
}

function serializeOrder(o) {
  const tracking = buildTracking(o);
  return {
    id: o.id,
    user_id: o.user_id,
    user_email: o.user_email,
    items: o.items,
    address: o.address,
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
    payment_method: o.payment_method,
    status: tracking.current_status,
    created_at: o.created_at,
    tracking,
  };
}

function isValidEmail(e) {
  return typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------
async function main() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  const db = client.db(DB_NAME);

  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  // Seed products idempotently (upsert)
  for (const p of SEED_PRODUCTS) {
    await db.collection("products").updateOne({ id: p.id }, { $set: p }, { upsert: true });
  }

  // Seed admin
  const existingAdmin = await db.collection("users").findOne({ email: ADMIN_EMAIL });
  if (!existingAdmin) {
    await db.collection("users").insertOne({
      id: uuid(),
      email: ADMIN_EMAIL,
      password_hash: await hashPassword(ADMIN_PASSWORD),
      name: "HIMAANIX Admin",
      role: "admin",
      created_at: new Date().toISOString(),
    });
  }

  const app = express();
  app.locals.db = db;

  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: [FRONTEND_URL, "http://localhost:3000"],
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  const api = express.Router();

  // ------------------------------------------------------------- Products
  api.get("/", (_req, res) => res.json({ service: "HIMAANIX API", status: "ok", runtime: "node" }));

  api.get("/products", async (req, res) => {
    const q = {};
    if (req.query.category) q.category = req.query.category;
    if (req.query.is_new !== undefined) q.is_new = req.query.is_new === "true";
    if (req.query.is_popular !== undefined) q.is_popular = req.query.is_popular === "true";
    if (req.query.collection) q.collection = req.query.collection;
    const docs = await db.collection("products").find(q, { projection: { _id: 0 } }).limit(500).toArray();
    res.json({ products: docs });
  });

  api.get("/products/:id", async (req, res) => {
    const doc = await db.collection("products").findOne({ id: req.params.id }, { projection: { _id: 0 } });
    if (!doc) return res.status(404).json({ detail: "Product not found" });
    res.json(doc);
  });

  // ------------------------------------------------------------- Auth
  api.post("/auth/register", async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ detail: "Invalid email" });
    if (typeof password !== "string" || password.length < 6)
      return res.status(400).json({ detail: "Password must be at least 6 characters" });
    if (typeof name !== "string" || !name.trim())
      return res.status(400).json({ detail: "Name is required" });

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.collection("users").findOne({ email: normalizedEmail });
    if (existing) return res.status(400).json({ detail: "Email already registered" });

    const userDoc = {
      id: uuid(),
      email: normalizedEmail,
      password_hash: await hashPassword(password),
      name: name.trim(),
      role: "customer",
      created_at: new Date().toISOString(),
    };
    await db.collection("users").insertOne(userDoc);
    const token = signAccessToken(userDoc.id, normalizedEmail);
    setAuthCookie(res, token);
    res.json({
      user: { id: userDoc.id, email: normalizedEmail, name: userDoc.name, role: "customer" },
      access_token: token,
    });
  });

  api.post("/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || typeof password !== "string")
      return res.status(400).json({ detail: "Invalid credentials" });

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.collection("users").findOne({ email: normalizedEmail });
    if (!user || !(await verifyPassword(password, user.password_hash)))
      return res.status(401).json({ detail: "Invalid email or password" });

    const token = signAccessToken(user.id, normalizedEmail);
    setAuthCookie(res, token);
    res.json({
      user: { id: user.id, email: normalizedEmail, name: user.name, role: user.role || "customer" },
      access_token: token,
    });
  });

  api.post("/auth/logout", (_req, res) => {
    res.clearCookie("access_token", { path: "/" });
    res.json({ ok: true });
  });

  api.get("/auth/me", requireAuth, (req, res) => {
    const { id, email, name, role } = req.user;
    res.json({ user: { id, email, name, role: role || "customer" } });
  });

  // ------------------------------------------------------------- Orders
  api.post("/orders", requireAuth, async (req, res) => {
    const { items, address, subtotal, shipping = 0, total, payment_method = "COD" } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ detail: "No items in order" });
    if (!address || typeof address !== "object") return res.status(400).json({ detail: "Delivery address is required" });

    const orderId = "HX-" + crypto.randomBytes(5).toString("hex").toUpperCase();
    const doc = {
      id: orderId,
      user_id: req.user.id,
      user_email: req.user.email,
      items,
      address,
      subtotal: Number(subtotal) || 0,
      shipping: Number(shipping) || 0,
      total: Number(total) || 0,
      payment_method,
      status_override: null, // admin can set to advance beyond time-based derivation
      created_at: new Date().toISOString(),
    };
    await db.collection("orders").insertOne(doc);
    res.json({ order_id: orderId, status: "confirmed", message: "Your order has been placed successfully." });
  });

  api.get("/orders", requireAuth, async (req, res) => {
    const docs = await db
      .collection("orders")
      .find({ user_id: req.user.id }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .limit(200)
      .toArray();
    res.json({ orders: docs.map(serializeOrder) });
  });

  api.get("/orders/:id", requireAuth, async (req, res) => {
    const doc = await db.collection("orders").findOne(
      { id: req.params.id, user_id: req.user.id },
      { projection: { _id: 0 } }
    );
    if (!doc) return res.status(404).json({ detail: "Order not found" });
    res.json(serializeOrder(doc));
  });

  // Admin/demo: advance order status manually (bumps status_override to the requested stage).
  api.patch("/orders/:id/status", requireAuth, async (req, res) => {
    if ((req.user.role || "customer") !== "admin")
      return res.status(403).json({ detail: "Admin only" });
    const { status } = req.body || {};
    if (!TRACKING_STAGES.some((s) => s.key === status))
      return res.status(400).json({ detail: "Invalid status" });
    const result = await db.collection("orders").findOneAndUpdate(
      { id: req.params.id },
      { $set: { status_override: status } },
      { returnDocument: "after", projection: { _id: 0 } }
    );
    const doc = result?.value || result;
    if (!doc) return res.status(404).json({ detail: "Order not found" });
    res.json(serializeOrder(doc));
  });

  // ------------------------------------------------------------- Newsletter
  api.post("/newsletter", async (req, res) => {
    const { email } = req.body || {};
    if (!isValidEmail(email)) return res.status(400).json({ detail: "Please enter a valid email." });
    await db.collection("newsletter").updateOne(
      { email: email.toLowerCase().trim() },
      { $set: { email: email.toLowerCase().trim(), created_at: new Date().toISOString() } },
      { upsert: true }
    );
    res.json({ ok: true, message: "You're on the list." });
  });

  app.use("/api", api);

  // Fallthrough 404 for /api/* to keep JSON responses consistent
  app.use("/api", (_req, res) => res.status(404).json({ detail: "Not found" }));

  // Error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error("[error]", err);
    res.status(500).json({ detail: err.message || "Internal server error" });
  });

  const port = Number(process.env.PORT || 8001);
  app.listen(port, "0.0.0.0", () => {
    console.log(`[himaanix] Node/Express API listening on 0.0.0.0:${port} (products=${SEED_PRODUCTS.length})`);
  });
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
