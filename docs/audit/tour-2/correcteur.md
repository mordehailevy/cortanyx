# Audit audit-correcteur — tour 2
Note : 9/10 (92/100 au barème du jury) — VALIDÉ (aucun point BLOQUANT ; 1 MAJEUR d'expérience utilisateur à corriger avant le rendu, voir constat 1)

Réserve : le jury peut ne pas valider un projet avec un MAJEUR, mais l'installation, l'export, les tests et l'API sont tous corrects. Si le coordinateur applique la règle « aucun MAJEUR avant le rendu », la note repasse à 8/10 tant que le constat 1 reste ouvert.

## Ce qui est excellent
- **Parcours README dans l'ordre exact : tout passe.** Zip neuf de 268 Ko (82 fichiers), sans `docs/audit/`, `Header.tsx`, `Sidebar.tsx`, `.env`, `env/` ni `node_modules/`. Import de l'export, `cp .env.example .env`, `pip install -r requirements-dev.txt`, `pytest` : **34 passed en 0,87 s avec le `.env` copié de `.env.example`** (le constat 1 du tour 1 est corrigé).
- **Export SQL correct.** `Database/chatgpt_clone.sql` importé dans `correcteur_tmp` : 12 conversations, 48 messages, colonne `pinned`, index `idx_messages_created`. `GET /api/conversations` renvoie 200, et la première conversation a `pinned: true`.
- **Serveur robuste face aux cas limites.**
  - Sans clé : 503 avec un message clair en JSON, et événement SSE `error` (`status: 503`).
  - Un envoi raté laisse `updated_at` inchangé et `messages: []`.
  - Message vide : 422.
  - Corps de 70 Ko : 413 `Request body too large`, y compris en `Transfer-Encoding: chunked`.
  - `/regenerate` : 409 si rien à régénérer, 404 si la conversation est inconnue.
  - Hôte falsifié (`Host: evil.com`) : 400.
  - DELETE : 204.
- **Front en bonne santé.** `npm run build` passe : bundle principal 441 kB, Markdown 238 kB et page À propos 8 kB chargés à la demande, pas d'avertissement de taille. `npm run lint` : propre.
- **Documentation et Postman à jour.** La collection contient 17 requêtes. Le README précise le mode mono-utilisateur local (ligne 196), la procédure avant mise en ligne, l'import en premier, `-p` facultatif, l'utilisateur MySQL et docker-compose.

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | MAJEUR | **Quand le premier message d'une nouvelle conversation échoue, l'interface affiche « Conversation not found. » au lieu de la vraie erreur** (clé absente, clé invalide, quota, réseau). Le texte saisi est aussi perdu (la zone de saisie est vide). Le client supprime la conversation vide créée pour ce message, puis recharge `/chat/<id>`, qui répond 404 : le 404 écrase le message de l'erreur d'origine. Ce comportement est une régression : au tour 0, l'interface affichait « OPENAI_API_KEY is missing… » avec un bouton Retry. Reproduit deux fois (saisie réelle au clavier et clic programmatique). | Accueil, saisie de « Bonjour test », Entrée. Réseau : `POST /api/conversations` 201, `POST .../messages/stream` 200 (événement `error` 503), `DELETE .../<id>` 204, `GET .../<id>` 404. Résultat : `role=alert` = « Conversation not found. », textarea vide. Un utilisateur qui retape le message obtient la même chose. Le correcteur qui teste sans clé tombe exactement là-dessus. | Dans `useChat.ts` : en cas d'échec du premier message, soit ne pas supprimer la conversation, soit ne pas recharger l'identifiant supprimé (rester sur `/`) et afficher l'erreur du flux (« The assistant is not configured… »). Restaurer le texte tapé dans la zone de saisie, avec le bouton Retry. Ajouter un test de ce parcours. |
| 2 | MINEUR | Le README annonce « 32 automated tests » (ligne 41) mais `pytest` en exécute 34. | `pytest -q` : « 34 passed ». README ligne 41. | Corriger le nombre, ou écrire « more than 30 ». |
| 3 | MINEUR | GitHub n'est pas à jour (action en attente, voulue par le coordinateur et l'étudiant). C-18/C-19 ne sont donc pas démontrés par la copie distante tant que le push n'est pas fait. | Information du coordinateur. Dépôt non revérifié dans ce tour. | Après l'accord : commit, `git push`, puis `gh api repos/mordehailevy/cortanyx/git/trees/main?recursive=1` pour vérifier que `requirements-dev.txt` et l'export à jour y figurent. |
| 4 | MINEUR | `npm audit` : 2 vulnérabilités modérées, issues d'un outil de build (`@tailwindcss/typography`). Rien à forcer, mais cela s'affiche à l'installation. | `npm install` : « 2 moderate severity vulnerabilities ». | Une phrase dans le README. |
| 5 | IDÉE | Les dates de l'API n'ont pas de fuseau (`2026-10-30T02:05:56.398000`, sans `Z`). | `GET /api/conversations/{id}`. | Sérialiser avec `Z`. |

