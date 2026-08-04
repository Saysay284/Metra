# What was broken

Your project mixed two incompatible patterns:

- `server.js` — a long-running Express app (`app.listen(...)`).
- `api/geocode.js` — a Vercel serverless function (`export default function handler`).

**Vercel does not run `server.js` at all.** It only turns files inside `/api` into live
endpoints. So in production, only `/api/geocode` existed. Requests to `/api/weather`,
`/api/reverse-geocode`, and `/api/ai-briefing` all 404'd — and because `script.js` had
silent `catch (error) { console.error(...) }` blocks with no visible fallback, the app
just showed nothing instead of an error.

# What changed

1. **`api/weather.js`, `api/reverse-geocode.js`, `api/ai-briefing.js`** — new serverless
   functions, converted 1:1 from your Express routes. These now actually deploy.
2. **`api/geocode.js`** — fixed a bug where `count` was hardcoded to `1`, which was
   silently limiting your autocomplete dropdown to a single suggestion.
3. **`script.js`** — replaced silent `console.error`-only failure paths (in
   `fetchWeatherByCity`) with a visible on-screen error banner, so failures are never
   invisible again. Also surfaces the actual server error message where available.
4. **`package.json`** — added, since `api/ai-briefing.js` needs `@google/generative-ai`
   installed for Vercel's build to resolve the import.

# What you need to do on your end

1. **Delete or ignore `server.js`.** It's dead code on Vercel — keep it only if you also
   run this locally with `node server.js` for dev, but know it plays no role in production.
2. **Set the env var in Vercel**, not just your local `.env`:
   Project → Settings → Environment Variables → add `GEMINI_API_KEY` → redeploy.
   (`.env` files are never read in Vercel's serverless runtime — Express's `dotenv/config`
   only worked locally.)
3. **Redeploy** after dropping these files in. Vercel auto-detects each file under `/api`
   as its own function — no `vercel.json` needed for this structure.
4. Optional: `express` and `cors` in your `package.json`/`server.js` are no longer used by
   the deployed app and can be removed if you're not running the Express server locally anymore.

After redeploying, open DevTools → Network tab and confirm `/api/weather`,
`/api/geocode`, `/api/reverse-geocode`, and `/api/ai-briefing` all return 200 status codes
rather than 404.
