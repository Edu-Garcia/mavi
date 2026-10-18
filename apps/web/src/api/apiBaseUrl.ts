export function resolveApiBaseUrl(apiBaseUrl?: string): string {
  if (apiBaseUrl !== undefined) {
    return apiBaseUrl.replace(/\/$/, "");
  }
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  return (fromEnv ?? "http://localhost:3000").replace(/\/$/, "");
}
