# Synthèse du maître — tour 0 (29/10/2026)

| Audit | Note | Statut |
|---|---|---|
| Conformité aux consignes | 6/10 | NON VALIDÉ (2 BLOQUANTS) |
| Développeur senior | 7/10 | NON VALIDÉ |
| Utilisateurs (3 personas) | 8/10 | NON VALIDÉ |
| Sécurité | 9/10 | **VALIDÉ** |
| Design et accessibilité | 7/10 | NON VALIDÉ |
| Correcteur John Bryce | 8,3/10 (83/100) | NON VALIDÉ (1 BLOQUANT) |
| QA | 7,5/10 | NON VALIDÉ |

## Constats dédoublonnés et décisions

### BLOQUANTS
| # | Constat | Sources | Décision |
|---|---|---|---|
| B1 | Export `Database/chatgpt_clone.sql` périmé (sans `pinned`, `ON UPDATE` encore là) : l'API renvoie 500 après import | conformité, dev, correcteur | CORRIGER : régénérer à la fin depuis le schéma actuel, tester l'import + l'API dessus, garde-fou `grep pinned` dans `make_submission.sh` |
| B2 | Le zip garde des fichiers supprimés (`zip` met à jour l'ancien zip) | conformité, correcteur | CORRIGER : `rm -f` du zip avant de le recréer |

### MAJEURS
| # | Constat | Sources | Décision |
|---|---|---|---|
| M1 | Zip contient `docs/audit/` (matériel interne) | conformité, correcteur, sécurité | CORRIGER : exclure `docs/audit/` |
| M2 | GitHub en retard sur le local | conformité, correcteur | ACTION DE MORDEHAI : commit + push à la fin, avec son accord |
| M3 | Navigation : changer de conversation pendant un flux désynchronise URL/écran ; Retour vers `/` garde l'ancienne conversation ; supprimer l'ouverte laisse l'URL morte | dev | CORRIGER : l'URL devient la seule source de vérité |
| M4 | Stop avant le premier mot : message utilisateur orphelin en base | dev, QA | CORRIGER (+ test) |
| M5 | Refresh / Stop en pleine réponse : réponse figée, aucun moyen de relancer ; pas de « Régénérer » | utilisateur | CORRIGER : bouton **Regenerate** sur la dernière réponse (nouvel endpoint), mention « Stopped », titre généré même après arrêt |
| M6 | Erreur après `done` (titre) envoyée comme `error` : le client efface des messages enregistrés ; flux coupé sans `done` = faux succès | dev | CORRIGER : titre isolé (journalisé), client robuste |
| M7 | Focus perdu après une fenêtre ouverte depuis le menu ; tiroir mobile sans gestion du focus | design-a11y | CORRIGER |
| M8 | Cibles tactiles < 44 px sur mobile | design-a11y, utilisateur | CORRIGER |
| M9 | Contrastes : bouton Delete en sombre 2,77:1 ; conversation active 4,31:1 | design-a11y | CORRIGER (token `on-destructive`, actif en `text-foreground` + barre) |

### MINEURS retenus (CORRIGER)
README (nombre de tests, refresh, import, utilisateur MySQL, clé requise, mono-utilisateur local, limite 50, `--no-proxy-headers`) · erreur « clé manquante » en 503 au texte neutre · `updated_at` restauré quand un envoi échoue · caractères de contrôle retirés des titres · assertions SSE dans Postman · `requirements-dev.txt` · bundle : About en lazy + highlight.js limité à quelques langages, `detect` désactivé · contexte : 40 derniers messages lus en SQL · client OpenAI unique · ORM aligné (BIGINT, DATETIME(3)) · `MessageBubble` mémoïsé · parseur SSE tolérant (`\r\n`, `data:`, JSON invalide) · limite de taille du corps (413) et 422 sans écho de l'entrée · `TrustedHostMiddleware` · en-têtes de sécurité · images Markdown transformées en liens · prop `node` retirée · `docker-compose` lié à 127.0.0.1 · nettoyage du limiteur · **budget de jetons journalier** · prompt : refus dans la langue de l'utilisateur · focus des items de menu, Home/End, `aria-label` du menu · bordure des champs à 3:1 · `document.title` dynamique + h1 caché · `lang="he"` détecté · mouvement réduit dans ChatPage · `<bdi>` dans la fenêtre de suppression · défilement en bas à chaque envoi · « Conversation not found » affiché · placeholder « Search titles » · tests ajoutés (coupure avant le 1er mot, titre une seule fois, traduction des erreurs, fenêtre de contexte, cascade avec FK, caractères de contrôle, Regenerate, `Retry-After`).

### REFUSÉS (avec raison)
- Interface traduite en hébreu (utilisateur #8) : hors énoncé ; choix documenté (interface en anglais, conversations dans toutes les langues).
- Recherche dans le contenu des messages (utilisateur #6) : placeholder clarifié à la place ; une recherche plein texte est hors énoncé.
- Continuer la génération côté serveur après un Refresh (utilisateur #1, option A) : rendrait le bouton Stop inopérant et coûterait des jetons ; remplacé par Regenerate.
- Fenêtre de contexte comptée en jetons (sécurité #2) : la limite de 40 messages + 8000 caractères + budget journalier suffit pour ce projet ; documenté.
- Découpage du contexte React en deux contextes (dev #5) : gain faible ; remplacé par la mémoïsation des bulles.
- Pagination complète (dev #14) : limite de 50 documentée, paramètre `limit` exposé.
- Tests front (Vitest/Playwright) : hors périmètre du cours ; parcours vérifiés par l'agent utilisateur.
- Autofocus du champ au chargement (a11y #8) : conservé, comportement identique à Claude.ai / ChatGPT.

### Contradictions arbitrées
- Design (texte actif en bleu, identité) contre accessibilité (contraste 4,31:1) : l'accessibilité gagne ; l'identité est gardée par une barre bleue à gauche.
