import type { EventColor } from "@/types/events";

// Tailwind classes for an event's colour, shared by the calendar, Today and the event dialogs.

// Dots, swatches and the details dialog's colour square.
export const EVENT_SOLID_CLASS: Record<EventColor, string> = {
  BLUE: "bg-primary",
  GREEN: "bg-success",
};

// Event blocks and all-day bars.
export const EVENT_SOFT_CLASS: Record<EventColor, string> = {
  BLUE: "bg-primary-soft text-primary-ink",
  GREEN: "bg-success-soft text-success-ink",
};

// The selected swatch in the colour picker.
export const EVENT_RING_CLASS: Record<EventColor, string> = {
  BLUE: "ring-primary",
  GREEN: "ring-success",
};
