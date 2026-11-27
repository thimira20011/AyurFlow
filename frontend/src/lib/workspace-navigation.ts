export const workspaces = [
  { role: "receptionist", title: "Reception", home: "/reception", links: [
    { label: "Overview", href: "/reception" },
    { label: "Patients", href: "/patients" }, { label: "Schedule", href: "/scheduling" },
  ] },
  { role: "clinician", title: "Clinical", home: "/clinical", links: [
    { label: "Overview", href: "/workspace" }, { label: "Consultations", href: "/clinical" },
    { label: "Care plans", href: "/clinical/plans" }, { label: "Sessions", href: "/scheduling" },
  ] },
  { role: "therapist", title: "Therapist", home: "/scheduling", links: [
    { label: "Overview", href: "/workspace" }, { label: "My sessions", href: "/scheduling" },
  ] },
  { role: "dispensary", title: "Dispensary", home: "/inventory", links: [
    { label: "Overview", href: "/workspace" }, { label: "Stock & batches", href: "/inventory" },
    { label: "Stock and traceability report", href: "/reports/inventory" },
  ] },
  { role: "billing", title: "Billing", home: "/billing", links: [
    { label: "Overview", href: "/workspace" }, { label: "Invoices", href: "/billing" },
  ] },
  { role: "report_reader", title: "Reports", home: "/billing", links: [
    { label: "Overview", href: "/workspace" }, { label: "Outstanding invoices", href: "/billing" },
    { label: "Stock and traceability report", href: "/reports/inventory" },
  ] },
  { role: "administrator", title: "Administration", home: "/administration", links: [
    { label: "Overview", href: "/workspace" }, { label: "Staff & roles", href: "/administration" },
    { label: "Clinician assignments", href: "/administration/clinical-assignments" },
  ] },
] as const;

export function workspaceFor(roles: string[], section?: string) {
  const available = workspaces.filter(workspace => roles.includes(workspace.role));
  return available.find(workspace => workspace.title === section)
    ?? (section === "Billing" ? available.find(workspace => workspace.role === "report_reader") : undefined)
    ?? (section === "Reports" ? available.find(workspace => workspace.role === "dispensary") : undefined)
    ?? available[0];
}
