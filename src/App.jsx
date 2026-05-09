import { useEffect, useState } from "react";
import "./App.css";

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

  const [savedEstimates, setSavedEstimates] = useState(() => {
    try {
      const storedEstimates = localStorage.getItem("constructionEstimates");
      const parsedEstimates = storedEstimates ? JSON.parse(storedEstimates) : [];

      return parsedEstimates.filter((estimate) => Array.isArray(estimate.items));
    } catch {
      return [];
    }
  });

  const selectedWork = workTypes[workType];

  useEffect(() => {
    localStorage.setItem("constructionEstimates", JSON.stringify(savedEstimates));
  }, [savedEstimates]);

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

  const handleSaveEstimate = () => {
    if (estimateItems.length === 0) {
      return;
    }

    const newEstimate = {
      id: Date.now(),
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

    setSavedEstimates([newEstimate, ...savedEstimates]);
    setProjectName("");
    setProjectNotes("");
    setEstimateItems([]);
  };

  const handleDeleteEstimate = (id) => {
    setSavedEstimates(savedEstimates.filter((estimate) => estimate.id !== id));
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

        {savedEstimates.length === 0 ? (
          <p className="empty-message">No saved estimates yet.</p>
        ) : (
          <div className="saved-list">
            {savedEstimates.map((estimate) => (
              <div className="saved-card" key={estimate.id}>
                <div>
                  <h3>{estimate.projectName}</h3>
                  <p className="estimate-number">{estimate.estimateNumber}</p>
                  <p>
                    {estimate.items.length} item(s) • VAT {estimate.vatRate}% •{" "}
                    {estimate.createdAt}
                  </p>
                  <p className="estimate-notes">{estimate.projectNotes}</p>
                </div>

                <strong>{formatCurrency(estimate.finalTotal)}</strong>

                <button type="button" onClick={() => handleDeleteEstimate(estimate.id)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;