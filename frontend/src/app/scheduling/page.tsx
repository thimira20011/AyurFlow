import type { Metadata } from "next";
import { RoomTherapistScheduleView } from "@/features/scheduling/room-therapist-schedule-view";

export const metadata: Metadata = {
  title: "Room & Therapist Schedule · AyurFlow",
  description: "Living Heritage treatment room allocations, therapist rostering, and session clearance tracking.",
};

export default function Page() {
  return <RoomTherapistScheduleView />;
}
