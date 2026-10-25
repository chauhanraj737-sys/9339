import { getStore } from "@netlify/blobs";

export default async (request) => {
  const store = getStore("retailer-dashboard");
  if (request.method === "GET") {
    const saved = await store.get("current", { type: "json" });
    return new Response(JSON.stringify(saved || {}), { headers: { "content-type": "application/json" } });
  }
  if (request.method === "POST") {
    const body = await request.json();
    if (!Array.isArray(body.data)) return new Response("Invalid data", { status: 400 });
    await store.setJSON("current", { data: body.data, source: body.source || "", month: body.month || "" });
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  }
  return new Response("Method not allowed", { status: 405 });
};
