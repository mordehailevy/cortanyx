# Audit audit-correcteur — tour 0
Note : 8/10 (83/100 au barème du jury) — NON VALIDÉ (1 point BLOQUANT : l'export `Database/chatgpt_clone.sql` casse l'application)

## Ce qui est excellent
- **Installation du backend sans accroc.** Le venv Python 3.12 neuf s'installe en environ 11 s (`pip install -r requirements.txt`). Le serveur démarre sur 8010. `/api/health` répond `{"status":"ok","database":"ok","openai_key_configured":false}`, et `/docs` répond 200.
- **API REST propre.**
  - Création (POST) et liste (GET) des conversations fonctionnent.
  - Un message vide renvoie 422, un message de 9000 caractères renvoie 422, un identifiant inconnu renvoie 404 ("Conversation not found").
  - Un PATCH vide est refusé avec un message clair.
  - Le DELETE renvoie 204, puis 404 au second appel.
  - Le CORS refuse l'origine `evil.com` (400).
- **Sans clé OpenAI, l'envoi échoue proprement.** L'API répond `{"detail":"OPENAI_API_KEY is missing in Backend/.env."}`. En streaming, l'événement SSE `error` arrive. Le message utilisateur est annulé : `GET` renvoie `messages: []`, donc aucun message orphelin en base. L'interface affiche l'erreur avec un bouton Retry.
- **Qualité du build.**
  - `pytest` : 12 tests passent en 0,17 s.
  - `npm install` puis `npm run build` (tsc + vite) passent, et `npm run lint` ne signale rien.
- **Interface soignée, sans débordement.**
  - À 375 px il n'y a aucun défilement horizontal (scrollWidth 375).
  - Messages utilisateur à droite (x 981-1144), réponses du chat à gauche (x 452-679).
  - Tableau Markdown et bloc de code rendus, avec boutons "Copy code" et "Copy".
  - Un `<script>` injecté dans une réponse n'est pas exécuté (0 balise `script` dans `main`).
  - Pages `/about` (système et développeur) et `/chat/<id>` fonctionnent, et une URL inconnue ramène à l'accueil.
