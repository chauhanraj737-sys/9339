import { session, sameOrigin, json } from '../lib/auth.mjs';
import { getStore } from "@netlify/blobs";

export default async (request) => {
  const user = await session(request);
  if (!user) return json({error:'Sign in required'},401);
  if (request.method !== 'GET' && (user.role !== 'Admin' || !sameOrigin(request))) return json({error:'Administrator access required'},403);
  const store = getStore("retailer-dashboard");
  if (request.method === "GET") {
    const saved = await store.get("current", { type: "json" });
    return new Response(JSON.stringify(saved ? {...saved,data:user.fos.length?saved.data.filter(r=>user.fos.includes(r.fos||'Unassigned')):saved.data} : {}), { headers: { "content-type": "application/json" } });
  }
  if (request.method === "POST") {
    const body = await request.json();
    if (!Array.isArray(body.data)) return new Response("Invalid data", { status: 400 });
    await store.setJSON("current", { data: body.data, source: body.source || "", month: body.month || "" });
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }
  return new Response("Method not allowed", { status: 405 });
};
