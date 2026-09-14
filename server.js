"use strict";

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

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || "test_database";
const JWT_SECRET = process.env.JWT_SECRET;

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "admin@himaanix.com";

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "change-this-admin-password";

const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://himaanix-frontend.vercel.app";

const PORT = process.env.PORT || 8001;

if (!MONGO_URL) {
  console.error("[fatal] MONGO_URL environment variable is missing");
}

if (!JWT_SECRET) {
  console.error("[fatal] JWT_SECRET environment variable is missing");
}

const JWT_ALG = "HS256";

const uuid = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// MongoDB connection - Vercel serverless safe
// ---------------------------------------------------------------------------

let cachedClient = null;
let cachedDb = null;
let dbPromise = null;

async function getDB() {
  if (cachedDb) {
    return cachedDb;
  }

  if (!MONGO_URL) {
    throw new Error("MONGO_URL environment variable is missing");
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      const client = new MongoClient(MONGO_URL, {
        serverSelectionTimeoutMS: 10000,
      });

      await client.connect();

      const db = client.db(DB_NAME);

      cachedClient = client;
      cachedDb = db;

      console.log("[mongodb] Connected to database:", DB_NAME);

      return db;
    })().catch((error) => {
      dbPromise = null;
      cachedClient = null;
      cachedDb = null;

      console.error("[mongodb] Connection failed:", error);

      throw error;
    });
  }

  return dbPromise;
}

// ---------------------------------------------------------------------------
// Order tracking
// ---------------------------------------------------------------------------

const TRACKING_STAGES = [
  {
    key: "confirmed",
    label: "Confirmed",
    minutes: 0,
  },
  {
    key: "packed",
    label: "Packed",
    minutes: 2,
  },
  {
    key: "shipped",
    label: "Shipped",
    minutes: 5,
  },
  {
    key: "delivered",
    label: "Delivered",
    minutes: 10,
  },
];

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const IMG = (id) =>
  `https://images.unsplash.com/${id}?w=1000&q=80&auto=format&fit=crop`;

const WOMEN_IMGS = [
  [
    "photo-1490481651871-ab68de25d43d",
    "photo-1483985988355-763728e1935b",
    "photo-1595777457583-95e059d581b8",
  ],
  [
    "photo-1585487000160-6ebcfceb0d03",
    "photo-1539109136881-3be0616acf4b",
    "photo-1571908599407-cdb918ed83bf",
  ],
  [
    "photo-1594633312681-425c7b97ccd1",
    "photo-1509631179647-0177331693ae",
    "photo-1548624313-0396c75e4b1a",
  ],
  [
    "photo-1576995853123-5a10305d93c0",
    "photo-1608228088998-57828365d486",
    "photo-1618354691373-d851c5c3a990",
  ],
  [
    "photo-1591047139829-d91aecb6caea",
    "photo-1544441893-675973e31985",
    "photo-1490481651871-ab68de25d43d",
  ],
  [
    "photo-1541099649105-f69ad21f3246",
    "photo-1594633312681-425c7b97ccd1",
    "photo-1603252109303-2751441dd157",
  ],
  [
    "photo-1564257577-2d3ee9a7f7b1",
    "photo-1571908599407-cdb918ed83bf",
    "photo-1483985988355-763728e1935b",
  ],
  [
    "photo-1608228088998-57828365d486",
    "photo-1618354691373-d851c5c3a990",
    "photo-1576566588028-4147f3842f27",
  ],
];

const MEN_IMGS = [
  [
    "photo-1490578474895-699cd4e2cf59",
    "photo-1516826957135-700dedea698c",
    "photo-1552374196-1ab2a1c593e8",
  ],
  [
    "photo-1520975916090-3105956dac38",
    "photo-1552374196-c4480e293c21",
    "photo-1611601679872-6b4b64bcdd6f",
  ],
  [
    "photo-1541580621-cd769892f7b0",
    "photo-1516826957135-700dedea698c",
    "photo-1617137968427-85924c800a22",
  ],
  [
    "photo-1602810318383-e386cc2a3ccf",
    "photo-1489987707025-afc232f7ea0f",
    "photo-1603252109303-2751441dd157",
  ],
  [
    "photo-1552374196-1ab2a1c593e8",
    "photo-1611601679872-6b4b64bcdd6f",
    "photo-1516826957135-700dedea698c",
  ],
  [
    "photo-1541099649105-f69ad21f3246",
    "photo-1602810318383-e386cc2a3ccf",
    "photo-1594633312681-425c7b97ccd1",
  ],
  [
    "photo-1617137968427-85924c800a22",
    "photo-1490578474895-699cd4e2cf59",
    "photo-1552374196-1ab2a1c593e8",
  ],
  [
    "photo-1520975916090-3105956dac38",
    "photo-1516826957135-700dedea698c",
    "photo-1552374196-c4480e293c21",
  ],
];