- **Documentation et rendu.**
  - Le README est complet : fonctionnalités, schéma, tableau de l'API, sécurité, capture d'écran.
  - La collection Postman (12 requêtes avec variables `baseUrl` et `conversationId`) est dans `Backend/`.
  - Le zip fait 252 Ko et ne contient ni `.env`, ni `env/`, ni `node_modules/`.
  - La vue `v_conversation_messages` affiche bien `User` / `ChatGPT`.

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | **BLOQUANT** | L'export `Database/chatgpt_clone.sql` est périmé : il n'a pas la colonne `pinned` ni l'index `idx_conversations_list`. Le README propose pourtant `mysql -u root -p < Database/chatgpt_clone.sql` comme alternative. Un correcteur qui importe l'export (C-21 : « export fait correctement ») obtient une application cassée. | J'ai importé l'export dans `correcteur_tmp`. `describe conversations` ne liste que id, title, model, created_at, updated_at. Puis `GET /api/conversations` et `POST /api/conversations` ont renvoyé "Internal Server Error" (500). Le journal uvicorn montre la requête SQL sur `conversations.pinned`. L'export contient 3 conversations et 12 messages ; `grep pinned chatgpt_clone.sql` ne trouve rien. `schema.sql` l'a, lui (lignes 28 et 32). | Régénérer l'export juste avant `./make_submission.sh`, à partir d'une base créée par le `schema.sql` actuel : `mysqldump -u root --routines --databases chatgpt_clone > Database/chatgpt_clone.sql`. Puis vérifier par l'import dans une base temporaire et un `GET /api/conversations` à 200. Ajouter à `make_submission.sh` un garde-fou `grep -q pinned Database/chatgpt_clone.sql \|\| exit 1`. |
| 2 | MAJEUR | Le dépôt GitHub (C-18/C-19) est en retard sur ce qui est rendu. Le seul commit (`abd598c`) date de 20:01 ; `git status` montre 23 chemins modifiés ou non suivis (pinned, nouvelle barre latérale, `Dialogs`, `Menu`, `context/`, schéma, tests, README). | `gh repo view mordehailevy/cortanyx` : PUBLIC, `pushedAt` 18:01Z. `git status --short` : 17 fichiers modifiés ou supprimés, 6 chemins non suivis. | Après correction, faire `git add -A` (hors `.claude/`, déjà exclu du zip), un commit, un `git push`, puis vérifier avec `gh api repos/mordehailevy/cortanyx/git/trees/main?recursive=1` que `Frontend/src/components/AppSidebar.tsx` y figure. |
| 3 | MAJEUR | Le zip contient des fichiers d'audit internes : `docs/audit/consignes.md`, `grille.md`, `conversations-avant-audit.txt` (liste d'identifiants et de titres de vraies conversations) et un dossier vide `tour-0/`. Ce n'est pas du rendu étudiant. Le script exclut `.claude/` mais pas `docs/audit/`. | `unzip -l MordehaiLevy.zip` : lignes `docs/audit/...`. Le premier fichier commence par `b59f8614-f2ff-4eb2-b135-03f310281541 True Conseils pour débuter en React`. | Dans `make_submission.sh`, ajouter `--exclude 'docs/audit/'`. Ou déplacer l'audit hors du dossier du projet. |
| 4 | MINEUR | Mon zip (généré à 20:45) contenait deux composants morts, `Frontend/src/components/Header.tsx` et `Sidebar.tsx`. Aucun import ne les référençait (`grep` vide) : ils étaient remplacés par `AppSidebar.tsx`. Je ne les retrouve plus dans le dossier de travail (`ls` : absents), donc ils ont sans doute été supprimés depuis. À confirmer en régénérant le zip. | `unzip -l` : `Header.tsx` (1679 octets, 19:38) et `Sidebar.tsx` (6928 octets, 19:56) présents. `git status` : « D ». | Régénérer le zip après suppression et vérifier avec `unzip -l \| grep -E 'Header\|Sidebar'`. |
| 5 | MINEUR | Le README dit "10 automated tests", mais `pytest` en exécute 12. | `pytest -q` : "12 passed". README, section Features. | Mettre "12" ou écrire "a dozen". |
| 6 | MINEUR | Clé absente : le serveur répond 500 avec un message de développeur ("OPENAI_API_KEY is missing in Backend/.env."). Ce message est montré tel quel à l'utilisateur dans le chat. Une erreur de configuration devrait être un 503, avec un texte neutre côté interface. | `curl -X POST .../messages` : `[500]`. Capture DOM : `role=alert` contient le texte brut. | Dans `AIServiceError`, renvoyer 503 et un texte de type "The assistant is not configured yet." ; garder la précision dans les logs et `/api/health`. |
| 7 | MINEUR | Un envoi qui échoue (message annulé) modifie quand même `updated_at` de la conversation, donc la conversation remonte dans la liste sans nouveau message. | Après l'échec de streaming, `updated_at` est passé de 20:45:43 à 20:45:52 alors que `messages` est vide. | Restaurer l'ancien `updated_at` lors de la suppression du message utilisateur, ou ne mettre à jour `updated_at` qu'après la réponse. |
| 8 | MINEUR | Les dates de l'API n'ont pas de fuseau (`"2026-10-29T20:45:43.242000"` sans `Z`). Le dump est en `TIME_ZONE='+00:00'`, ce qui prête à confusion à l'affichage. | Réponses JSON de `POST /api/conversations`. | Sérialiser en UTC avec `Z`, ou documenter que les dates sont en UTC. |
| 9 | MINEUR | `pytest` et `httpx` sont dans le `requirements.txt` de production, sans séparation. `npm audit` signale 2 vulnérabilités modérées (`postcss-selector-parser` via `@tailwindcss/typography`). | `pip install` installe pytest. `npm audit` : "2 moderate severity vulnerabilities". | Créer `requirements-dev.txt`. Pour npm, c'est un outil de build sans risque en usage : le noter, pas de `--force`. |
| 10 | MINEUR | Le bundle JS fait 775 Ko (245 Ko gzip), et vite avertit. La coloration syntaxique (highlight.js) en est probablement la cause. | Sortie de `npm run build` : "Some chunks are larger than 500 kB". | `React.lazy` pour le Markdown, ou ne charger que les langages utiles. |
| 11 | IDÉE | Il n'y a aucune authentification : toute personne qui atteint l'API voit toutes les conversations. C'est acceptable pour le projet de cours, et la limite de débit protège le budget OpenAI. | `GET /api/conversations` ouvert. | Ajouter une ligne dans le README (« usage mono-utilisateur local ») pour désarmer la question d'un correcteur. |

