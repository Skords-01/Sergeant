const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://finto-flame.vercel.app",
];

const ALLOWED_HOSTS = new Set([
  "www.bodybuilding.com",
  "bodybuilding.com",
]);

function isAllowedUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    if (!ALLOWED_HOSTS.has(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

function getQueryUrl(req) {
  const q = req.query || {};
  let url = q.url;
  if (Array.isArray(url)) url = url[0];
  if (typeof url === "string" && url) return url;

  try {
    const u = new URL(req.url, "http://local");
    const v = u.searchParams.get("url");
    if (v) return v;
  } catch {}

  return null;
}

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const url = getQueryUrl(req);
  if (!url) {
    return res.status(400).json({ error: "Missing url" });
  }
  if (!isAllowedUrl(url)) {
    return res.status(400).json({ error: "URL not allowed" });
  }

  try {
    const r = await fetch(url, {
      headers: {
        // Helps with basic hotlink/anti-bot checks
        "User-Agent": "Mozilla/5.0 (compatible; Fizruk/1.0)",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://www.bodybuilding.com/",
      },
      redirect: "follow",
    });

    if (!r.ok) {
      return res.status(r.status).json({ error: `Upstream ${r.status}` });
    }

    const ct = r.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");

    const buf = Buffer.from(await r.arrayBuffer());
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Image proxy error" });
  }
}