const KIDS_IMGS = [
  [
    "photo-1519689680058-324335c77eba",
    "photo-1543269664-56d93c1b41a6",
    "photo-1522771930-78848d9293e8",
  ],
  [
    "photo-1587616211892-f743fcca64f9",
    "photo-1519689680058-324335c77eba",
    "photo-1543269664-56d93c1b41a6",
  ],
  [
    "photo-1522771930-78848d9293e8",
    "photo-1587616211892-f743fcca64f9",
    "photo-1519689680058-324335c77eba",
  ],
  [
    "photo-1543269664-56d93c1b41a6",
    "photo-1522771930-78848d9293e8",
    "photo-1587616211892-f743fcca64f9",
  ],
  [
    "photo-1519689680058-324335c77eba",
    "photo-1587616211892-f743fcca64f9",
    "photo-1522771930-78848d9293e8",
  ],
  [
    "photo-1543269664-56d93c1b41a6",
    "photo-1519689680058-324335c77eba",
    "photo-1587616211892-f743fcca64f9",
  ],
];

const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL"];

const KID_SIZES = ["2Y", "4Y", "6Y", "8Y", "10Y"];

const DEFAULT_DESC =
  "A wardrobe essential crafted from premium fabrics, tailored for a refined silhouette that transitions from day into evening.";

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
  mk({
    id: "w-101",
    name: "Cashmere Draped Blazer",
    price: 189,
    old_price: 249,
    category: "women",
    is_popular: true,
    collection: "Winter Monochrome",
    colors: ["Ivory", "Camel", "Charcoal"],
    images: WOMEN_IMGS[0],
  }),

  mk({
    id: "w-102",
    name: "Silk Slip Midi Dress",
    price: 145,
    category: "women",
    is_new: true,
    is_popular: true,
    colors: ["Espresso", "Sand"],
    images: WOMEN_IMGS[1],
  }),

  mk({
    id: "w-103",
    name: "Wool Tailored Trouser",
    price: 129,
    category: "women",
    is_popular: true,
    colors: ["Camel", "Espresso", "Ivory"],
    images: WOMEN_IMGS[2],
  }),

  mk({
    id: "w-104",
    name: "Oversized Knit Sweater",
    price: 98,
    old_price: 139,
    category: "women",
    is_new: true,
    colors: ["Cream", "Sand"],
    images: WOMEN_IMGS[3],
  }),

  mk({
    id: "w-105",
    name: "Editorial Trench Coat",
    price: 269,
    category: "women",
    is_popular: true,
    collection: "Signature",
    colors: ["Camel", "Espresso"],
    images: WOMEN_IMGS[4],
  }),

  mk({
    id: "w-106",
    name: "High-Waist Denim",
    price: 79,
    category: "women",
    is_new: true,
    colors: ["Ecru", "Deep Indigo"],
    images: WOMEN_IMGS[5],
  }),

  mk({
    id: "w-107",
    name: "Silk Neckerchief Blouse",
    price: 115,
    category: "women",
    colors: ["Ivory", "Camel"],
    images: WOMEN_IMGS[6],
  }),

  mk({
    id: "w-108",
    name: "Merino Turtleneck",
    price: 89,
    category: "women",
    is_popular: true,
    colors: ["Cream", "Espresso", "Camel"],
    images: WOMEN_IMGS[7],
  }),

  // MEN
  mk({
    id: "m-201",
    name: "Structured Wool Overcoat",
    price: 289,
    category: "men",
    is_new: true,
    collection: "Signature",
    colors: ["Camel", "Charcoal"],
    images: MEN_IMGS[0],
  }),

  mk({
    id: "m-202",
    name: "Fine Gauge Merino Sweater",
    price: 119,
    category: "men",
    is_popular: true,
    colors: ["Ivory", "Espresso", "Olive"],
    images: MEN_IMGS[1],
  }),

  mk({
    id: "m-203",
    name: "Slim Tailored Chino",
    price: 89,
    category: "men",
    is_popular: true,
    colors: ["Camel", "Stone", "Espresso"],
    images: MEN_IMGS[2],
  }),

  mk({
    id: "m-204",
    name: "Cotton Poplin Shirt",
    price: 79,
    old_price: 99,
    category: "men",
    colors: ["White", "Sand"],
    images: MEN_IMGS[3],
  }),

  mk({
    id: "m-205",
    name: "Cashmere Blend Cardigan",
    price: 179,
    category: "men",
    is_new: true,
    colors: ["Cream", "Camel"],
    images: MEN_IMGS[4],
  }),

  mk({
    id: "m-206",
    name: "Selvedge Denim Jean",
    price: 129,
    category: "men",
    is_popular: true,
    colors: ["Raw Indigo", "Ecru"],
    images: MEN_IMGS[5],
  }),

  mk({
    id: "m-207",
    name: "Linen Blend Trouser",
    price: 99,
    category: "men",
    colors: ["Sand", "Espresso"],
    images: MEN_IMGS[6],
  }),

  mk({
    id: "m-208",
    name: "Heritage Wool Blazer",
    price: 249,
    category: "men",
    collection: "Signature",
    colors: ["Charcoal", "Camel"],
    images: MEN_IMGS[7],
  }),

  // KIDS
  mk({
    id: "k-301",
    name: "Organic Cotton Tee",
    price: 29,
    category: "kids",
    is_popular: true,
    sizes: KID_SIZES,
    colors: ["Cream", "Sand"],
    images: KIDS_IMGS[0],
  }),

  mk({
    id: "k-302",
    name: "Cozy Knit Jumper",
    price: 49,
    category: "kids",
    is_new: true,
    sizes: KID_SIZES.slice(0, 4),
    colors: ["Camel", "Ivory"],
    images: KIDS_IMGS[1],
  }),

  mk({
    id: "k-303",
    name: "Soft Denim Overall",
    price: 59,
    category: "kids",
    sizes: KID_SIZES.slice(0, 4),
    colors: ["Ecru"],
    images: KIDS_IMGS[2],
  }),

  mk({
    id: "k-304",
    name: "Wool Blend Coat",
    price: 89,
    category: "kids",
    is_new: true,
    is_popular: true,
    sizes: KID_SIZES.slice(1),
    colors: ["Camel", "Espresso"],
    images: KIDS_IMGS[3],
  }),

  mk({
    id: "k-305",
    name: "Corduroy Trouser",
    price: 39,
    category: "kids",
    sizes: KID_SIZES.slice(0, 4),
    colors: ["Sand", "Espresso"],
    images: KIDS_IMGS[4],
  }),

  mk({
    id: "k-306",
    name: "Cotton Poplin Dress",
    price: 45,
    category: "kids",
    is_new: true,
    sizes: KID_SIZES.slice(0, 4),
    colors: ["Ivory", "Sand"],
    images: KIDS_IMGS[5],
  }),
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signAccessToken(userId, email) {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is missing");
  }

  return jwt.sign(
    {
      sub: userId,
      email,
      type: "access",
    },
    JWT_SECRET,
    {
      algorithm: JWT_ALG,
      expiresIn: "7d",
    }
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

function isValidEmail(email) {
  return (
    typeof email === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.access_token;

    if (!token) {
      const header = req.headers.authorization || "";

      if (header.startsWith("Bearer ")) {
        token = header.slice(7);
      }
    }

    if (!token) {
      return res.status(401).json({
        detail: "Not authenticated",
      });
    }

    if (!JWT_SECRET) {
      return res.status(500).json({
        detail: "JWT_SECRET is not configured",
      });
    }

    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: [JWT_ALG],
    });

    if (payload.type !== "access") {
      return res.status(401).json({
        detail: "Invalid token type",
      });
    }

    const db = await getDB();

    const user = await db.collection("users").findOne(
      {
        id: payload.sub,
      },
      {
        projection: {
          password_hash: 0,
          _id: 0,
        },
      }
    );

    if (!user) {
      return res.status(401).json({
        detail: "User not found",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("[auth]", error);

    return res.status(401).json({
      detail:
        error.name === "TokenExpiredError"
          ? "Token expired"
          : "Invalid token",
    });
  }
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

function buildTracking(order) {
  const createdAt = new Date(order.created_at).getTime();

  const now = Date.now();

  const overrideIdx = order.status_override
    ? TRACKING_STAGES.findIndex(
        (stage) => stage.key === order.status_override
      )
    : -1;

  const timeline = TRACKING_STAGES.map((stage, index) => {
    const target = new Date(
      createdAt + stage.minutes * 60 * 1000
    );

    const reached =
      overrideIdx >= index ||
      now >= target.getTime();

    return {
      key: stage.key,
      label: stage.label,
      target_at: target.toISOString(),
      completed_at: reached
        ? target.toISOString()
        : null,
      completed: reached,
    };
  });

  const lastDone = [...timeline]
    .reverse()
    .find((stage) => stage.completed);

  const current = lastDone
    ? lastDone.key
    : "confirmed";

  const estimatedDelivery =
    timeline[timeline.length - 1].target_at;

  return {
    timeline,
    current_status: current,
    estimated_delivery: estimatedDelivery,
  };
}

function serializeOrder(order) {
  const tracking = buildTracking(order);

  return {
    id: order.id,
    user_id: order.user_id,
    user_email: order.user_email,
    items: order.items,
    address: order.address,
    subtotal: order.subtotal,
    shipping: order.shipping,
    total: order.total,
    payment_method: order.payment_method,
    status: tracking.current_status,
    created_at: order.created_at,
    tracking,
  };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const app = express();

app.use(
  express.json({
    limit: "1mb",
  })
);

app.use(cookieParser());

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
  })
);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get("/", (_req, res) => {
  res.json({
    service: "HIMAANIX API",
    status: "ok",
    runtime: "node",
  });
});

app.get("/health", async (_req, res) => {
  try {
    const db = await getDB();

    await db.command({
      ping: 1,
    });

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("[health]", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
      detail: error.message,
    });
  }
});