## Journal d'installation (commande → résultat)
| Étape | Commande | Résultat |
|---|---|---|
| Zip | `./make_submission.sh` | "Created MordehaiLevy.zip (252K)", 83 fichiers, structure `Database/ Backend/ Frontend/` conforme à C-21. |
| Base, export | `sed s/chatgpt_clone/correcteur_tmp/g Database/chatgpt_clone.sql \| mysql -u root` | Importé sans erreur : 2 tables et 1 vue, 3 conversations, 12 messages. **La table `conversations` n'a pas de `pinned`** (constat 1). |
| Base, schéma | idem avec `Database/schema.sql` | OK : 2 tables, 1 vue, tables vides. |
| Backend, venv | `/opt/homebrew/bin/python3.12 -m venv env && pip install -r requirements.txt` | 40 paquets installés, environ 11 s. |
| Backend, configuration | `.env` créé depuis `.env.example`, `DATABASE_URL` vers `root@localhost/correcteur_tmp`, clé vide | OK. |
| Backend, démarrage | `uvicorn app.main:app --port 8010` | Démarre. `/api/health` ok, `/docs` 200. |
| Backend, API | Appels `curl` sur les conversations (création, liste, détail, PATCH, DELETE, 404, 422) | Conformes (détail dans « Ce qui est excellent »). |
| Backend, envoi sans clé | `POST .../messages` et `.../messages/stream` | Erreur claire (500 / événement SSE `error`), message annulé en base. |
| Backend, tests | `pytest -q` | 12 passed en 0,17 s (SQLite en mémoire, faux client OpenAI). |
| Backend, export dans l'application | Réimport de l'export, puis `GET /api/conversations` | **500 Internal Server Error** (colonne `pinned` absente). |
| Frontend, installation | `npm install` | OK (Node 24.13, npm 11.6). |
| Frontend, build | `npm run build` | OK, avec l'avertissement de taille du bundle (775 Ko). |
| Frontend, lint | `npm run lint` | Aucune sortie d'erreur. |
| Navigateur | Vite sur 5199, proxy redirigé vers 8010, le vrai serveur 8000 non utilisé | Accueil, envoi, erreur avec Retry, conversation avec tableau, code, hébreu, `/about`, URL inconnue, 375 px : tout fonctionne. |

**Parcours du README : points flous.**
- Le README ne dit pas que `.env.example` contient un utilisateur `chat_app`. Il faut donc créer cet utilisateur avec la commande SQL fournie, ou changer `DATABASE_URL`. Le README ne dit pas non plus que `schema.sql` supprime les tables existantes (`DROP TABLE`). `chatgpt_clone.sql` fait de même.
- Un vrai test de chat n'a pas été possible faute de clé : « conversation continue avec contexte » n'est vérifié que par les tests unitaires avec faux client (`tests/test_api.py`) et par l'envoi de tout l'historique dans le code, pas par un vrai échange.
- Le README donne la ligne de commande macOS/Linux, avec la variante Windows pour l'activation du venv. La création de l'utilisateur MySQL suppose un mot de passe `root` (`-p`), alors qu'en local il peut ne pas y en avoir.
- Le rôle de `docker-compose.yml` (port 3307) est mentionné mais l'URL de connexion correspondante n'est pas donnée.
- La clé OpenAI est exigée en prérequis ; le correcteur doit en fournir une pour tester le chat, ce qui devrait être dit plus clairement en tête de document.
- Le démarrage de la partie 3 suppose que le backend tourne sur le port 8000 (proxy Vite), ce que le README dit.

