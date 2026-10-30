# Synthèse du maître — tour 1 (30/10/2026)

| Audit | Tour 0 | Tour 1 | Statut |
|---|---|---|---|
| Conformité | 6 | 9,5 | **VALIDÉ** (action : push GitHub avec accord) |
| Développeur senior | 7 | 8 | NON VALIDÉ (1 MAJEUR : régression) |
| Utilisateurs | 8 | 9 | **VALIDÉ** |
| Sécurité | 9 | (validé au tour 0) | **VALIDÉ** |
| Design et accessibilité | 7 | 8 | NON VALIDÉ (1 MAJEUR) |
| Correcteur | 8,3 | 8 (89/100) | NON VALIDÉ (1 MAJEUR) |
| QA | 7,5 | 9 | **VALIDÉ** |

## Décisions (CORRIGER)
- MAJEUR dev #1 : annuler un 1er message en ouvrant une autre conversation vide l'état d'une conversation qui n'est plus active → réf. de la conversation active dans `useChat`, le `catch` ne touche plus l'écran si on a changé de conversation.
- MAJEUR design #1 : focus perdu après Rename/Delete depuis la barre latérale → le `requestAnimationFrame` de focus initial est annulé à la fermeture (il pouvait s'exécuter après, dans un onglet ralenti, et viser le panneau en train de disparaître) ; au démontage, si le focus est resté dans le panneau, il est rendu au déclencheur.
- MAJEUR correcteur #1 : `pytest` dépend du `.env` local (`ALLOWED_HOSTS` sans `testserver`) → `conftest.py` impose sa configuration avant d'importer l'application.
- MINEURS retenus : message « Conversation not found » conservé après la redirection ; texte tapé rendu au champ quand un envoi est annulé sans réponse ; limite de 64 Ko aussi pour les corps `chunked` ; index `messages.created_at` pour le budget ; échec d'enregistrement de la réponse → `rollback` + `error` ; chunk Markdown allégé (highlight.js limité à 12 langages) ; Postman : cas 409 et 404 de `/regenerate` ; `role="status"` sur « Stopped ».

## Refusés / reportés
- Marqueur « Stopped » persistant après rechargement (utilisateur #1) : demanderait une colonne de plus ; le bouton Regenerate couvre le besoin.
- Écart de quelques mots entre l'écran et la base après Stop (utilisateur #2) : le serveur enregistre les mots déjà générés ; c'est la base qui est la plus complète, sans incohérence de contexte.
- Tests front Vitest/Playwright (dev #8) : hors périmètre du cours ; parcours vérifiés à chaque tour par les agents utilisateur et dev.
- Dates en UTC (dev #9, correcteur #5) : IDÉE ; documenté (heure locale du serveur).