// ---------------------------------------------------------------------------
// Database middleware for /api
// ---------------------------------------------------------------------------

app.use("/api", async (req, res, next) => {
  try {
    const db = await getDB();

    req.app.locals.db = db;

    next();
  } catch (error) {
    console.error("[database]", error);

    res.status(500).json({
      detail: "Database connection failed",
      error: error.message,
    });
  }
});

const api = express.Router();

// ---------------------------------------------------------------------------
// API health
// ---------------------------------------------------------------------------

api.get("/", (_req, res) => {
  res.json({
    service: "HIMAANIX API",
    status: "ok",
    runtime: "node",
  });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

api.get("/products", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const query = {};

    if (req.query.category) {
      query.category = req.query.category;
    }

    if (req.query.is_new !== undefined) {
      query.is_new = req.query.is_new === "true";
    }

    if (req.query.is_popular !== undefined) {
      query.is_popular = req.query.is_popular === "true";
    }

    if (req.query.collection) {
      query.collection = req.query.collection;
    }

    const products = await db
      .collection("products")
      .find(
        query,
        {
          projection: {
            _id: 0,
          },
        }
      )
      .limit(500)
      .toArray();

    res.json({
      products,
    });
  } catch (error) {
    console.error("[products]", error);

    res.status(500).json({
      detail: error.message || "Unable to fetch products",
    });
  }
});

