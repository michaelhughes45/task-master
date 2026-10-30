// Pixel layout for one day column of the time grid. Pure: works on wall-clock minutes
// (0–1440) in the user's timezone, so DST days still put 9 AM at 9 AM.

export const HOUR_HEIGHT = 48;
export const DAY_MINUTES = 24 * 60;
// Short events are drawn at least this tall so the title stays readable.
const MIN_DRAWN_MINUTES = 30;
const DEFAULT_SCROLL_HOUR = 7;

// One event's part of a day, in wall-clock minutes from midnight. `end` may be 1440.
export interface DaySpan {
  id: string;
  start: number;
  end: number;
}

// Pixels from the top of the column; left and width are percentages of its width.
export interface EventLayout {
  id: string;
  top: number;
  height: number;
  left: number;
  width: number;
}

interface Placed {
  id: string;
  start: number;
  end: number;
  column: number;
}

export function minutesToPx(minutes: number) {
  return (minutes * HOUR_HEIGHT) / 60;
}

// The span as drawn: at least MIN_DRAWN_MINUTES tall and still inside the day.
function drawn({ id, start, end }: DaySpan) {
  const drawnStart = Math.min(start, DAY_MINUTES - MIN_DRAWN_MINUTES);
  return { id, start: drawnStart, end: Math.max(end, drawnStart + MIN_DRAWN_MINUTES) };
}

function toLayouts(cluster: Placed[], columns: number): EventLayout[] {
  return cluster.map(({ id, start, end, column }) => ({
    id,
    top: minutesToPx(start),
    height: minutesToPx(end - start),
    left: (column / columns) * 100,
    width: 100 / columns,
  }));
}

// Overlapping events share the width side by side. Events that touch (one ends as the next
// starts) don't overlap. A cluster is a chain of overlaps; everything in it gets the same
// width, and each event takes the first column that is free when it starts.
export function layoutDay(events: DaySpan[]): EventLayout[] {
  const sorted = events.map(drawn).sort((a, b) => a.start - b.start || b.end - a.end);
  const layouts: EventLayout[] = [];
  let cluster: Placed[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -1;

  for (const event of sorted) {
    if (event.start >= clusterEnd && cluster.length > 0) {
      layouts.push(...toLayouts(cluster, columnEnds.length));
      cluster = [];
      columnEnds = [];
    }
    let column = columnEnds.findIndex((end) => end <= event.start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = event.end;
    cluster.push({ ...event, column });
    clusterEnd = Math.max(clusterEnd, event.end);
  }
  layouts.push(...toLayouts(cluster, columnEnds.length));
  return layouts;
}

// The hour shown at the top on load: 7 AM, or an hour before the first event if that starts
// before 7 AM.
export function initialScrollHour(spans: DaySpan[]) {
  const first = Math.min(...spans.map((span) => span.start));
  if (spans.length === 0 || first >= DEFAULT_SCROLL_HOUR * 60) return DEFAULT_SCROLL_HOUR;
  return Math.max(0, Math.floor(first / 60) - 1);
}
