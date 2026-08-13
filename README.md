# Archives MULCV — Inventaire CG1020

Application métier Next.js pour inventorier les dossiers du MULCV, organiser les agents par équipe, piloter la production et faire signer les rapports journaliers avant leur envoi par Resend.

## Fonctionnalités

- connexion sécurisée et session serveur révocable pour chaque compte ;
- espaces adaptés aux rôles `admin`, `agent`, `superviseur` et `executif` ;
- questionnaire d'inventaire mobile en huit étapes, reprise du carton ouvert et prévention des doublons ;
- tableaux de bord de production par période et périmètre autorisé ;
- administration des comptes, rôles, états, équipes et directions ;
- rapport journalier signé par l'agent puis visé ou rejeté par le superviseur ;
- PDF final, piste d'audit et suivi des envois Resend (`NOT_SENT`, `SENT`, `FAILED`) ;
- centre d'administration avec état des comptes, affectations et configuration e-mail.

## Stack et architecture

Next.js 16 (App Router), React 19, TypeScript, MySQL 8, `mysql2/promise`, Zod, bcrypt, pdf-lib et Resend.

```text
app/          Pages, layouts et Route Handlers
components/   Interfaces serveur et client
db/           Pool MySQL
lib/          Authentification, validation et permissions
services/     Requêtes et règles métier côté serveur
sql/          Migrations SQL versionnées
scripts/      Migration, contrôle de base et création de comptes
tests/        Tests métier Vitest
```

Les tables ne sont jamais créées pendant le démarrage ou le build. Les migrations restent une opération explicite.

## Prérequis

- Node.js 22.x ;
- npm 10+ ;
- MySQL 8 local ou hébergé ;
- un compte Resend avec un domaine vérifié pour les e-mails de production.

## Installation locale

```bash
npm install
```

Copier `.env.example` vers `.env.local`, puis renseigner toutes les valeurs utiles. `.env.local` est ignoré par Git et ne doit jamais être partagé.

```dotenv
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE"
AUTH_SECRET="une-valeur-aleatoire-de-plus-de-32-caracteres"
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="Archives CG1020 <rapports@domaine-verifie.com>"
APP_URL="http://localhost:3000"
```

Générer un secret sous PowerShell :

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

### Variables d'environnement

| Variable | Obligatoire | Portée | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Oui | Serveur | URL MySQL complète. Ajouter `?ssl=true` si l'hébergeur impose TLS. |
| `AUTH_SECRET` | Oui | Serveur | Secret aléatoire d'au moins 32 caractères utilisé pour les sessions. |
| `RESEND_API_KEY` | Pour l'envoi | Serveur | Clé API Resend. Ne jamais utiliser le préfixe `NEXT_PUBLIC_`. |
| `RESEND_FROM_EMAIL` | Pour l'envoi | Serveur | Nom et adresse d'un domaine vérifié dans Resend. |
| `APP_URL` | Oui en production | Serveur | URL publique canonique utilisée dans les e-mails. |

## Base de données

La base référencée dans `DATABASE_URL` doit déjà exister. Vérifier la connexion et l'état des migrations sans modifier la base :

```bash
npm run db:check
```

Appliquer les migrations absentes :

```bash
npm run db:migrate
```

Le script enregistre chaque migration dans `schema_migrations`. Le schéma comprend les utilisateurs, sessions, cartons, fiches d'inventaire, équipes, membres, rapports signés et événements d'audit.

Créer le premier administrateur :

```bash
npm run user:create -- --first-name Awa --last-name KONE --login admin --password "MotDePasseTresFort!" --role admin --email admin@example.org
```

Créer ensuite les agents et superviseurs depuis l'interface d'administration. Un agent doit posséder un code agent et être affecté à une équipe pour utiliser tout le workflow de rapport.

## Démarrage et contrôles

```bash
npm run dev
```

L'application locale est disponible sur `http://localhost:3000`.

```bash
npm run lint
npm test
npm run build
```

