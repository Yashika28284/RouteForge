import { env } from './env';

// CORS_ORIGIN: comma-separated exact origins, e.g.
//   "https://routeforge.vercel.app,http://localhost:5173"
const allowedOrigins = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// CORS_ORIGIN_REGEX (optional): a single regex tested against the request
// origin, for platforms that mint a new URL per deploy (Vercel preview
// deployments, e.g. "https://routeforge-git-feature-x-yourteam.vercel.app").
// Keep this scoped to your own project's preview domain pattern — do not
// use a broad pattern like /\.vercel\.app$/ or you'll accept any Vercel
// site as a trusted origin.
// Guard against an empty string (e.g. an unset dashboard env var coming
// through as ""), which would otherwise compile to a regex matching
// everything and silently defeat the allowlist.
const previewRegex = env.CORS_ORIGIN_REGEX?.trim() ? new RegExp(env.CORS_ORIGIN_REGEX.trim()) : null;

export function corsOriginCheck(
  origin: string | undefined,
  callback: (err: Error | null, allow: boolean) => void,
): void {
  // No Origin header — same-origin requests, curl, server-to-server, etc.
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  if (previewRegex && previewRegex.test(origin)) return callback(null, true);
  return callback(null, false);
}
