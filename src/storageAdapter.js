// Remplace l'API window.storage fournie par l'environnement Claude par une vraie
// persistance : les données "partagées" (shared=true) passent par le Worker
// Cloudflare (qui les stocke dans D1) ; les données "personnelles" (shared=false,
// ex. la session de connexion) restent dans le localStorage du navigateur, ce qui
// est le comportement correct pour une session propre à cet appareil.

const API_BASE = "/api/storage";

function localGet(key) {
  const value = localStorage.getItem(key);
  if (value === null) throw new Error("not found");
  return { key, value, shared: false };
}

async function sharedRequest(method, key, value) {
  const res = await fetch(`${API_BASE}/${encodeURIComponent(key)}`, {
    method,
    headers: value !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: value !== undefined ? JSON.stringify({ value }) : undefined,
  });
  if (res.status === 404) throw new Error("not found");
  if (!res.ok) throw new Error(`storage error (${res.status})`);
  return res.json();
}

window.storage = {
  async get(key, shared = false) {
    if (!shared) return localGet(key);
    return sharedRequest("GET", key);
  },
  async set(key, value, shared = false) {
    if (!shared) {
      localStorage.setItem(key, value);
      return { key, value, shared };
    }
    return sharedRequest("PUT", key, value);
  },
  async delete(key, shared = false) {
    if (!shared) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared };
    }
    return sharedRequest("DELETE", key);
  },
  async list(prefix = "", shared = false) {
    if (!shared) {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
      return { keys, prefix, shared };
    }
    const res = await fetch(`${API_BASE}?prefix=${encodeURIComponent(prefix)}`);
    if (!res.ok) throw new Error(`storage error (${res.status})`);
    return res.json();
  },
};
