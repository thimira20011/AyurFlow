export interface DashboardSession {
  id: string;
  time: string;
  patient: string;
  therapist: string;
  room: string;
  status: "Booked";
}

// Synthetic fixtures until a reviewed dashboard/scheduling API is available.
export const overviewMetrics = [
  { label: "Sessions today", value: "12" },
  { label: "Expected arrivals", value: "06" },
  { label: "Rooms in use", value: "03" },
] as const;

export const upcomingSessions: DashboardSession[] = [
  { id: "DEMO-SES-001", time: "09:30", patient: "Nimali Perera", therapist: "Demo Therapist A", room: "Treatment room 01", status: "Booked" },
  { id: "DEMO-SES-002", time: "10:30", patient: "Saman Jayasinghe", therapist: "Demo Therapist B", room: "Treatment room 02", status: "Booked" },
  { id: "DEMO-SES-003", time: "11:00", patient: "Amali Silva", therapist: "Demo Therapist A", room: "Treatment room 01", status: "Booked" },
];