## Rôles

| Rôle | Espace et responsabilités |
| --- | --- |
| Administrateur | Tableau de bord technique, comptes, rôles, états et affectations. |
| Agent | Questionnaire mobile, fiches personnelles, production et signature du rapport journalier. |
| Superviseur | Production de son équipe, contrôle, rejet ou visa des rapports. |
| Exécutif | Indicateurs consolidés et consultation des rapports signés. |

Les pages et les API vérifient les permissions côté serveur. Le cookie de session est `HttpOnly` et ne contient qu'un jeton opaque ; seule son empreinte est conservée en base. Les mots de passe sont hachés avec bcrypt.

## Workflow d'inventaire et de rapport

1. L'agent ouvre ou reprend un carton.
2. Il complète le questionnaire dossier par dossier. Une référence métier du type `CG1020-20260812-AG007-000381` est générée côté serveur.
3. La clé `client_request_id` empêche un double enregistrement en cas de nouvelle tentative réseau.
4. En fin de journée, la production calculée est signée par l'agent et transmise à son superviseur.
5. Le superviseur rejette avec un motif ou signe le rapport.
6. Après validation, le PDF final est généré et envoyé par Resend. L'identifiant d'envoi ou l'erreur sont conservés en base.

Le paramétrage détaillé des rapports est également décrit dans `docs/rapport-journalier.md`.

## Déploiement sur Vercel

### 1. Préparer MySQL

Utiliser une base MySQL hébergée et accessible depuis les fonctions Vercel. Activer TLS avec `?ssl=true` dans `DATABASE_URL` lorsque le fournisseur le demande. Ne pas utiliser une base locale ou une adresse privée inaccessible depuis Internet.

Avant le premier déploiement, exécuter les migrations contre la base cible depuis un poste autorisé :

```powershell
$env:DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE?ssl=true"
npm run db:migrate
```

La commande `npm run build` n'exécute volontairement aucune migration.

### 2. Créer le projet Vercel

Importer le dépôt dans Vercel. Le framework Next.js et la commande `npm run build` sont détectés automatiquement. La racine du projet doit être le dossier contenant ce `README.md` et `package.json`.

Dans **Project Settings → Environment Variables**, créer :

- `DATABASE_URL`
- `AUTH_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `APP_URL`

Renseigner séparément les environnements Production, Preview et Development. Éviter de connecter les déploiements Preview à la base de production. Aucun secret ne doit être exposé avec `NEXT_PUBLIC_`.

### 3. Configurer Resend

Vérifier le domaine d'envoi dans Resend (SPF et DKIM), puis utiliser une adresse de ce domaine dans `RESEND_FROM_EMAIL`. Mettre `APP_URL` à l'URL finale, par exemple `https://archives.example.org`, après la configuration du domaine personnalisé.

### 4. Déployer

Un push sur la branche liée déclenche le déploiement. Avec la CLI Vercel, les commandes équivalentes sont :

```bash
vercel
vercel --prod
```

### 5. Vérifier après déploiement

- connexion et déconnexion avec chaque rôle ;
- accès à `/admin` et état des cinq variables serveur ;
- création ou désactivation d'un compte ;
- questionnaire agent sur un téléphone ;
- affectation agent/superviseur à une équipe ;
- signature, visa, génération PDF et statut d'envoi Resend.

## API principales

```text
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session

GET  /api/users
POST /api/users
GET  /api/users/:id
PUT  /api/users/:id

GET  /api/teams
POST /api/teams
PUT  /api/teams/:id

POST /api/cartons
GET  /api/cartons/current
POST /api/cartons/:id/close

GET  /api/inventory
POST /api/inventory
GET  /api/inventory/:id
PUT  /api/inventory/:id

POST /api/reports/daily/sign
POST /api/reports/daily/:id/approve
POST /api/reports/daily/:id/reject
POST /api/reports/daily/:id/email
GET  /api/reports/daily/:id/pdf
```
