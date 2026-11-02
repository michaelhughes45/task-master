export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type Failure = Extract<ActionResult<never>, { success: false }>;
