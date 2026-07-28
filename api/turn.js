/**
 * Vercel serverless function: mints TURN credentials from Metered for the
 * game's WebRTC (PeerJS) connections. The Metered API key stays SERVER-side
 * — configure it in Vercel → Project → Settings → Environment Variables:
 *   METERED_API_KEY = <your metered secret key>
 * Domain: ludopatas.metered.live
 */
export default async function handler(req, res) {
  const key = process.env.METERED_API_KEY;
  if (!key) {
    res.status(200).json([]); // no key configured → client falls back to STUN
    return;
  }
  try {
    const r = await fetch(
      `https://ludopatas.metered.live/api/v1/turn/credentials?apiKey=${key}`,
    );
    const iceServers = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json(Array.isArray(iceServers) ? iceServers : []);
  } catch {
    res.status(200).json([]);
  }
}
