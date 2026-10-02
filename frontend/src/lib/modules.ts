export const modules = [
  { id: "MOD-05", slug: "patients", title: "Patient records", description: "Registration, consultations and dated addenda." },
  { id: "MOD-01", slug: "clinical", title: "Clinical pathway", description: "Ordered treatment stages and clinician decisions." },
  { id: "MOD-02", slug: "scheduling", title: "Scheduling", description: "Rooms, therapist availability and treatment sessions." },
  { id: "MOD-03", slug: "inventory", title: "Inventory & preparation", description: "Botanical batches, recipes and patient traceability." },
  { id: "MOD-04", slug: "billing", title: "Invoices & receipts", description: "Itemized invoices, deposits and recorded receipts." },
  { id: "MOD-06", slug: "administration", title: "Administration", description: "Staff accounts, roles, reference data and audit history." },
] as const;

export type ModuleSlug = (typeof modules)[number]["slug"];
