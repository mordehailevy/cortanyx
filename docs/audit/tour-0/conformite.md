# Audit audit-conformite — tour 0
Note : 6/10 — NON VALIDÉ

(2 points BLOQUANTS : l'export de la base est périmé et le zip de rendu contient des fichiers fantômes. Les deux sont rapides à corriger. Tout le reste de l'énoncé est respecté.)

## Ce qui est excellent
- **Contexte exact (C-07)** : test réel avec `POST /api/conversations/{id}/messages`. J'ai envoyé « Mon nombre préféré est 42 », puis « Quel est mon nombre préféré ? ». Réponse : « Ton nombre préféré est 42. ». `GET` renvoie `['user','assistant','user','assistant']`.
- **Secrets (C-10, C-11, C-20)** :
  - `git check-ignore -v Backend/.env` répond `.gitignore:3:*.env`.
  - `git ls-files | grep '\.env$'` est vide.
  - L'arbre GitHub ne contient que `Backend/.env.example` et `Frontend/.env.example`.
  - `grep openai` dans `Frontend/src` ne trouve que des textes de la page « À propos » et un commentaire. Aucun appel OpenAI côté client.
  - Le front n'appelle que `/api` via `VITE_API_URL`, vide par défaut.
- **Base (C-15 à C-17)** : `messages.role` est un ENUM('user','assistant'), `conversation_id` CHAR(36) avec clé étrangère `ON DELETE CASCADE`. La vue `v_conversation_messages` affiche `User` / `ChatGPT` avec l'id et le titre de la conversation.
- **Infrastructure et pages** : FastAPI épinglé dans `requirements.txt` (C-12). MySQL est dans `DATABASE_URL`. Routes React `/`, `/chat/:id`, `/about` (`Frontend/src/App.tsx:121-123`). Le bouton « New chat » est dans la sidebar (`AppSidebar.tsx:68,108`) et dans l'en-tête mobile (`App.tsx:113`). Bulles utilisateur à droite (`MessageBubble.tsx:30`, `justify-end`), chat à gauche. La page « À propos » a une section « The developer » (`AboutPage.tsx:122+`).
- **GitHub (C-18, C-19)** : `gh repo view` donne `PUBLIC`, `https://github.com/mordehailevy/cortanyx`. Ce lien est dans `README.md` ligne 9.
- **Postman (C-22)** : `Backend/ChatGPT-Clone.postman_collection.json` est dans le dossier du serveur et est valide (2 dossiers d'items).
- **Zip, parties conformes** : le dossier racine est `MordehaiLevy/` avec `Database/`, `Backend/`, `Frontend/`. Aucun `Backend/env`, `node_modules` ni `.env` (les `.env.example` sont normaux). Les contrôles de sécurité du script passent.

## Tableau C-01 → C-25
| ID | Verdict | Preuve |
|---|---|---|
| C-01 | CONFORME | Conversation continue testée en vrai via l'API (42 retrouvé) |
| C-02 | CONFORME | FastAPI dans `requirements.txt` et `main.py:9`. React SPA avec `react-router` (`App.tsx`). Le front n'appelle que `/api` |
| C-03 | CONFORME | `DATABASE_URL=mysql+pymysql://…`. Base `chatgpt_clone` active |
| C-04 | CONFORME | `POST /api/conversations` crée une conversation (201). Composer et EmptyState sur `/` |
| C-05 | CONFORME | `MessageBubble.tsx:30` : `justify-end` pour l'utilisateur, `justify-start` pour le chat |
| C-06 | CONFORME | 2 messages enchaînés dans la même conversation (API) |
| C-07 | CONFORME | Réponse 2 = « Ton nombre préféré est 42. ». Historique complet renvoyé par `GET` |
| C-08 | CONFORME | Bouton « New chat » (`AppSidebar.tsx:108`, `App.tsx:113`) appelle `chat.newChat()` |
| C-09 | CONFORME | `useChat.ts:14` : un refresh repart sur une conversation vide (autorisé) |
| C-10 | CONFORME | Seul `Backend/app/services/openai_service.py` appelle OpenAI. Aucun appel dans `Frontend/src` |
| C-11 | CONFORME | `Backend/.env` ignoré et jamais suivi. `config.py:10` lit `.env`. `health.openai_key_configured` est true. Le contenu de `Backend/.env` n'a pas été lu |
| C-12 | CONFORME | `Backend/requirements.txt`, 12 lignes, versions épinglées |
| C-13 | CONFORME | `AboutPage.tsx` : section système (stack, architecture) et section « The developer » |
| C-14 | CONFORME | Menu avec routes `/` et `/about` (`App.tsx:121-123`, `AppSidebar`) |
| C-15 | CONFORME | Les messages sont écrits en base (id 70 à 73 pendant mon test). Vue peuplée |
| C-16 | CONFORME | `messages.role` ENUM('user','assistant'). La vue affiche `User` / `ChatGPT` |
| C-17 | CONFORME | `conversation_id` CHAR(36) UUID avec clé étrangère. La vue affiche l'id et le titre |
| C-18 | CONFORME | Dépôt public `mordehailevy/cortanyx` (1 commit). Voir le risque R1 : les changements locaux n'y sont pas |
| C-19 | CONFORME | `README.md:9` : lien GitHub |
| C-20 | CONFORME | `.gitignore` : `.env`, `*.env`, `!.env.example`. Aucun `.env` dans l'arbre GitHub |
| C-21 | PARTIEL | Structure et nom corrects, mais l'export `Database/chatgpt_clone.sql` est périmé (constat 1) |
| C-22 | CONFORME | Postman dans `Backend/` (et dans le zip) |
| C-23 | CONFORME | Absent du zip. `Backend/env` existe seulement en local, exclu par le script |
| C-24 | CONFORME | Pas de `node_modules` dans le zip |
| C-25 | PARTIEL | Un seul zip `MordehaiLevy.zip`, mais il contient des fichiers fantômes (constat 2) |

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | BLOQUANT | L'export `Database/chatgpt_clone.sql` ne contient pas la colonne `conversations.pinned`. Elle est dans le modèle (`models.py`), dans `schema.sql` (2 occurrences) et dans la base vivante, mais le dump a 0 occurrence. Un correcteur qui importe l'export obtient une base incompatible avec le backend actuel (erreurs SQL dès le listing des conversations). L'export contient aussi 3 conversations / 12 messages, contre 7 / 32 en base vivante. Il n'est pas faux, mais il est ancien. | `grep -c pinned Database/chatgpt_clone.sql` donne 0. `SHOW COLUMNS FROM conversations` donne id, title, model, pinned, created_at, updated_at. L'import de l'export dans `audit_import_tmp` a réussi (3 / 12 / 12 lignes), mais sans `pinned`. | Après tous les changements de schéma, refaire l'export : `mysqldump -u root --databases chatgpt_clone --routines --triggers > Database/chatgpt_clone.sql` (ou la commande du README). Vérifier `grep -c pinned` > 0. Ré-importer dans une base temporaire et lancer le backend dessus. Le refaire à la toute fin, après les tours d'audit, et supprimer les conversations de test avant l'export. |
| 2 | BLOQUANT | `make_submission.sh` ne supprime pas l'ancien zip. `zip -qr` met à jour le zip existant, donc il y reste les fichiers supprimés depuis. Après régénération, `MordehaiLevy.zip` contient encore `Frontend/src/components/Header.tsx` et `Sidebar.tsx`, absents du projet. Ces vieux composants peuvent entrer en conflit avec le nouveau code, et le correcteur verrait des fichiers morts. | `unzip -l MordehaiLevy.zip` liste `Header.tsx` (1679 octets) et `Sidebar.tsx` (6928 octets). `ls Frontend/src/components` et `submission/MordehaiLevy/.../components/` ne les ont pas. Le script n'a pas de `rm -f "$ROOT/$NAME.zip"`. | Ajouter `rm -f "$ROOT/$NAME.zip"` avant la ligne `zip -qr`. Régénérer, puis vérifier avec `unzip -l` que ces deux fichiers n'y sont plus. Le zip actuel dans le projet est lui aussi pollué : le régénérer après correction. |
| 3 | MAJEUR | Le zip embarque du matériel d'audit interne : `docs/audit/` (consignes, grille, `conversations-avant-audit.txt`, `tour-0/`). Il contient aussi `.githooks/` et `docker-compose.yml`. Cela ne figure pas dans l'énoncé et révèle un processus de relecture par des agents. | `unzip -l` liste `MordehaiLevy/docs/audit/...`. | Ajouter `--exclude 'docs/audit/'` au `rsync` de `make_submission.sh`, ou supprimer `docs/audit/` avant le rendu. Garder `docs/screenshots/`, utile au README. |
| 4 | MAJEUR | GitHub est en retard sur le dossier local. Le dépôt n'a qu'un commit, `abd598c`. Le travail local (sidebar `AppSidebar` / `Dialogs` / `Menu`, épinglage, schéma, README, tests) est non commité : 17 fichiers modifiés et 2 supprimés. Un correcteur qui clone le dépôt voit une autre version que le zip. | `git status` : 19 fichiers modifiés ou supprimés, plus des fichiers non suivis. `gh api …/commits` ne montre que `abd598c`. | À la fin des audits : commit, puis push (sur ordre de l'utilisateur seulement). Vérifier ensuite avec `gh api …/git/trees/main?recursive=1` que l'arbre GitHub correspond au zip, et qu'aucun `.env` n'y est. |
| 5 | MINEUR | `Backend/ChatGPT-Clone.postman_collection.json` est modifié et non commité. Le zip prend la version locale. Il faut vérifier que les requêtes Postman correspondent aux routes actuelles (épinglage). | `git status` : `M Backend/ChatGPT-Clone.postman_collection.json`. | Ré-exporter ou relire la collection et lancer le runner Postman une fois avant le rendu. |
| 6 | IDÉE | Le nom du fichier de base `chatgpt_clone.sql` est conforme à l'énoncé. On peut ajouter une ligne au README (« Importer : `mysql -u root < Database/chatgpt_clone.sql` ») pour guider un correcteur pressé. | `README.md:101` ne mentionne que le contenu du fichier. | Ajouter la commande d'import dans la section Database. |

## Risques de correction
- **R1 : un correcteur importe l'export.** Sans `pinned`, le backend plante au listing des conversations. Parade : constat 1.
- **R2 : le correcteur ouvre le zip et trouve `Header.tsx` / `Sidebar.tsx`.** Parade : constat 2, avec un `unzip -l` de contrôle.
- **R3 : le correcteur clone GitHub au lieu de regarder le zip.** Il voit l'ancienne interface, sans épinglage ni menu. Parade : constat 4.
- **R4 : le correcteur cherche le bouton « New chat » sur mobile.** Il est dans l'en-tête (`App.tsx:113`, icône carré-crayon, `aria-label="New chat"`) et dans la sidebar. Sur desktop il est dans la sidebar. Risque faible. Le README le dit déjà (ligne 24).
- **R5 : la `Backend/env` locale est gitignorée et exclue du zip, donc rien à craindre.** Mais le zip n'a pas de procédure d'installation propre dans un seul endroit : le README est dans le zip, pas de souci.

## Vérification des corrections du tour précédent
Tour 0 : sans objet.

## Ce qu'il faudrait pour passer à 10
1. Refaire l'export `Database/chatgpt_clone.sql` avec `pinned`, le tester à l'import, puis lancer le backend dessus.
2. Corriger `make_submission.sh` (`rm -f` de l'ancien zip) et exclure `docs/audit/`. Régénérer le zip et vérifier avec `unzip -l`.
3. Commiter et pousser pour que GitHub corresponde au zip, avec vérification de l'arbre (aucun `.env`).
4. Optionnel : la commande d'import dans le README et un run de Postman.

Avec ces corrections, les 25 exigences seraient CONFORMES et la note monterait à 9 ou 10.

## Nettoyage et traçabilité
- Conversation de test créée puis supprimée : `54574fa4-62a5-4f20-bfcf-02696a8e0338` (DELETE 204, puis GET 404).
- Messages envoyés au chat : 2 sur 6 autorisés.
- Base temporaire `audit_import_tmp` supprimée (vérifié par `show databases`).
- Les conversations existantes de `conversations-avant-audit.txt` n'ont pas été touchées.
- Fichiers temporaires dans `/private/tmp/claude-501/-Users-annahbenyamine-RADAR/96b9b765-907d-4632-8a2f-fda7a8c7a804/scratchpad/audit-conformite` : `imp.sql` (copie de l'export avec le nom de base remplacé) et `c.json`.
- J'ai régénéré `./make_submission.sh` deux fois, comme la méthode le prévoit. Cela a modifié `MordehaiLevy.zip` et `submission/` (tous deux gitignorés) : le zip reste pollué par les fantômes tant que le script n'est pas corrigé.
- Aucun fichier suivi par git n'a été modifié. Aucun commit ni push. Aucun secret affiché : le `OPENAI_API_KEY` de `Backend/.env.example` est un exemple, et je n'ai pas ouvert `Backend/.env`.
- Je n'ai pas testé le rendu dans le navigateur (hors périmètre de cet audit) : mes verdicts d'interface reposent sur le code.
