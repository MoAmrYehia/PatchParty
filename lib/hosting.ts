type BuildEnvironment = { BASE_URL?: string; VITE_GITHUB_PAGES?: string };
const buildEnvironment = (import.meta as ImportMeta & { env?: BuildEnvironment }).env;

export function normalizeBasePath(value: string): string {
  const path = value.replace(/^\/+|\/+$/g, "");
  return path ? `/${path}/` : "/";
}

export const APP_BASE_PATH = normalizeBasePath(buildEnvironment?.BASE_URL || "/");
export const STATIC_HOST = buildEnvironment?.VITE_GITHUB_PAGES === "true";

export function assetPath(path: string, base = APP_BASE_PATH): string {
  return normalizeBasePath(base) + path.replace(/^\/+/, "");
}

export function appRoot(origin: string = location.origin, base = APP_BASE_PATH): string {
  return new URL(normalizeBasePath(base), origin).href;
}

export function stageLink(origin: string, id: string, key: string, base = APP_BASE_PATH): string {
  const url = new URL(appRoot(origin, base));
  url.searchParams.set("stage", id);
  url.hash = new URLSearchParams({ key }).toString();
  return url.href;
}
