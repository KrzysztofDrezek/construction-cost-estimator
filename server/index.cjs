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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});