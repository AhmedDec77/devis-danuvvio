# Presupuestos — Handwerker Crispin

Plateforme de génération de devis pour Danuvvio. Stack : React + Vite + Supabase + Vercel.

## Déploiement — 5 étapes

### 1. Base de données Supabase
- Ouvre supabase.com → projet `devis-danuvvio` → **SQL Editor** (icône terminal à gauche)
- Colle TOUT le contenu de `supabase/schema.sql` → **Run**
- Vérifie : Table Editor → tu dois voir `prestations` (28 lignes), `devis`, `compteurs`

### 2. Créer l'utilisateur de Danuvvio
- Supabase → **Authentication** → **Users** → **Add user** → **Create new user**
- Email : handwerkercrispin@gmail.com — Mot de passe : choisis-en un simple et solide
- Coche "Auto Confirm User"

### 3. Mettre le code sur GitHub
- github.com → **New repository** → nom : `devis-danuvvio` → **Private** → Create
- Suis les instructions "push an existing repository" OU utilise l'upload web :
  github.com/TON_USER/devis-danuvvio → "uploading an existing file" → glisse tout le dossier (sauf node_modules)

### 4. Déployer sur Vercel
- vercel.com → **Add New → Project** → importe le repo `devis-danuvvio`
- Framework : Vite (détecté automatiquement)
- **Environment Variables** — ajoute les 2 :
  - `VITE_SUPABASE_URL` = https://wacacrhwgkwuhjchbbpp.supabase.co
  - `VITE_SUPABASE_ANON_KEY` = la clé anon (eyJ...)
- **Deploy** → 2 minutes → URL du type devis-danuvvio.vercel.app

### 5. Test local (optionnel, avant déploiement)
```bash
cp .env.example .env   # puis remplir la clé anon dans .env
npm install
npm run dev
```

## Utilisation (pour Danuvvio)
1. Se connecter avec son email
2. "Nuevo presupuesto" : nom du client → niveau de prix (Bajo/Medio/Alto) → ajouter les travaux → ajuster
3. "Generar PDF" → la fenêtre d'impression s'ouvre → "Enregistrer en PDF"
4. Le devis est sauvegardé automatiquement dans "Historial" avec numérotation automatique (2026001, 2026002...)
5. "Precios" : modifier le catalogue à tout moment