## Détail du barème
| Critère | Points obtenus |
|---|---|
| Respect de l'énoncé (C-01 à C-25) | 26/30. Tout est conforme sauf C-21 (export périmé, constat 1) et C-18/C-19 (GitHub en retard, constat 2). C-09 est dépassé (la conversation se réaffiche). C-23, C-24 et C-25 sont conformes (zip vérifié). |
| Fonctionnement | 17/20. Nouvelle conversation, menu, À propos et contexte persistant (tests et code) sont conformes. Je n'ai pas pu tester une vraie réponse OpenAI. |
| Qualité du code serveur | 13/15. Structure routeur / service / schémas nette, validation Pydantic, limite de débit, clé jamais exposée. Pénalités : erreur de configuration en 500, `updated_at` modifié par un échec. |
| Qualité du code client | 9/10. Composants, contexte, hook `useChat`, `api.ts`. Pénalité : bundle volumineux. |
| Base de données | 6/10. Bonne conception (UUID, ENUM `role`, clé étrangère en cascade, vue lisible), mais l'export, qui est le livrable, ne correspond plus au schéma. |
| Esthétique et expérience utilisateur | 9/10. Propre, responsive, thème clair / sombre, hébreu en `dir="auto"`. |
| Documentation, Postman, facilité d'installation | 3/5. README riche, Postman complet. Pénalités : export cassé, prérequis MySQL incomplets, chiffre des tests faux. |
| **Total** | **83/100** |

Bonus que j'accorderais, plafonnés au maximum de chaque critère déjà atteint : streaming SSE avec Stop, hébreu RTL, 12 tests pytest, hook pre-commit anti-secret, limite de débit, titres générés, épinglage. Je retirerais des points pour l'export périmé (déjà compté) et pour les fichiers d'audit dans le zip.

## Ce que j'écrirais en commentaire sur la copie
« Projet très abouti, bien au-dessus de l'énoncé : architecture claire, interface soignée, tests, sécurité de la clé exemplaire. Mais j'ai importé votre export SQL comme l'indique le README, et l'application a renvoyé des erreurs 500 sur toutes les routes de conversations : l'export ne contient pas la colonne `pinned`. C'est le fichier que je regarde en premier. Régénérez-le, vérifiez qu'il fonctionne, et poussez la dernière version sur GitHub. Retirez aussi les fichiers d'audit du zip. Avec ces corrections, c'est un 9. »

## Ce qu'il faudrait pour passer à 10
- Régénérer `Database/chatgpt_clone.sql` depuis le schéma actuel et vérifier qu'une base importée depuis cet export fait tourner l'API (constat 1), avec un garde-fou dans `make_submission.sh`.
- Pousser sur GitHub le code et l'export à jour (constat 2) et exclure `docs/audit/` du zip (constat 3).
- Confirmer par un zip régénéré que `Header.tsx` et `Sidebar.tsx` n'y sont plus (constat 4).
- Corriger le chiffre des tests (constat 5), ainsi que le statut 503 et le message de configuration (constat 6), puis le `updated_at` après échec (constat 7).
- Compléter le README sur l'utilisateur MySQL et préciser qu'une clé OpenAI est nécessaire pour tester le chat.
- Séparer `requirements-dev.txt` et alléger le bundle (constats 9 et 10).

Nettoyage fait : serveur 8010 et Vite arrêtés, base `correcteur_tmp` supprimée (la liste des bases ne contient plus que les autres), dossier de travail supprimé, onglet fermé et fenêtre remise à la taille par défaut. Conversations de test créées : `f0b69f5d-ea35-458f-8ed6-10413c38d56e` (supprimée par DELETE), `a2b51da8-7e65-4076-b7ad-37b9e26b17f4` et `11111111-1111-4111-8111-111111111111` (dans `correcteur_tmp` uniquement, détruites avec la base). Le vrai serveur sur 8000 répond toujours, la base `chatgpt_clone` n'a pas été touchée, aucun appel au vrai chat. Seul fichier modifié dans le projet : `/Users/annahbenyamine/MordehaiLevy/MordehaiLevy.zip` (régénéré par `./make_submission.sh`).
