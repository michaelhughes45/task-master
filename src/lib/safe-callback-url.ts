export const DEFAULT_CALLBACK_URL = "/today";

const BASE = "http://local.invalid";

// Control characters and backslashes; browsers treat "\" like "/", so "/\host" would leave the site.
const UNSAFE_CHARS = /[\u0000-\u001f\\]/;

// Only same-origin paths are followed; anything else (absolute URLs, "//host", "/\host") falls back.
export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || UNSAFE_CHARS.test(value)) {
    return DEFAULT_CALLBACK_URL;
  }

  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return DEFAULT_CALLBACK_URL;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_CALLBACK_URL;
  }
}