api.get("/products/:id", async (req, res) => {
  try {
    const db = req.app.locals.db;

    const product = await db
      .collection("products")
      .findOne(
        {
          id: req.params.id,
        },
        {
          projection: {
            _id: 0,
          },
        }
      );

    if (!product) {
      return res.status(404).json({
        detail: "Product not found",
      });
    }

    res.json(product);
  } catch (error) {
    console.error("[product]", error);

    res.status(500).json({
      detail: error.message || "Unable to fetch product",
    });
  }
});

// ---------------------------------------------------------------------------
// Auth - Register
// ---------------------------------------------------------------------------

api.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body || {};

    if (!isValidEmail(email)) {
      return res.status(400).json({
        detail: "Invalid email",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 6
    ) {
      return res.status(400).json({
        detail: "Password must be at least 6 characters",
      });
    }

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        detail: "Name is required",
      });
    }

    const db = req.app.locals.db;

    const normalizedEmail =
      email.toLowerCase().trim();

    const existing = await db
      .collection("users")
      .findOne({
        email: normalizedEmail,
      });

    if (existing) {
      return res.status(400).json({
        detail: "Email already registered",
      });
    }

    const userDoc = {
      id: uuid(),
      email: normalizedEmail,
      password_hash: await hashPassword(password),
      name: name.trim(),
      role: "customer",
      created_at: new Date().toISOString(),
    };

    await db
      .collection("users")
      .insertOne(userDoc);

    const token = signAccessToken(
      userDoc.id,
      normalizedEmail
    );

    setAuthCookie(res, token);

    res.json({
      user: {
        id: userDoc.id,
        email: normalizedEmail,
        name: userDoc.name,
        role: "customer",
      },
      access_token: token,
    });
  } catch (error) {
    console.error("[register]", error);

    res.status(500).json({
      detail: error.message || "Registration failed",
    });
  }
});

