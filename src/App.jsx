import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api/estimates";

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
        stores: ["B&Q", "Wickes", "Homebase"],
      },
      {
        name: "Underlay",
        unit: "m²",
        budget: 3,
        standard: 6,
        premium: 10,
        stores: ["B&Q", "Screwfix", "Toolstation"],
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
        stores: ["B&Q", "Wickes", "Dulux Decorator Centre"],
      },
      {
        name: "Rollers, brushes and masking tape",
        unit: "set",
        budget: 8,
        standard: 18,
        premium: 35,
        stores: ["Toolstation", "Screwfix", "B&Q"],
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
        stores: ["B&Q", "Wickes", "Specialist supplier"],
      },
      {
        name: "Sealant and fixings",
        unit: "set",
        budget: 8,
        standard: 18,
        premium: 35,
        stores: ["Toolstation", "Screwfix", "B&Q"],
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
        stores: ["B&Q", "Wickes", "Selco"],
      },
      {
        name: "Studs, screws and jointing materials",
        unit: "set",
        budget: 25,
        standard: 45,
        premium: 75,
        stores: ["Toolstation", "Screwfix", "B&Q"],
      },
    ],
  },
};

function App() {
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

  const selectedWork = workTypes[workType];

  useEffect(() => {
  const fetchEstimates = async () => {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(API_URL);

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
}, []);

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

  const handleToggleEstimateDetails = (id) => {
  setExpandedEstimateId(expandedEstimateId === id ? null : id);
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
            Material prices are indicative and may vary by supplier, brand and availability.
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
      });

      if (!response.ok) {
        throw new Error("Failed to delete estimate.");
      }

      setSavedEstimates(savedEstimates.filter((estimate) => estimate.id !== id));
    } catch {
      setErrorMessage("Could not delete estimate from the server.");
    }
  };

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="eyebrow">Construction + IT portfolio project</p>
          <h1>Construction Project Cost Estimator</h1>
          <p>
            A practical tool for building multi-item estimates for small construction
            and renovation jobs using material costs, labour rates and VAT.
          </p>
        </div>

        <div className="hero-card">
          <span>Current estimate</span>
          <strong>{formatCurrency(finalTotal)}</strong>
          <small>{estimateItems.length} item(s) added</small>
        </div>
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
              Typical UK material price ranges. Prices are indicative and may vary
              by supplier, brand and availability.
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

                <div className="store-list">
                  {material.stores.map((store) => (
                    <span key={store}>{store}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
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