import { Hono } from "hono";
import { cors } from "hono/cors";

// API minimale qui imite l'interface window.storage de l'environnement Claude,
// mais adossée à une vraie base D1. Deux clés sont utilisées par ClassPro :
// "classpro-data-v2" (publications, groupes, messages, signalements, annonces…)
// et "classpro-accounts-v2" (comptes utilisateurs).
//
// ⚠️ LIMITE CONNUE (MVP) : ce store est un simple couple clé/valeur en écriture
// libre pour quiconque appelle l'API. Il n'y a pas encore de vérification
// d'autorisation par requête ni de hachage des mots de passe côté serveur —
// exactement les limites déjà annoncées dans les mentions légales de l'app.
// C'est suffisant pour lancer une première version et itérer, mais avant
// d'accueillir de vrais enseignants avec de vraies données sensibles, il faudra
// migrer vers de vraies routes (auth par session, mots de passe hachés,
// autorisations par utilisateur). Demande-moi cette étape suivante quand tu es prêt.

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/storage/:key", async (c) => {
  const key = c.req.param("key");
  const row = await c.env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind(key).first();
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json({ key, value: row.value, shared: true });
});

app.put("/api/storage/:key", async (c) => {
  const key = c.req.param("key");
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body.value !== "string") return c.json({ error: "value (string) requis" }, 400);
  await c.env.DB.prepare(
    `INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).bind(key, body.value, Date.now()).run();
  return c.json({ key, value: body.value, shared: true });
});

app.delete("/api/storage/:key", async (c) => {
  const key = c.req.param("key");
  await c.env.DB.prepare("DELETE FROM kv_store WHERE key = ?").bind(key).run();
  return c.json({ key, deleted: true, shared: true });
});

app.get("/api/storage", async (c) => {
  const prefix = c.req.query("prefix") || "";
  const { results } = await c.env.DB.prepare("SELECT key FROM kv_store WHERE key LIKE ?").bind(`${prefix}%`).all();
  return c.json({ keys: (results || []).map((r) => r.key), prefix, shared: true });
});

// Envoi de l'email de vérification à l'inscription, via Resend.
// Nécessite le secret RESEND_API_KEY (Cloudflare → ton Worker → Settings →
// Variables and Secrets). EMAIL_FROM est optionnel (sinon, adresse de test
// Resend par défaut, qui ne peut envoyer qu'à l'adresse de TON compte Resend
// tant qu'aucun domaine n'est vérifié).
app.post("/api/send-verification-email", async (c) => {
  const body = await c.req.json().catch(() => null);
  const to = body?.to?.trim();
  const code = body?.code;
  const name = body?.name || "";
  if (!to || !code) return c.json({ error: "to et code requis" }, 400);
  if (!c.env.RESEND_API_KEY) return c.json({ error: "RESEND_API_KEY non configurée sur le Worker" }, 500);

  const from = c.env.EMAIL_FROM || "ClassPro <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Votre code de vérification ClassPro",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#4F3FF0;">ClassPro</h2>
          <p>Bonjour ${name || "et bienvenue"},</p>
          <p>Voici votre code de vérification pour confirmer votre identifiant :</p>
          <p style="font-size:28px;font-weight:800;letter-spacing:6px;color:#15132B;">${code}</p>
          <p style="color:#666;font-size:13px;">Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const details = await res.text();
    return c.json({ error: "Échec de l'envoi via Resend", details }, 502);
  }
  return c.json({ ok: true });
});

// Tout le reste : sert le frontend React déjà buildé (dist/), avec repli SPA
// configuré dans wrangler.jsonc (not_found_handling).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
