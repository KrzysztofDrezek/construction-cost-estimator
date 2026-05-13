import { useEffect, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const API_URL = `${API_BASE_URL}/estimates`;
const STORES_API_URL = `${API_BASE_URL}/stores/nearby`;
const LOGIN_API_URL = `${API_BASE_URL}/auth/login`;
const REGISTER_API_URL = `${API_BASE_URL}/auth/register`;
const ME_API_URL = `${API_BASE_URL}/auth/me`;
const LOGOUT_API_URL = `${API_BASE_URL}/auth/logout`;

const userLocationIcon = L.divIcon({
  className: "user-location-marker",
  html: "<span>📍</span>",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

const workTypes = {
  flooring: {
    label: "Flooring",
    description: "Estimate flooring projects using material, underlay and labour costs.",
    materials: [
      {
        name: "Laminate flooring",
        unit: "m²",
        budget: 12,
        standard: 22,
        premium: 35,
      },
      {
        name: "Underlay",
        unit: "m²",
        budget: 3,
        standard: 6,
        premium: 10,
      },
    ],
  },
  painting: {
    label: "Painting",
    description: "Estimate interior painting jobs using paint, preparation and labour costs.",
    materials: [
      {
        name: "Emulsion paint",
        unit: "litre",
        budget: 4,
        standard: 8,
        premium: 15,
      },
      {
        name: "Rollers, brushes and masking tape",
        unit: "set",
        budget: 8,
        standard: 18,
        premium: 35,
      },
    ],
  },
  glazing: {
    label: "Glazing",
    description: "Estimate simple glazing work using glass, sealant and fitting costs.",
    materials: [
      {
        name: "Glass panel",
        unit: "m²",
        budget: 35,
        standard: 65,
        premium: 120,
      },
      {
        name: "Sealant and fixings",
        unit: "set",
        budget: 8,
        standard: 18,
        premium: 35,
      },
    ],
  },
  partition: {
    label: "Partition Wall",
    description: "Estimate partition wall projects using plasterboard, studs, screws and labour.",
    materials: [
      {
        name: "Plasterboard",
        unit: "board",
        budget: 9,
        standard: 14,
        premium: 22,
      },
      {
        name: "Studs, screws and jointing materials",
        unit: "set",
        budget: 25,
        standard: 45,
        premium: 75,
      },
    ],
  },
};

function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [projectName, setProjectName] = useState("");
  const [projectNotes, setProjectNotes] = useState("");

  const [workType, setWorkType] = useState("flooring");
  const [area, setArea] = useState(20);
  const [pricingMode, setPricingMode] = useState("suggested");
  const [quality, setQuality] = useState("standard");
  const [manualMaterialCost, setManualMaterialCost] = useState(20);
  const [labourCost, setLabourCost] = useState(25);

  const [vatRate, setVatRate] = useState(20);
  const [estimateItems, setEstimateItems] = useState([]);
  const [expandedEstimateId, setExpandedEstimateId] = useState(null);

  const [savedEstimates, setSavedEstimates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [storeSearch, setStoreSearch] = useState("");
  const [storeSearchLinks, setStoreSearchLinks] = useState([]);
  const [storeSearchLocation, setStoreSearchLocation] = useState(null);
  const [isStoreLoading, setIsStoreLoading] = useState(false);
  const [storeErrorMessage, setStoreErrorMessage] = useState("");

  const selectedWork = workTypes[workType];

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(ME_API_URL, {
          credentials: "include",
        });

        if (!response.ok) {
          setUser(null);
          return;
        }

        const data = await response.json();
        setUser(data.user);
      } catch {
        setUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const fetchEstimates = async () => {
      if (!user) {
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage("");

        const response = await fetch(API_URL, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch estimates.");
        }

        const data = await response.json();
        setSavedEstimates(data);
      } catch {
        setErrorMessage("Could not load saved estimates from the server.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEstimates();
  }, [user]);

  const suggestedMaterialCost = selectedWork.materials.reduce(
    (total, material) => total + material[quality],
    0
  );

  const materialCostPerUnit =
    pricingMode === "suggested" ? suggestedMaterialCost : Number(manualMaterialCost);

  const currentMaterialTotal = Number(area) * materialCostPerUnit;
  const currentLabourTotal = Number(area) * Number(labourCost);
  const currentItemTotal = currentMaterialTotal + currentLabourTotal;

  const subtotal = estimateItems.reduce((total, item) => total + item.total, 0);
  const vatTotal = subtotal * (Number(vatRate) / 100);
  const finalTotal = subtotal + vatTotal;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(value || 0);
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    const endpoint = authMode === "login" ? LOGIN_API_URL : REGISTER_API_URL;

    try {
      setAuthError("");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username: authUsername,
          password: authPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      setUser(data.user);
      setAuthUsername("");
      setAuthPassword("");
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(LOGOUT_API_URL, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
      setSavedEstimates([]);
      setEstimateItems([]);
      setExpandedEstimateId(null);
    }
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      workType: selectedWork.label,
      area: Number(area),
      pricingMode,
      quality: pricingMode === "suggested" ? quality : "Manual",
      materialCostPerUnit,
      labourCostPerUnit: Number(labourCost),
      materialTotal: currentMaterialTotal,
      labourTotal: currentLabourTotal,
      total: currentItemTotal,
    };

    setEstimateItems([...estimateItems, newItem]);
  };

  const handleRemoveItem = (id) => {
    setEstimateItems(estimateItems.filter((item) => item.id !== id));
  };

  const handleSaveEstimate = async () => {
    if (estimateItems.length === 0) {
      return;
    }

    const newEstimate = {
      estimateNumber: `EST-${Date.now().toString().slice(-6)}`,
      projectName: projectName.trim() || "Unnamed project",
      projectNotes: projectNotes.trim() || "No additional notes",
      items: estimateItems,
      vatRate: Number(vatRate),
      subtotal,
      vatTotal,
      finalTotal,
      createdAt: new Date().toLocaleDateString("en-GB"),
    };

    try {
      setErrorMessage("");

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(newEstimate),
      });

      if (!response.ok) {
        throw new Error("Failed to save estimate.");
      }

      const savedEstimate = await response.json();

      setSavedEstimates([savedEstimate, ...savedEstimates]);
      setProjectName("");
      setProjectNotes("");
      setEstimateItems([]);
    } catch {
      setErrorMessage("Could not save estimate to the server.");
    }
  };

  const handleDeleteEstimate = async (id) => {
    try {
      setErrorMessage("");

      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete estimate.");
      }

      setSavedEstimates(savedEstimates.filter((estimate) => estimate.id !== id));
    } catch {
      setErrorMessage("Could not delete estimate from the server.");
    }
  };

  const handleToggleEstimateDetails = (id) => {
    setExpandedEstimateId(expandedEstimateId === id ? null : id);
  };

  const handleStoreSearch = async () => {
    if (!storeSearch.trim()) {
      setStoreSearchLinks([]);
      setStoreSearchLocation(null);
      setStoreErrorMessage("Enter a UK postcode.");
      return;
    }

    try {
      setIsStoreLoading(true);
      setStoreErrorMessage("");
      setStoreSearchLinks([]);
      setStoreSearchLocation(null);

      const response = await fetch(
        `${STORES_API_URL}?location=${encodeURIComponent(storeSearch)}`,
        {
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to prepare store search.");
      }

      const data = await response.json();

      setStoreSearchLinks(data.searchLinks || []);
      setStoreSearchLocation(data.searchLocation || null);

      if (data.searchLocation?.warning) {
        setStoreErrorMessage(data.searchLocation.warning);
      }
    } catch {
      setStoreErrorMessage(
        "Could not prepare nearby store search. Try another UK postcode."
      );
    } finally {
      setIsStoreLoading(false);
    }
  };

  const handlePrintEstimate = (estimate) => {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      return;
    }

    const itemsHtml = estimate.items
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${item.workType}</td>
            <td>${item.area}</td>
            <td>${item.quality}</td>
            <td>${formatCurrency(item.materialTotal)}</td>
            <td>${formatCurrency(item.labourTotal)}</td>
            <td>${formatCurrency(item.total)}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${estimate.estimateNumber} - ${estimate.projectName}</title>
          <style>
            body {
              margin: 0;
              padding: 40px;
              font-family: Arial, sans-serif;
              color: #172033;
              background: #ffffff;
            }

            .document {
              max-width: 900px;
              margin: 0 auto;
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 30px;
              border-bottom: 3px solid #172033;
              padding-bottom: 24px;
              margin-bottom: 30px;
            }

            h1 {
              margin: 0 0 8px;
              font-size: 34px;
            }

            h2 {
              margin-top: 32px;
              font-size: 22px;
            }

            p {
              line-height: 1.6;
            }

            .meta {
              text-align: right;
            }

            .meta strong {
              display: block;
              font-size: 22px;
              margin-bottom: 8px;
            }

            .notes {
              padding: 16px;
              border-radius: 10px;
              background: #f4f6f8;
              margin-bottom: 28px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 14px;
            }

            th,
            td {
              border: 1px solid #d8deea;
              padding: 12px;
              text-align: left;
              font-size: 14px;
            }

            th {
              background: #172033;
              color: white;
            }

            .summary {
              margin-top: 28px;
              margin-left: auto;
              width: 320px;
              border: 1px solid #d8deea;
              border-radius: 12px;
              overflow: hidden;
            }

            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 14px 16px;
              border-bottom: 1px solid #d8deea;
            }

            .summary-row:last-child {
              border-bottom: none;
              background: #172033;
              color: white;
              font-weight: 700;
              font-size: 18px;
            }

            .footer {
              margin-top: 40px;
              padding-top: 18px;
              border-top: 1px solid #d8deea;
              color: #667085;
              font-size: 13px;
            }

            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>

        <body>
          <div class="document">
            <div class="header">
              <div>
                <h1>Project Estimate</h1>
                <p><strong>Project:</strong> ${estimate.projectName}</p>
                <p><strong>Estimate number:</strong> ${estimate.estimateNumber}</p>
              </div>

              <div class="meta">
                <strong>${formatCurrency(estimate.finalTotal)}</strong>
                <span>Date: ${estimate.createdAt}</span>
              </div>
            </div>

            <h2>Project notes</h2>
            <div class="notes">
              ${estimate.projectNotes}
            </div>

            <h2>Work breakdown</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Work type</th>
                  <th>Area / Qty</th>
                  <th>Pricing</th>
                  <th>Materials</th>
                  <th>Labour</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <div class="summary">
              <div class="summary-row">
                <span>Subtotal</span>
                <strong>${formatCurrency(estimate.subtotal)}</strong>
              </div>

              <div class="summary-row">
                <span>VAT (${estimate.vatRate}%)</span>
                <strong>${formatCurrency(estimate.vatTotal)}</strong>
              </div>

              <div class="summary-row">
                <span>Final total</span>
                <strong>${formatCurrency(estimate.finalTotal)}</strong>
              </div>
            </div>

            <div class="footer">
              This estimate was generated using Construction Project Cost Estimator.
              Material prices are indicative and may vary by supplier, product brand,
              availability and current promotions.
            </div>
          </div>

          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  if (isAuthLoading) {
    return (
      <main className="app">
        <section className="panel login-panel">
          <h1>Loading...</h1>
          <p className="empty-message">Checking your session.</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app">
        <section className="panel login-panel">
          <p className="eyebrow">Protected estimator dashboard</p>
          <h1>{authMode === "login" ? "Sign in" : "Create account"}</h1>
          <p>
            {authMode === "login"
              ? "Log in to access the Construction Project Cost Estimator dashboard."
              : "Create an account to save estimates and manage your own project records."}
          </p>

          <div className="auth-switch">
            <button
              type="button"
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
            >
              Sign in
            </button>

            <button
              type="button"
              className={authMode === "register" ? "active" : ""}
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
              }}
            >
              Create account
            </button>
          </div>

          <form className="login-form" onSubmit={handleAuthSubmit}>
            <label>
              Username
              <input
                type="text"
                value={authUsername}
                onChange={(event) => setAuthUsername(event.target.value)}
                placeholder="Enter username"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder={
                  authMode === "register"
                    ? "Minimum 6 characters"
                    : "Enter password"
                }
              />
            </label>

            {authError && <p className="error-message">{authError}</p>}

            <button className="save-button" type="submit">
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="eyebrow">Construction + IT portfolio project</p>
          <h1>Construction Project Cost Estimator</h1>
          <p>
            A practical tool for building multi-item estimates for small construction
            and renovation jobs using material costs, labour rates, VAT and nearby
            supplier search.
          </p>
        </div>

        <div className="hero-card">
          <span>Signed in as {user.username}</span>
          <strong>{formatCurrency(finalTotal)}</strong>
          <small>{estimateItems.length} item(s) added</small>

          <button className="logout-button" type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </section>

            <section className="coffee-banner">
        <div>
          <p className="eyebrow">Support the project</p>
          <h2>Like this estimator?</h2>
          <p>
            This project was built as a practical full-stack tool combining
            construction experience with software development. If you find it useful,
            you can support future improvements.
          </p>
        </div>

        <a
          href="https://buymeacoffee.com/KrzysztofDrezek"
          target="_blank"
          rel="noreferrer"
        >
          Buy me a coffee
        </a>
      </section>

      <section className="layout">
        <div className="panel form-panel">
          <h2>Project details</h2>

          <label>
            Project / client name
            <input
              type="text"
              placeholder="Example: Kitchen renovation"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
            />
          </label>

          <label>
            Project notes
            <textarea
              placeholder="Example: Build partition wall and paint the room."
              value={projectNotes}
              onChange={(event) => setProjectNotes(event.target.value)}
            />
          </label>

          <hr className="section-divider" />

          <h2>Add work item</h2>

          <label>
            Work type
            <select value={workType} onChange={(event) => setWorkType(event.target.value)}>
              {Object.entries(workTypes).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <p className="work-description">{selectedWork.description}</p>

          <label>
            Area / quantity
            <input
              type="number"
              min="1"
              value={area}
              onChange={(event) => setArea(event.target.value)}
            />
          </label>

          <div className="option-row">
            <button
              className={pricingMode === "suggested" ? "active" : ""}
              onClick={() => setPricingMode("suggested")}
              type="button"
            >
              Suggested prices
            </button>

            <button
              className={pricingMode === "manual" ? "active" : ""}
              onClick={() => setPricingMode("manual")}
              type="button"
            >
              Manual price
            </button>
          </div>

          {pricingMode === "suggested" ? (
            <label>
              Material quality level
              <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                <option value="budget">Budget</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </label>
          ) : (
            <label>
              Manual material cost per unit
              <input
                type="number"
                min="0"
                value={manualMaterialCost}
                onChange={(event) => setManualMaterialCost(event.target.value)}
              />
            </label>
          )}

          <label>
            Labour cost per unit
            <input
              type="number"
              min="0"
              value={labourCost}
              onChange={(event) => setLabourCost(event.target.value)}
            />
          </label>

          <div className="item-preview">
            <span>Current item total</span>
            <strong>{formatCurrency(currentItemTotal)}</strong>
          </div>

          <button className="add-button" type="button" onClick={handleAddItem}>
            Add item to estimate
          </button>

          <label className="vat-label">
            VAT rate %
            <input
              type="number"
              min="0"
              value={vatRate}
              onChange={(event) => setVatRate(event.target.value)}
            />
          </label>

          <button
            className="save-button"
            type="button"
            onClick={handleSaveEstimate}
            disabled={estimateItems.length === 0}
          >
            Save full estimate
          </button>
        </div>

        <div className="panel result-panel">
          <h2>Current estimate</h2>

          {estimateItems.length === 0 ? (
            <p className="empty-message">
              No work items added yet. Add flooring, painting, glazing or partition wall
              items to build a full estimate.
            </p>
          ) : (
            <div className="estimate-items-list">
              {estimateItems.map((item, index) => (
                <div className="estimate-item-card" key={item.id}>
                  <div>
                    <p className="item-index">Item {index + 1}</p>
                    <h3>{item.workType}</h3>
                    <p>
                      {item.area} units • {item.quality} • Materials{" "}
                      {formatCurrency(item.materialTotal)} • Labour{" "}
                      {formatCurrency(item.labourTotal)}
                    </p>
                  </div>

                  <strong>{formatCurrency(item.total)}</strong>

                  <button type="button" onClick={() => handleRemoveItem(item.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="summary-grid">
            <div>
              <span>Subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>

            <div>
              <span>VAT</span>
              <strong>{formatCurrency(vatTotal)}</strong>
            </div>

            <div className="total-box">
              <span>Final total</span>
              <strong>{formatCurrency(finalTotal)}</strong>
            </div>
          </div>

          <div className="price-guide">
            <h3>Material price guide</h3>
            <p>
              * Indicative UK material price ranges only. Actual prices may vary
              depending on supplier, product brand, availability and current promotions.
            </p>

            {selectedWork.materials.map((material) => (
              <div className="material-card" key={material.name}>
                <div>
                  <h4>{material.name}</h4>
                  <p>
                    Budget: {formatCurrency(material.budget)} / {material.unit}
                  </p>
                  <p>
                    Standard: {formatCurrency(material.standard)} / {material.unit}
                  </p>
                  <p>
                    Premium: {formatCurrency(material.premium)} / {material.unit}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel store-locator-panel">
        <div className="store-locator-header">
          <div>
            <h2>Nearby construction stores</h2>
            <p>
              Search by UK postcode. The map uses postcode coordinates, and the links
              open real store searches in external map services.
            </p>
          </div>
        </div>

        <div className="store-search-row">
          <input
            type="text"
            placeholder="Example: SE2 9HR, LS15, OX1"
            value={storeSearch}
            onChange={(event) => setStoreSearch(event.target.value)}
          />

          <button type="button" onClick={handleStoreSearch}>
            Find stores
          </button>
        </div>

        {storeErrorMessage && <p className="error-message">{storeErrorMessage}</p>}

        {isStoreLoading ? (
          <p className="empty-message">Preparing location search...</p>
        ) : storeSearchLocation ? (
          <div className="store-map-layout">
            <div className="map-wrapper">
              <MapContainer
                center={[storeSearchLocation.lat, storeSearchLocation.lon]}
                zoom={13}
                scrollWheelZoom={false}
                className="store-map"
                key={`${storeSearchLocation.lat}-${storeSearchLocation.lon}`}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Marker
                  position={[storeSearchLocation.lat, storeSearchLocation.lon]}
                  icon={userLocationIcon}
                >
                  <Popup>
                    <strong>Search location</strong>
                    <br />
                    {storeSearchLocation.displayName}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>

            <div className="store-results">
              <div className="location-card">
                <h3>Search location</h3>
                <p>{storeSearchLocation.displayName}</p>
                <p>
                  Use the links below to open real nearby store searches in map services.
                </p>
              </div>

              {storeSearchLinks.map((link) => (
                <a
                  className="store-link-card"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  key={link.id}
                >
                  <div>
                    <h3>{link.title}</h3>
                    <p>{link.description}</p>
                  </div>

                  <span>Open</span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <p className="empty-message">
            Try searching for a UK postcode to open nearby construction store searches.
          </p>
        )}
      </section>

      <section className="panel saved-panel">
        <h2>Saved estimates</h2>

        {errorMessage && <p className="error-message">{errorMessage}</p>}

        {isLoading ? (
          <p className="empty-message">Loading saved estimates...</p>
        ) : savedEstimates.length === 0 ? (
          <p className="empty-message">No saved estimates yet.</p>
        ) : (
          <div className="saved-list">
            {savedEstimates.map((estimate) => (
              <div className="saved-card" key={estimate.id}>
                <div className="saved-card-main">
                  <div>
                    <h3>{estimate.projectName}</h3>
                    <p className="estimate-number">{estimate.estimateNumber}</p>
                    <p>
                      {estimate.items?.length || 0} item(s) • VAT {estimate.vatRate}% •{" "}
                      {estimate.createdAt}
                    </p>
                    <p className="estimate-notes">{estimate.projectNotes}</p>
                  </div>

                  <strong>{formatCurrency(estimate.finalTotal)}</strong>

                  <div className="saved-actions">
                    <button
                      className="view-button"
                      type="button"
                      onClick={() => handleToggleEstimateDetails(estimate.id)}
                    >
                      {expandedEstimateId === estimate.id ? "Hide details" : "View details"}
                    </button>

                    <button type="button" onClick={() => handleDeleteEstimate(estimate.id)}>
                      Delete
                    </button>
                  </div>
                </div>

                {expandedEstimateId === estimate.id && (
                  <div className="estimate-details">
                    <div className="details-header">
                      <h4>Estimate breakdown</h4>

                      <button
                        className="print-button"
                        type="button"
                        onClick={() => handlePrintEstimate(estimate)}
                      >
                        Print estimate
                      </button>
                    </div>

                    <div className="details-items">
                      {estimate.items?.map((item, index) => (
                        <div className="details-item" key={item.id}>
                          <div>
                            <p className="item-index">Item {index + 1}</p>
                            <h5>{item.workType}</h5>
                            <p>
                              Area / quantity: <strong>{item.area}</strong>
                            </p>
                            <p>
                              Pricing: <strong>{item.quality}</strong>
                            </p>
                          </div>

                          <div>
                            <p>
                              Materials: <strong>{formatCurrency(item.materialTotal)}</strong>
                            </p>
                            <p>
                              Labour: <strong>{formatCurrency(item.labourTotal)}</strong>
                            </p>
                            <p>
                              Item total: <strong>{formatCurrency(item.total)}</strong>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="details-summary">
                      <p>
                        Subtotal: <strong>{formatCurrency(estimate.subtotal)}</strong>
                      </p>
                      <p>
                        VAT: <strong>{formatCurrency(estimate.vatTotal)}</strong>
                      </p>
                      <p>
                        Final total: <strong>{formatCurrency(estimate.finalTotal)}</strong>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;