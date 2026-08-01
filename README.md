# Déployer ClassPro sur Cloudflare Workers

Ce dossier transforme le prototype ClassPro en une vraie application déployable :
le frontend React est servi par un Worker Cloudflare, qui expose aussi une petite
API branchée sur une base D1 (SQL serverless de Cloudflare) pour la persistance
des données. Plus besoin de l'environnement Claude pour que l'app fonctionne.

## ⚠️ À savoir avant d'aller plus loin

Cette version est un **MVP fonctionnel**, pas encore une version prête pour de
vraies données sensibles :
- Les mots de passe sont toujours stockés **en clair**, exactement comme dans le
  prototype (c'est d'ailleurs écrit noir sur blanc dans les mentions légales de
  l'app). Ils transitent maintenant sur un vrai réseau public.
- N'importe quel visiteur du site peut, techniquement, lire ou écrire les
  données via l'API `/api/storage` — il n'y a pas encore de vérification
  d'autorisation par requête.

**Recommandation** : utilise cette version pour tester avec ton équipe fondatrice
ou une poignée de premiers utilisateurs de confiance, mais dis-moi quand tu veux
qu'on ajoute une vraie authentification côté serveur (mots de passe hachés,
sessions sécurisées, autorisations par utilisateur) avant d'ouvrir à tous les
enseignants. C'est la suite logique, pas encore faite ici.

## Déploiement 100% navigateur (sans terminal, sans Node installé)

Si tu travailles uniquement depuis GitHub et Cloudflare (pas de terminal), voici
le chemin équivalent, entièrement dans le navigateur.

### 1. Mettre le projet sur GitHub

1. Sur https://github.com → **New repository** → nomme-le `classpro` → **Create repository**.
2. Sur la page du dépôt vide → **uploading an existing file** (lien bleu).
3. Glisse-dépose **tous les fichiers et dossiers de ce zip** (garde bien la
   structure : `src/`, `worker/`, `wrangler.jsonc`, etc. — décompresse le zip
   sur ton ordinateur d'abord, puis dépose le contenu du dossier, pas le zip
   lui-même).
4. **Commit changes**.

### 2. Créer la base de données D1 (sans CLI)

1. Sur https://dash.cloudflare.com → **Workers & Pages** → onglet **D1 SQL Database**
   → **Créer une base de données**.
2. Nomme-la `classpro-db` → **Créer**.
3. Une fois créée, copie l'**ID de la base de données** affiché sur sa page.
4. Toujours sur cette page D1, va dans l'onglet **Console** et colle-y le
   contenu de `schema.sql` (le `CREATE TABLE...`), puis exécute. La table est
   créée, sans terminal.

### 3. Coller l'ID de la base dans `wrangler.jsonc`

1. Retourne sur ton dépôt GitHub → ouvre `wrangler.jsonc` → clique sur l'icône
   crayon (éditer) → remplace `REMPLACE_MOI_APRES_wrangler_d1_create` par
   l'ID copié à l'étape précédente → **Commit changes** directement sur
   `main`.

### 4. Connecter le dépôt à Cloudflare

1. Dans le tableau de bord Cloudflare → **Workers & Pages** → **Créer** →
   **Importer un dépôt Git** → autorise l'accès à GitHub → choisis le dépôt
   `classpro`.
2. Cloudflare détecte `wrangler.jsonc` et propose les bons réglages
   (commande de build : `npm run build`). Laisse les valeurs par défaut →
   **Enregistrer et déployer**.
3. Cloudflare installe les dépendances, build le frontend et déploie tout —
   toi tu n'as rien à installer sur ta machine.

Au premier déploiement tu obtiens une URL `https://classpro.<compte>.workers.dev`.
**Chaque futur `git push` (ou commit direct sur GitHub) redéclenche
automatiquement un nouveau déploiement** — c'est le principal intérêt de
connecter le dépôt : plus jamais besoin de terminal ensuite.

---

## Déploiement en ligne de commande (alternative, si tu changes d'avis un jour)

### Prérequis

- Un compte Cloudflare (gratuit) : https://dash.cloudflare.com/sign-up
- Node.js 18+ installé sur ta machine
- Un compte GitHub (pour le déploiement automatique, optionnel mais recommandé)

## 1. Installer les dépendances

```bash
npm install
```

## 2. Se connecter à Cloudflare

```bash
npx wrangler login
```

Une page de navigateur s'ouvre pour autoriser Wrangler (l'outil en ligne de
commande de Cloudflare) à accéder à ton compte.

## 3. Créer la base de données D1

```bash
npm run db:create
```

Cette commande affiche un bloc contenant un `database_id`. **Copie cet ID** et
colle-le dans `wrangler.jsonc`, à la place de
`"REMPLACE_MOI_APRES_wrangler_d1_create"`.

Puis crée la table :

```bash
npm run db:migrate:remote
```

## 4. Déployer

```bash
npm run deploy
```

Cette commande construit le frontend (`vite build`) puis déploie tout
(frontend + API) sur Cloudflare. À la fin, Wrangler affiche une URL du type :

```
https://classpro.<ton-compte>.workers.dev
```

C'est ton application, en ligne, tout de suite.

## 5. (Recommandé) Déploiement automatique depuis GitHub

1. Pousse ce dossier sur un nouveau dépôt GitHub.
2. Dans le tableau de bord Cloudflare → **Workers & Pages** → **Créer** →
   **Importer un dépôt Git**, choisis ton dépôt.
3. Cloudflare détecte automatiquement la configuration (`wrangler.jsonc`) et
   met en place un déploiement à chaque `git push` sur la branche principale,
   avec des aperçus (« preview deployments ») pour chaque pull request.

Après ça, tu n'as plus besoin de lancer `npm run deploy` toi-même : un `git
push` suffit.

## 6. Domaine personnalisé (optionnel)

Dans le tableau de bord Cloudflare → ton Worker → **Domaines et routes**,
ajoute ton propre nom de domaine (ex. `classpro.bj` ou `app.classpro.bj`) si tu
en as un, sinon `classpro.<ton-compte>.workers.dev` fonctionne très bien pour
commencer.

## Développement local

Deux terminaux :

```bash
# Terminal 1 — l'API (Worker + D1 local)
npm run dev:worker

# Terminal 2 — le frontend (rechargement à chaud)
npm run dev:web
```

Puis ouvre `http://localhost:5173`.

## Structure du projet

```
classpro-deploy/
├── index.html          → page HTML de base
├── vite.config.js       → config du bundler frontend
├── wrangler.jsonc        → config Cloudflare (Worker + D1 + assets statiques)
├── schema.sql            → schéma de la base D1
├── package.json
├── src/
│   ├── main.jsx           → point d'entrée React
│   ├── storageAdapter.js  → branche l'app sur l'API au lieu du stockage Claude
│   └── ClassPro.jsx       → l'application complète (inchangée, sauf ajout
│                             d'une synchronisation périodique toutes les 8s)
└── worker/
    └── index.js           → l'API (stockage clé-valeur adossé à D1)
```