## Vérification des corrections du tour précédent
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 MAJEUR : `pytest` rouge (26/32) avec un `.env` copié de l'exemple | **Oui** | `cp .env.example .env`, `pip install -r requirements-dev.txt`, `pytest -q` : « 34 passed in 0.87s ». |
| 2 MINEUR : GitHub en retard | En attente (voulu) | Push prévu à la fin avec l'accord de l'étudiant. Constat 3. |
| 3 MINEUR : 2 vulnérabilités npm d'outil de build | Accepté | Toujours affichées, sans risque en production. Constat 4. |
| 4 MINEUR : README sans avertissement sur `pytest` | **Oui** | Les tests ne dépendent plus du `.env` ; plus aucune surprise après l'installation. |
| 5 IDÉE : dates sans fuseau | Non (idée, non demandée) | Idem constat 5. |
| Nouveautés annoncées : limite 413 chunked, index `messages.created_at`, chunk Markdown 238 kB, Postman 17 requêtes, export et zip régénérés | **Oui, toutes** | 413 en JSON et en chunked ; `show index from messages` liste `idx_messages_created` ; Markdown-… 237,80 kB ; collection de 17 requêtes ; zip 268 Ko ; export avec `pinned`. |

## Journal d'installation (commande → résultat)
| Étape | Commande | Résultat |
|---|---|---|
| Zip | `./make_submission.sh` | « Created MordehaiLevy.zip (268K) », 82 fichiers, propre. |
| Base | `sed s/chatgpt_clone/correcteur_tmp/g Database/chatgpt_clone.sql \| mysql -u root` | 12 conversations, 48 messages, `pinned` et `idx_messages_created` présents. |
| Backend | `python3.12 -m venv env`, `cp .env.example .env`, `pip install -r requirements-dev.txt`, `pytest -q` | **34 passed en 0,87 s.** |
| Backend, démarrage | `.env` adapté (DATABASE_URL vers `correcteur_tmp`, clé vide), `uvicorn app.main:app --port 8010 --no-proxy-headers` | `/api/health` ok, `/docs` 200, liste 200. |
| Backend, API | Création, envoi sans clé (503, JSON et SSE), 422, 413 (normal et chunked), `/regenerate` 409 et 404, hôte falsifié 400, DELETE 204 | Conformes. |
| Frontend | `npm install`, `npm run build`, `npm run lint` | Build OK (441 kB, Markdown 238 kB), lint propre, 2 vulnérabilités d'outil de build. |
| Navigateur | Vite sur 5199 avec le proxy vers 8010 (copie locale modifiée), saisie réelle | **« Conversation not found. »** au lieu de l'erreur 503 (constat 1). |

Parcours du README : plus aucun point flou. Seule retenue : le chiffre des tests (constat 2).

## Détail du barème
| Critère | Points obtenus |
|---|---|
| Respect de l'énoncé (C-01 à C-25) | 28/30. C-18/C-19 en attente du push (-2). |
| Fonctionnement | 17/20. Le chemin d'erreur du premier message est trompeur (-2) ; pas de vrai échange OpenAI testable sans clé (-1). |
| Qualité du code serveur | 15/15. |
| Qualité du code client | 9/10. -1 pour la régression de gestion d'erreur (constat 1). |
| Base de données | 10/10. |
| Esthétique et expérience utilisateur | 9/10. |
| Documentation, Postman, facilité d'installation | 4/5. -1 pour le nombre de tests faux dans le README. |
| **Total** | **92/100** |

Bonus : streaming SSE avec Stop, régénération, hébreu RTL, 34 tests indépendants de la configuration, hôte de confiance, limite de corps de requête. Rien à retirer de plus.

## Ce que j'écrirais en commentaire sur la copie
« Installation sans accroc dans l'ordre du README, 34 tests verts, export fonctionnel, API très propre sur les cas limites : excellent. Un défaut visible : sans clé (ou avec une clé invalide), le premier message d'une nouvelle conversation affiche "Conversation not found." au lieu de l'erreur réelle, et le texte tapé disparaît. Corrigez ce parcours, mettez le chiffre des tests à jour et poussez sur GitHub : c'est un 9,5. »

## Ce qu'il faudrait pour passer à 10
- Corriger le constat 1 : afficher la vraie erreur après l'échec du premier message, garder le texte saisi et ajouter un test.
- Mettre le nombre de tests du README à 34 (constat 2).
- Pousser sur GitHub et vérifier l'arbre distant (constat 3).
- Sérialiser les dates avec `Z` et mentionner l'avertissement npm (constats 4 et 5).

Nettoyage fait : serveur 8010 et Vite arrêtés, base `correcteur_tmp` supprimée, dossier de travail supprimé, mon onglet (tab-19) fermé. Conversations de test : une créée par DELETE (supprimée), et deux autres créées par l'interface puis supprimées par le client lui-même, toutes dans `correcteur_tmp` détruite avec la base. Attention : par erreur, j'ai navigué l'onglet existant `tab-7` vers `http://127.0.0.1:5199/about` (il n'est pas à moi). Il pointe maintenant sur un serveur arrêté et peut être refermé ou rechargé. Le serveur sur 8000 répond toujours, la base `chatgpt_clone` n'a pas été touchée, aucun appel au vrai chat. Seul fichier modifié dans le projet : `/Users/annahbenyamine/MordehaiLevy/MordehaiLevy.zip` (régénéré par `./make_submission.sh`).
