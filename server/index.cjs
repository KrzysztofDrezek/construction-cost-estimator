require("dotenv").config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const SQLiteStoreFactory = require("connect-sqlite3");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const SQLiteStore = SQLiteStoreFactory(session);

const app = express();
const PORT = process.env.PORT || 5000;

app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.db",
      dir: path.join(__dirname),
      table: "sessions",
      concurrentDB: true,
    }),
    secret: process.env.SESSION_SECRET || "fallback-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

const dbPath = path.join(__dirname, "estimates.db");
const db = new sqlite3.Database(dbPath);

const addColumnIfMissing = (tableName, columnName, columnDefinition) => {
  db.all(`PRAGMA table_info(${tableName})`, (error, columns) => {
    if (error) {
      console.error(`Failed to inspect ${tableName}:`, error.message);
      return;
    }

    const columnExists = columns.some((column) => column.name === columnName);

    if (!columnExists) {
      db.run(
        `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`,
        (alterError) => {
          if (alterError) {
            console.error(
              `Failed to add ${columnName} to ${tableName}:`,
              alterError.message
            );
          }
        }
      );
    }
  });
};

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      estimateNumber TEXT NOT NULL,
      projectName TEXT NOT NULL,
      projectNotes TEXT,
      items TEXT NOT NULL,
      vatRate REAL NOT NULL,
      subtotal REAL NOT NULL,
      vatTotal REAL NOT NULL,
      finalTotal REAL NOT NULL,
      createdAt TEXT NOT NULL
    )
  `);

  addColumnIfMissing("estimates", "userId", "INTEGER");
});

const requireAuth = (req, res, next) => {
  if (req.session?.userId) {
    next();
    return;
  }

  res.status(401).json({ error: "Authentication required." });
};

const isLikelyUkPostcode = (location) => {
  const postcodePattern =
    /^[A-Z]{1,2}[0-9][A-Z0-9]?\s?[0-9]?[A-Z]{0,2}$/i;

  return postcodePattern.test(location.trim());
};

const geocodeLocation = async (location) => {
  const cleanedLocation = location.trim();

  if (!isLikelyUkPostcode(cleanedLocation)) {
    return {
      lat: 51.5072,
      lon: -0.1276,
      displayName: `${cleanedLocation}, UK`,
      input: cleanedLocation,
      warning:
        "Town and area search is shown as a helper. For best accuracy, use a UK postcode.",
    };
  }

  const postcodeUrl = `https://api.postcodes.io/postcodes/${encodeURIComponent(
    cleanedLocation
  )}`;

  const postcodeResponse = await fetch(postcodeUrl);

  if (postcodeResponse.ok) {
    const postcodeData = await postcodeResponse.json();

    if (postcodeData.status === 200 && postcodeData.result) {
      return {
        lat: postcodeData.result.latitude,
        lon: postcodeData.result.longitude,
        displayName: `${postcodeData.result.postcode}, ${postcodeData.result.admin_district}`,
        input: cleanedLocation,
        warning: "",
      };
    }
  }

  const outwardCode = cleanedLocation.split(" ")[0];

  const outwardCodeUrl = `https://api.postcodes.io/outcodes/${encodeURIComponent(
    outwardCode
  )}`;

  const outwardCodeResponse = await fetch(outwardCodeUrl);

  if (outwardCodeResponse.ok) {
    const outwardCodeData = await outwardCodeResponse.json();

    if (outwardCodeData.status === 200 && outwardCodeData.result) {
      return {
        lat: outwardCodeData.result.latitude,
        lon: outwardCodeData.result.longitude,
        displayName: `${outwardCodeData.result.outcode}, UK`,
        input: cleanedLocation,
        warning:
          "Only the outward postcode area was found, so the map location is approximate.",
      };
    }
  }

  return null;
};

const createStoreSearchLinks = (location) => {
  const encodedLocation = encodeURIComponent(location);

  return [
    {
      id: "google-builders-merchants",
      title: "Builders merchants near this location",
      description: "Search Google Maps for builders merchants near the entered postcode.",
      url: `https://www.google.com/maps/search/builders+merchants+near+${encodedLocation}`,
    },
    {
      id: "google-bq",
      title: "B&Q near this location",
      description: "Search Google Maps for nearby B&Q stores.",
      url: `https://www.google.com/maps/search/B%26Q+near+${encodedLocation}`,
    },
    {
      id: "google-screwfix",
      title: "Screwfix near this location",
      description: "Search Google Maps for nearby Screwfix stores.",
      url: `https://www.google.com/maps/search/Screwfix+near+${encodedLocation}`,
    },
    {
      id: "google-toolstation",
      title: "Toolstation near this location",
      description: "Search Google Maps for nearby Toolstation stores.",
      url: `https://www.google.com/maps/search/Toolstation+near+${encodedLocation}`,
    },
    {
      id: "google-wickes",
      title: "Wickes near this location",
      description: "Search Google Maps for nearby Wickes stores.",
      url: `https://www.google.com/maps/search/Wickes+near+${encodedLocation}`,
    },
    {
      id: "osm-hardware",
      title: "OpenStreetMap hardware stores",
      description: "Open a map search for hardware and DIY stores in OpenStreetMap.",
      url: `https://www.openstreetmap.org/search?query=hardware%20store%20near%20${encodedLocation}`,
    },
  ];
};

