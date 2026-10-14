// API de sincronización — Goles × Concepto (Deportivo Maldonado)
// GET/PUT /api/data        -> documento compartido (goles, etiquetas, orden, adjuntos)
// GET/PUT/DELETE /api/file/<id> -> archivos HTML adjuntos
import { getStore } from "@netlify/blobs";

const PASS = process.env.APP_PASS || "deportivo1928";
const MAX_FILE = 5 * 1024 * 1024;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export async function handle(req, store) {
  if (req.headers.get("x-pass") !== PASS) return json({ error: "no autorizado" }, 401);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");

  if (path === "data") {
    if (req.method === "GET") {
      const cur = await store.get("doc", { type: "json" });
      return json(cur || { rev: 0, doc: null });
    }
    if (req.method === "PUT") {
      let body;
      try { body = await req.json(); } catch { return json({ error: "json inválido" }, 400); }
      if (!body || typeof body.doc !== "object") return json({ error: "falta doc" }, 400);
      const cur = (await store.get("doc", { type: "json" })) || { rev: 0, doc: null };
      if ((body.baseRev || 0) !== cur.rev) return json({ conflict: true, rev: cur.rev, doc: cur.doc }, 409);
      const next = { rev: cur.rev + 1, doc: body.doc, ts: Date.now() };
      await store.setJSON("doc", next);
      return json({ rev: next.rev });
    }
    return json({ error: "método no permitido" }, 405);
  }

  if (path.startsWith("file/")) {
    const id = path.slice(5);
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return json({ error: "id inválido" }, 400);
    const key = "file-" + id;
    if (req.method === "GET") {
      const txt = await store.get(key, { type: "text" });
      if (txt == null) return json({ error: "no existe" }, 404);
      return new Response(txt, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
    }
    if (req.method === "PUT") {
      const txt = await req.text();
      if (txt.length > MAX_FILE) return json({ error: "archivo muy grande" }, 413);
      await store.set(key, txt);
      return json({ ok: true });
    }
    if (req.method === "DELETE") {
      await store.delete(key);
      return json({ ok: true });
    }
    return json({ error: "método no permitido" }, 405);
  }
  return json({ error: "no encontrado" }, 404);
}

export default async (req) => handle(req, getStore({ name: "goles-2026", consistency: "strong" }));

export const config = { path: "/api/*" };