// ---------------------------------------------------------------------------
// Auth - Login
// ---------------------------------------------------------------------------

api.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      !isValidEmail(email) ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        detail: "Invalid credentials",
      });
    }

    const db = req.app.locals.db;

    const normalizedEmail =
      email.toLowerCase().trim();

    const user = await db
      .collection("users")
      .findOne({
        email: normalizedEmail,
      });

    if (
      !user ||
      !(await verifyPassword(
        password,
        user.password_hash
      ))
    ) {
      return res.status(401).json({
        detail: "Invalid email or password",
      });
    }

    const token = signAccessToken(
      user.id,
      normalizedEmail
    );

    setAuthCookie(res, token);

    res.json({
      user: {
        id: user.id,
        email: normalizedEmail,
        name: user.name,
        role: user.role || "customer",
      },
      access_token: token,
    });
  } catch (error) {
    console.error("[login]", error);

    res.status(500).json({
      detail: error.message || "Login failed",
    });
  }
});

// ---------------------------------------------------------------------------
// Auth - Logout
// ---------------------------------------------------------------------------

api.post("/auth/logout", (_req, res) => {
  res.clearCookie("access_token", {
    path: "/",
  });

  res.json({
    ok: true,
  });
});

// ---------------------------------------------------------------------------
// Auth - Current user
// ---------------------------------------------------------------------------

api.get("/auth/me", requireAuth, (req, res) => {
  const {
    id,
    email,
    name,
    role,
  } = req.user;

  res.json({
    user: {
      id,
      email,
      name,
      role: role || "customer",
    },
  });
});

// ---------------------------------------------------------------------------
// Orders - Create
// ---------------------------------------------------------------------------

api.post("/orders", requireAuth, async (req, res) => {
  try {
    const {
      items,
      address,
      subtotal,
      shipping = 0,
      total,
      payment_method = "COD",
    } = req.body || {};

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        detail: "No items in order",
      });
    }

    if (
      !address ||
      typeof address !== "object"
    ) {
      return res.status(400).json({
        detail: "Delivery address is required",
      });
    }

    const db = req.app.locals.db;

    const orderId =
      "HX-" +
      crypto
        .randomBytes(5)
        .toString("hex")
        .toUpperCase();

    const orderDoc = {
      id: orderId,
      user_id: req.user.id,
      user_email: req.user.email,
      items,
      address,
      subtotal: Number(subtotal) || 0,
      shipping: Number(shipping) || 0,
      total: Number(total) || 0,
      payment_method,
      status_override: null,
      created_at: new Date().toISOString(),
    };

    await db
      .collection("orders")
      .insertOne(orderDoc);

    res.json({
      order_id: orderId,
      status: "confirmed",
      message:
        "Your order has been placed successfully.",
    });
  } catch (error) {
    console.error("[create order]", error);

    res.status(500).json({
      detail:
        error.message || "Unable to create order",
    });
  }
});