app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body;

  const cleanUsername = username?.trim();

  if (!cleanUsername || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  if (cleanUsername.length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toLocaleDateString("en-GB");

    db.run(
      `
        INSERT INTO users (username, passwordHash, createdAt)
        VALUES (?, ?, ?)
      `,
      [cleanUsername, passwordHash, createdAt],
      function (error) {
        if (error) {
          if (error.message.includes("UNIQUE")) {
            return res.status(409).json({ error: "Username already exists." });
          }

          return res.status(500).json({ error: "Failed to create account." });
        }

        req.session.userId = this.lastID;
        req.session.username = cleanUsername;

        res.status(201).json({
          message: "Account created successfully.",
          user: {
            id: this.lastID,
            username: cleanUsername,
          },
        });
      }
    );
  } catch {
    res.status(500).json({ error: "Failed to register user." });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  const cleanUsername = username?.trim();

  if (!cleanUsername || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [cleanUsername],
    async (error, user) => {
      if (error) {
        return res.status(500).json({ error: "Failed to log in." });
      }

      if (!user) {
        return res.status(401).json({ error: "Invalid username or password." });
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);

      if (!passwordMatches) {
        return res.status(401).json({ error: "Invalid username or password." });
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({
        message: "Login successful.",
        user: {
          id: user.id,
          username: user.username,
        },
      });
    }
  );
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  res.json({
    user: {
      id: req.session.userId,
      username: req.session.username,
    },
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: "Failed to log out." });
    }

    res.clearCookie("connect.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.json({ message: "Logged out successfully." });
  });
});

app.get("/api/estimates", requireAuth, (req, res) => {
  db.all(
    "SELECT * FROM estimates WHERE userId = ? ORDER BY id DESC",
    [req.session.userId],
    (error, rows) => {
      if (error) {
        return res.status(500).json({ error: "Failed to fetch estimates." });
      }

      const estimates = rows.map((row) => ({
        ...row,
        items: JSON.parse(row.items),
      }));

      res.json(estimates);
    }
  );
});

app.get("/api/estimates/:id", requireAuth, (req, res) => {
  const { id } = req.params;

  db.get(
    "SELECT * FROM estimates WHERE id = ? AND userId = ?",
    [id, req.session.userId],
    (error, row) => {
      if (error) {
        return res.status(500).json({ error: "Failed to fetch estimate." });
      }

      if (!row) {
        return res.status(404).json({ error: "Estimate not found." });
      }

      res.json({
        ...row,
        items: JSON.parse(row.items),
      });
    }
  );
});

app.post("/api/estimates", requireAuth, (req, res) => {
  const {
    estimateNumber,
    projectName,
    projectNotes,
    items,
    vatRate,
    subtotal,
    vatTotal,
    finalTotal,
    createdAt,
  } = req.body;

  if (!projectName || !items || items.length === 0) {
    return res.status(400).json({ error: "Project name and items are required." });
  }

  const sql = `
    INSERT INTO estimates (
      userId,
      estimateNumber,
      projectName,
      projectNotes,
      items,
      vatRate,
      subtotal,
      vatTotal,
      finalTotal,
      createdAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    req.session.userId,
    estimateNumber,
    projectName,
    projectNotes,
    JSON.stringify(items),
    vatRate,
    subtotal,
    vatTotal,
    finalTotal,
    createdAt,
  ];

  db.run(sql, values, function (error) {
    if (error) {
      return res.status(500).json({ error: "Failed to save estimate." });
    }

    res.status(201).json({
      id: this.lastID,
      userId: req.session.userId,
      estimateNumber,
      projectName,
      projectNotes,
      items,
      vatRate,
      subtotal,
      vatTotal,
      finalTotal,
      createdAt,
    });
  });
});

app.delete("/api/estimates/:id", requireAuth, (req, res) => {
  const { id } = req.params;

  db.run(
    "DELETE FROM estimates WHERE id = ? AND userId = ?",
    [id, req.session.userId],
    function (error) {
      if (error) {
        return res.status(500).json({ error: "Failed to delete estimate." });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: "Estimate not found." });
      }

      res.json({ message: "Estimate deleted successfully." });
    }
  );
});

app.get("/api/stores/nearby", requireAuth, async (req, res) => {
  const location = req.query.location?.trim();

  if (!location) {
    return res.status(400).json({ error: "Location is required." });
  }

  try {
    const geocodedLocation = await geocodeLocation(location);

    if (!geocodedLocation) {
      return res.status(404).json({ error: "Location not found." });
    }

    res.json({
      searchLocation: {
        input: location,
        displayName: geocodedLocation.displayName,
        lat: geocodedLocation.lat,
        lon: geocodedLocation.lon,
        warning: geocodedLocation.warning,
      },
      stores: [],
      searchLinks: createStoreSearchLinks(location),
    });
  } catch (error) {
    console.error("Store helper failed:", error.message);

    res.status(500).json({
      error: "Failed to prepare nearby store search.",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});