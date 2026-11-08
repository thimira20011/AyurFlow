import { apiGet, apiMutation } from "@/lib/api-client";

export type Room = { id: string; code: string; name: string; active: boolean };
export type Availability = { id: string; roomId: string | null; therapistId: string | null; startsAt: string; endsAt: string };
export type Session = {
  id: string; patientId: string; planId: string; stageId: string; roomId: string; therapistId: string;
  startsAt: string; endsAt: string; status: "booked" | "in_progress" | "completed" | "cancelled";
  observations: string | null; cancellationReason: string | null; version: number;
};
export type Booking = Pick<Session, "patientId" | "planId" | "stageId" | "roomId" | "therapistId" | "startsAt" | "endsAt">;

function range(start: string, end: string) {
  const params = new URLSearchParams({ start, end });
  return params.toString();
}

export const listRooms = () => apiGet<{ items: Room[] }>("/rooms");
export const createRoom = (code: string, name: string) => apiMutation<Room>("/rooms", { code, name });
export const listAvailability = (start: string, end: string) => apiGet<{ items: Availability[] }>(`/availability?${range(start, end)}`);
export const addAvailability = (input: Omit<Availability, "id">) => apiMutation<Availability>("/availability", input);
export const changeAvailability = (id: string, startsAt: string, endsAt: string) =>
  apiMutation<Availability>(`/availability/${encodeURIComponent(id)}/change`, { startsAt, endsAt });
export const listSessions = (start: string, end: string) => apiGet<{ items: Session[] }>(`/sessions?${range(start, end)}`);
export const bookSession = (input: Booking) => apiMutation<Session>("/sessions", input);
export const rescheduleSession = (id: string, input: Pick<Session, "roomId" | "therapistId" | "startsAt" | "endsAt" | "version">) =>
  apiMutation<Session>(`/sessions/${encodeURIComponent(id)}/reschedule`, input);
export const startSession = (id: string) => apiMutation<Session>(`/sessions/${encodeURIComponent(id)}/start`);
export const completeSession = (id: string, observations: string) => apiMutation<Session>(`/sessions/${encodeURIComponent(id)}/complete`, { observations });
export const cancelSession = (id: string, reason: string) => apiMutation<Session>(`/sessions/${encodeURIComponent(id)}/cancel`, { reason });