// ---------------------------------------------------------------------------
// Orders - User orders
// ---------------------------------------------------------------------------

api.get("/orders", requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;

    const orders = await db
      .collection("orders")
      .find(
        {
          user_id: req.user.id,
        },
        {
          projection: {
            _id: 0,
          },
        }
      )
      .sort({
        created_at: -1,
      })
      .limit(200)
      .toArray();

    res.json({
      orders: orders.map(serializeOrder),
    });
  } catch (error) {
    console.error("[orders]", error);

    res.status(500).json({
      detail:
        error.message || "Unable to fetch orders",
    });
  }
});

// ---------------------------------------------------------------------------
// Orders - Single order
// ---------------------------------------------------------------------------

api.get(
  "/orders/:id",
  requireAuth,
  async (req, res) => {
    try {
      const db = req.app.locals.db;

      const order = await db
        .collection("orders")
        .findOne(
          {
            id: req.params.id,
            user_id: req.user.id,
          },
          {
            projection: {
              _id: 0,
            },
          }
        );

      if (!order) {
        return res.status(404).json({
          detail: "Order not found",
        });
      }

      res.json(
        serializeOrder(order)
      );
    } catch (error) {
      console.error(
        "[single order]",
        error
      );

      res.status(500).json({
        detail:
          error.message ||
          "Unable to fetch order",
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Admin - Update order status
// ---------------------------------------------------------------------------

api.patch(
  "/orders/:id/status",
  requireAuth,
  async (req, res) => {
    try {
      if (
        (req.user.role || "customer") !==
        "admin"
      ) {
        return res.status(403).json({
          detail: "Admin only",
        });
      }

      const { status } = req.body || {};

      if (
        !TRACKING_STAGES.some(
          (stage) => stage.key === status
        )
      ) {
        return res.status(400).json({
          detail: "Invalid status",
        });
      }

      const db = req.app.locals.db;

      const result = await db
        .collection("orders")
        .findOneAndUpdate(
          {
            id: req.params.id,
          },
          {
            $set: {
              status_override: status,
            },
          },
          {
            returnDocument: "after",
            projection: {
              _id: 0,
            },
          }
        );

      const order =
        result?.value || result;

      if (!order) {
        return res.status(404).json({
          detail: "Order not found",
        });
      }

      res.json(
        serializeOrder(order)
      );
    } catch (error) {
      console.error(
        "[admin status]",
        error
      );

      res.status(500).json({
        detail:
          error.message ||
          "Unable to update order status",
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Newsletter
// ---------------------------------------------------------------------------

api.post(
  "/newsletter",
  async (req, res) => {
    try {
      const { email } = req.body || {};

      if (!isValidEmail(email)) {
        return res.status(400).json({
          detail:
            "Please enter a valid email.",
        });
      }

      const db = req.app.locals.db;

      const normalizedEmail =
        email.toLowerCase().trim();

      await db
        .collection("newsletter")
        .updateOne(
          {
            email: normalizedEmail,
          },
          {
            $set: {
              email: normalizedEmail,
              created_at:
                new Date().toISOString(),
            },
          },
          {
            upsert: true,
          }
        );

      res.json({
        ok: true,
        message:
          "You're on the list.",
      });
    } catch (error) {
      console.error(
        "[newsletter]",
        error
      );

      res.status(500).json({
        detail:
          error.message ||
          "Newsletter subscription failed",
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Mount API
// ---------------------------------------------------------------------------

app.use("/api", api);

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------

app.use("/api", (_req, res) => {
  res.status(404).json({
    detail: "Not found",
  });
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

app.use(
  (err, _req, res, _next) => {
    console.error("[error]", err);

    res.status(500).json({
      detail:
        err.message ||
        "Internal server error",
    });
  }
);

// ---------------------------------------------------------------------------
// Vercel
// IMPORTANT: DO NOT use app.listen() on Vercel
// ---------------------------------------------------------------------------

module.exports = app;

// ---------------------------------------------------------------------------
// Local development only
// ---------------------------------------------------------------------------

if (require.main === module) {
  app.listen(
    PORT,
    "0.0.0.0",
    () => {
      console.log(
        `[himaanix] API running on http://localhost:${PORT}`
      );
    }
  );
}
