import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// True only after hydration, so nothing theme-specific renders on the server.
export function useMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
