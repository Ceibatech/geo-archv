# Rapport journalier signé CG1020

## Workflow

1. L'agent ouvre **Rapport journalier** depuis son téléphone.
2. La plateforme calcule automatiquement les cartons, dossiers, éléments dégradés et difficultés de la journée.
3. L'agent vérifie les données, dessine sa signature et confirme son visa électronique interne.
4. Le rapport est figé et transmis uniquement au superviseur de son équipe.
5. Le superviseur contrôle les indicateurs. Il peut demander une correction ou apposer son visa.
6. Après validation, le PDF final est généré et envoyé par Resend à l'agent et au superviseur.
7. Les empreintes SHA-256, dates, versions, décisions et résultats d'envoi sont conservés dans la piste d'audit.

## Migration MySQL

```powershell
npm.cmd run db:migrate
```

La migration `005_daily_signed_reports.sql` crée les tables `daily_reports` et `daily_report_events`.

## Configuration Resend

Ajouter dans `.env.local` sans exposer la clé au navigateur :

```dotenv
RESEND_API_KEY="re_votre_cle"
RESEND_FROM_EMAIL="Archives CG1020 <rapports@ceiba-analytics.com>"
APP_URL="https://votre-application.com"
```

Dans Resend, le domaine d'envoi doit être vérifié avec les enregistrements DNS demandés, notamment SPF et DKIM. L'adresse configurée dans `RESEND_FROM_EMAIL` doit appartenir à ce domaine vérifié.

## Portée de la signature

Le mécanisme implémenté est un **visa électronique interne traçable** lié au compte authentifié, à l'heure, au rapport et à l'empreinte de l'image signée. Si une signature électronique qualifiée au sens réglementaire est exigée, un prestataire de confiance certifié devra être intégré en complément.
