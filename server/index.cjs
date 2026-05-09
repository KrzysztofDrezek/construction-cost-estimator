const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, "estimates.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
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
});

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

app.get("/api/estimates", (req, res) => {
  db.all("SELECT * FROM estimates ORDER BY id DESC", [], (error, rows) => {
    if (error) {
      return res.status(500).json({ error: "Failed to fetch estimates." });
    }

    const estimates = rows.map((row) => ({
      ...row,
      items: JSON.parse(row.items),
    }));

    res.json(estimates);
  });
});

app.get("/api/estimates/:id", (req, res) => {
  const { id } = req.params;

  db.get("SELECT * FROM estimates WHERE id = ?", [id], (error, row) => {
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
  });
});

app.post("/api/estimates", (req, res) => {
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
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
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

app.delete("/api/estimates/:id", (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM estimates WHERE id = ?", [id], function (error) {
    if (error) {
      return res.status(500).json({ error: "Failed to delete estimate." });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Estimate not found." });
    }

    res.json({ message: "Estimate deleted successfully." });
  });
});

app.get("/api/stores/nearby", async (req, res) => {
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