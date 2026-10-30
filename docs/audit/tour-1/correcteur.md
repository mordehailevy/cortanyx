# Audit audit-correcteur — tour 1
Note : 8/10 (89/100 au barème du jury) — NON VALIDÉ (1 point MAJEUR bloque la validation du jury : `pytest` échoue 26/32 avec le `.env` créé comme le README le demande ; ≥ 9 atteint dès que c'est corrigé)

Réserve : j'ai installé avec `requirements-dev.txt` et `pytest` donne 26 échecs sur 32 dès qu'un `.env` copié de `.env.example` existe. Un correcteur qui suit le README dans l'ordre (étape 2 : `cp .env.example .env`, puis `pytest`) tombe sur ce rouge massif. Ce n'est pas bloquant pour l'énoncé (l'application fonctionne), mais c'est le défaut le plus visible de ce tour, à corriger avant le rendu.

## Ce qui est excellent
- **L'import de l'export fonctionne maintenant.** `Database/chatgpt_clone.sql` importé dans `correcteur_tmp` (sed + `mysql -u root`) crée 2 tables et 1 vue, avec `pinned` (tinyint, indexé), 7 conversations et 32 messages. `GET /api/conversations` renvoie 200 avec les conversations d'exemple, `pinned: true` sur la première. La vue `v_conversation_messages` donne `User` / `ChatGPT`.
- **Erreur de clé manquante propre.** `POST .../messages` répond 503 `{"detail":"The assistant is not configured: the server has no OpenAI API key (Backend/.env)."}`. Le flux SSE renvoie l'événement `error` avec `status: 503`. `GET` ensuite : `messages: []` et `updated_at` inchangé (21:02:50.383 avant et après : le constat 7 est corrigé).
- **Rendu et build.** Le zip (264 Ko, 82 fichiers) ne contient ni `docs/audit/`, ni `Header.tsx`, ni `Sidebar.tsx`, ni `.env`, ni `env/`, ni `node_modules/`. `npm run build` : bundle principal 440 kB (Markdown 330 kB et page À propos 8 kB chargés à la demande, plus d'avertissement de taille). `npm run lint` : propre.
- **Contexte visible dans l'interface.** Le chat de l'export (`/chat/b59f8614-…`) affiche la conversation complète : messages utilisateur à droite (x = 592), réponses à gauche (x = 452), et la dernière réponse "Tu t'appelles Mordehai…" prouve que le contexte était gardé. Pas de défilement horizontal (scrollWidth 1280). Le titre de l'onglet suit la conversation.
- **Documentation d'installation nettement meilleure.** Commande d'import en premier (`mysql -u root -p < Database/chatgpt_clone.sql`), `-p` facultatif, création de l'utilisateur MySQL, URL docker-compose avec le port 3307, clé OpenAI signalée comme requise, `--no-proxy-headers` expliqué.

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | MAJEUR | Avec le `.env` créé depuis `.env.example`, `pytest` échoue : 26 failed, 6 passed. `.env.example` contient `ALLOWED_HOSTS=localhost,127.0.0.1`, sans `testserver`, hôte utilisé par le client de test, donc le middleware `TrustedHostMiddleware` répond « Invalid host header » (400). Sans `.env`, les 32 tests passent. Le défaut de `config.py` (`localhost,127.0.0.1,testserver`) est écrasé par la valeur du `.env`. | `pytest -q` avec `.env` : "26 failed, 6 passed", `assert 400 == 201`, corps `Invalid host header`. Sans `.env` : "32 passed in 0.76s". `ALLOWED_HOSTS=` vide : encore 26 échecs. `.env.example` ligne 21. | Dans `tests/conftest.py`, forcer l'environnement avant d'importer l'application : `os.environ["ALLOWED_HOSTS"] = "testserver,localhost"` (et idéalement `OPENAI_API_KEY=""`, `DATABASE_URL="sqlite://"`) au début du fichier. Ou ajouter `testserver` à `.env.example`. Les tests ne doivent pas dépendre du `.env` du développeur. |
| 2 | MINEUR | GitHub n'est pas à jour. La publication est annoncée « à la fin, avec l'accord de l'étudiant ». C'est une action en attente, à faire avant le rendu (C-18/C-19). | Information du coordinateur. Je n'ai pas revérifié le dépôt (aucun accès demandé dans ce tour). | Après accord : commit, `git push`, puis `gh api repos/mordehailevy/cortanyx/git/trees/main?recursive=1` pour vérifier que `requirements-dev.txt` et `AppSidebar.tsx` y sont. |
| 3 | MINEUR | `npm audit` signale toujours 2 vulnérabilités modérées (`postcss-selector-parser` via `@tailwindcss/typography`). Ce paquet n'est qu'un outil de build : risque nul en production. | `npm install` : "2 moderate severity vulnerabilities". | Rien à forcer. Ajouter une ligne au README, ou attendre la prochaine version de `@tailwindcss/typography`. |
| 4 | MINEUR | `requirements-dev.txt` ne dit pas que le `.env` perturbe les tests (voir constat 1), et le README annonce « Tests : `pip install -r requirements-dev.txt` then `pytest` » sans prévenir. | README, section Backend. | Résolu par la correction du constat 1. |
| 5 | IDÉE | Les dates de l'API restent sans fuseau (`2026-10-29T21:02:50.383000`). Ce n'est pas gênant, mais un « Z » éviterait une ambiguïté. | `GET /api/conversations/{id}`. | Sérialiser en UTC avec `Z`, ou une phrase dans le README. |

## Vérification des corrections du tour précédent
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 BLOQUANT : export sans `pinned` | **Oui** | Import de `chatgpt_clone.sql` OK. `describe conversations` montre `pinned tinyint(1)` indexé. `GET /api/conversations` 200 avec 7 conversations. `grep -c pinned` = 2. L'application tourne sur la base importée, y compris création, PATCH `pinned` (200) et DELETE (204). |
| 2 MAJEUR : GitHub en retard | En attente (voulu) | Annoncé comme action de fin de parcours, avec accord de l'étudiant. Retenu comme action en attente (constat 2). |
| 3 MAJEUR : fichiers d'audit dans le zip | **Oui** | `unzip -l \| grep docs/audit` : vide. `ls docs` dans la copie : seulement `screenshots/`. |
| 4 MINEUR : `Header.tsx` / `Sidebar.tsx` dans le zip | **Oui** | `unzip -l \| grep -E "Header\|Sidebar"` : seulement `AppSidebar.tsx`. |
| 5 MINEUR : « 10 tests » dans le README | **Oui, avec réserve** | Le chiffre est maintenant 32 et `pytest` en compte 32, mais seulement sans `.env` (constat 1). |
| 6 MINEUR : clé manquante en 500 | **Oui** | HTTP 503 et message clair, JSON et SSE. |
| 7 MINEUR : `updated_at` modifié par un échec | **Oui** | `updated_at` identique avant et après l'envoi raté (`2026-10-29T21:02:50.383000`), `messages: []`. |
| 8 MINEUR : dates sans fuseau | Non, non demandé | Toujours sans `Z` (idée 5). |
| 9 MINEUR : `requirements-dev.txt` | **Oui** | Fichier présent avec `-r requirements.txt`, pytest 9.2.0 et httpx 0.28.1. `pip install -r requirements-dev.txt` réussit. |
| 10 MINEUR : bundle 775 Ko | **Oui** | Principal 440,84 kB, Markdown 330,48 kB séparé, plus d'avertissement vite. |
| 11 IDÉE : mode mono-utilisateur dans le README | Non vérifié par lecture complète du README | Ma lecture de la section « Run it locally » ne l'a pas contredit ; la section annoncée est dans « Security ». À contrôler par le coordinateur. |
| README (import, utilisateur, `-p`, docker, clé) | **Oui** | Tous les points sont dans la section « Run it locally » (vérifié par lecture). |

## Journal d'installation (commande → résultat)
| Étape | Commande | Résultat |
|---|---|---|
| Zip | `./make_submission.sh` | "Created MordehaiLevy.zip (264K)", 82 fichiers. |
| Base | `sed s/chatgpt_clone/correcteur_tmp/g Database/chatgpt_clone.sql \| mysql -u root` | OK : 3 tables dont 1 vue, 7 conversations, 32 messages, colonne `pinned` présente. |
| Backend, installation | `/opt/homebrew/bin/python3.12 -m venv env`, `pip install -r requirements-dev.txt` | OK. |
| Backend, configuration | `.env` créé depuis `.env.example`, `DATABASE_URL` vers `correcteur_tmp`, clé vide | OK. |
| Backend, démarrage | `uvicorn app.main:app --port 8010 --no-proxy-headers` | `/api/health` ok, `/docs` 200. |
| Backend, API | Création, liste, envoi sans clé (503 JSON et SSE), 422, 404, PATCH `pinned`, DELETE | Conformes. |
| Backend, tests | `pytest -q` | **26 failed, 6 passed** (`Invalid host header`). Sans `.env` : 32 passed. |
| Frontend | `npm install`, `npm run build`, `npm run lint` | OK, 2 vulnérabilités modérées (outil de build), pas d'avertissement de taille. |
| Navigateur | Vite sur 5199 avec le proxy vers 8010 (copie locale modifiée) | Conversation importée affichée, gauche et droite correctes. |

Parcours du README : plus de point flou majeur. Il reste que `pytest` dépend du `.env` (constat 1).

## Détail du barème
| Critère | Points obtenus |
|---|---|
| Respect de l'énoncé (C-01 à C-25) | 28/30. C-18/C-19 en attente de la poussée sur GitHub (-2). Tous les autres points sont conformes. |
| Fonctionnement | 18/20. Pas de vrai échange OpenAI testable sans clé ; contexte prouvé par la conversation importée, le code et les tests. |
| Qualité du code serveur | 14/15. Pénalité pour les tests qui dépendent du `.env` (constat 1). |
| Qualité du code client | 10/10. Chargement différé du Markdown et de la page À propos, composants clairs. |
| Base de données | 9/10. Export fonctionnel, schéma lisible, vue claire. -1 : dates sans fuseau. |
| Esthétique et expérience utilisateur | 9/10. |
| Documentation, Postman, facilité d'installation | 3/5. Gros progrès du README, mais `pytest` rouge juste après l'installation (-2). |
| **Total** | **91/100 avant la pénalité de validation, retenu 89/100** (-2 pour l'échec massif des tests à l'arrivée du correcteur) |

Bonus : streaming, hébreu RTL, 32 tests, hook anti-secret, limite de débit, `--no-proxy-headers`, hôte de confiance. Rien à retirer de plus.

## Ce que j'écrirais en commentaire sur la copie
« Le rendu est solide et l'export fonctionne enfin : 7 conversations d'exemple, application opérationnelle dès l'import. En revanche, après `cp .env.example .env`, `pytest` donne 26 échecs sur 32 (`Invalid host header`). Vos tests ne doivent pas dépendre de la configuration locale : forcez les variables dans `conftest.py`. Avec ça, c'est un 9. »

## Ce qu'il faudrait pour passer à 10
- Faire passer `pytest` avec ou sans `.env` (constat 1), en forçant dans `conftest.py` `ALLOWED_HOSTS`, la clé vide et une base SQLite.
- Pousser sur GitHub et vérifier l'arbre distant (constat 2).
- Sérialiser les dates avec `Z` et noter la vulnérabilité d'outil de build dans le README (constats 3 et 5).

Nettoyage fait : serveur 8010 et Vite arrêtés, base `correcteur_tmp` supprimée, dossier de travail supprimé, onglet fermé, fenêtre à la taille par défaut. Conversation de test `86caa32c-4753-44c7-8364-95da0507f1d7` supprimée par DELETE (dans `correcteur_tmp`, détruite avec la base). Le serveur sur 8000 répond toujours ; la base `chatgpt_clone` n'a pas été touchée, aucun appel au vrai chat. Seul fichier modifié dans le projet : `/Users/annahbenyamine/MordehaiLevy/MordehaiLevy.zip` (régénéré par `./make_submission.sh`).
