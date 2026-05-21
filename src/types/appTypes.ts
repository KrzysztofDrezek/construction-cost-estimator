export type QualityLevel = "budget" | "standard" | "premium";

export type PricingMode = "suggested" | "manual";

export type WorkTypeKey = "flooring" | "painting" | "glazing" | "partition";

export type Material = {
  name: string;
  unit: string;
  budget: number;
  standard: number;
  premium: number;
};

export type WorkType = {
  label: string;
  description: string;
  materials: Material[];
};

export type WorkTypes = Record<WorkTypeKey, WorkType>;

export type EstimateItem = {
  id: number;
  workType: string;
  area: number;
  pricingMode: PricingMode;
  quality: QualityLevel | "Manual";
  materialCostPerUnit: number;
  labourCostPerUnit: number;
  materialTotal: number;
  labourTotal: number;
  total: number;
};

export type SavedEstimate = {
  id: number;
  userId?: number;
  estimateNumber: string;
  projectName: string;
  projectNotes: string;
  items: EstimateItem[];
  vatRate: number;
  subtotal: number;
  vatTotal: number;
  finalTotal: number;
  createdAt: string;
};

export type AuthUser = {
  id: number;
  username: string;
};

export type StoreSearchLocation = {
  input: string;
  displayName: string;
  lat: number;
  lon: number;
  warning?: string;
};

export type StoreSearchLink = {
  id: string;
  title: string;
  description: string;
  url: string;
};

export type AuthMode = "login" | "register";