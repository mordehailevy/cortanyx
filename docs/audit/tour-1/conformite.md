# Audit audit-conformite — tour 1
Note : 9.5/10 — VALIDÉ (aucun point BLOQUANT ; une ACTION en attente : le push GitHub)

## Ce qui est excellent
- **Export de la base corrigé (C-21)** : `Database/chatgpt_clone.sql` contient `pinned` (2 occurrences). Il n'y a plus de `ON UPDATE` ni de `DEFINER`. Je l'ai importé dans `audit_import_tmp`. Les colonnes de `conversations` sont id, title, model, pinned, created_at, updated_at, et le comptage donne 7 conversations / 32 messages / 32 lignes dans la vue (16 `User`, 16 `ChatGPT`). Base supprimée ensuite (`show databases` : 0 occurrence d'« audit »).
- **Zip propre (C-25)** : `make_submission.sh` fait maintenant `rm -f` du zip, exclut `docs/audit/` et refuse un export sans `pinned`. J'ai relancé le script : zip de 264K, 82 fichiers. Plus de `Header.tsx` ni `Sidebar.tsx` fantômes, ni `docs/audit`, ni `.claude`. Les composants du zip (dont `AppSidebar.tsx`) correspondent au dossier.
- **Structure du rendu (C-21 à C-24)** : racine `MordehaiLevy/` avec `Database/`, `Backend/`, `Frontend/`. Postman est dans `Backend/`. Aucun `env/`, `node_modules/` ni `.env` (seuls les `.env.example`).
- **Contexte exact (C-07)** : test réel avec 2 messages liés. Réponse 2 : « Ton nombre préféré est 42. ». Historique `['user','assistant','user','assistant']`. Suppression 204, puis 404.
- **Secrets (C-10, C-11, C-20)** : `Backend/.env` est ignoré (`.gitignore:3:*.env`). `git ls-files` ne contient aucun `.env`. L'arbre GitHub n'a aucun `.env` réel. Aucun appel à OpenAI dans `Frontend/src`.
- **Postman** : 13 requêtes, dont « Send message (streaming SSE) » et « Regenerate last answer (streaming SSE) ». **README** : import `mysql -u root -p < Database/chatgpt_clone.sql` (l.140), création de l'utilisateur MySQL, port Docker 3307 (cohérent avec `docker-compose.yml`), URL `/chat/<id>`.

## Tableau C-01 → C-25
| ID | Verdict | Preuve |
|---|---|---|
| C-01 | CONFORME | Conversation continue testée en vrai via l'API |
| C-02 | CONFORME | FastAPI dans `requirements.txt` et `main.py`. SPA React. Le front n'appelle que `/api` |
| C-03 | CONFORME | MySQL dans `DATABASE_URL` (`.env.example:10`). Base `chatgpt_clone` active, import de l'export réussi |
| C-04 | CONFORME | `POST /api/conversations` crée une conversation. Composer et EmptyState sur `/` |
| C-05 | CONFORME | Pas de régression de code sur les bulles (`MessageBubble.tsx`, `justify-end` / `justify-start`) |
| C-06 | CONFORME | 2 messages dans la même conversation |
| C-07 | CONFORME | Réponse « Ton nombre préféré est 42. » |
| C-08 | CONFORME | Bouton « New chat » dans la sidebar et dans l'en-tête mobile (`README.md:24`) |
| C-09 | CONFORME | Un refresh repart d'un chat vide, ou rouvre `/chat/<id>`, ce que l'énoncé autorise |
| C-10 | CONFORME | Aucun appel OpenAI dans `Frontend/src` (grep vide) |
| C-11 | CONFORME | `.env` ignoré, jamais suivi. `health.openai_key_configured` est true. Je n'ai pas lu le contenu du `.env` |
| C-12 | CONFORME | `Backend/requirements.txt` présent, versions épinglées |
| C-13 | CONFORME | `AboutPage` : système et développeur (inchangé) |
| C-14 | CONFORME | Menu avec les routes `/` et `/about` |
| C-15 | CONFORME | Messages écrits en base (la vue en compte 32) |
| C-16 | CONFORME | `role` ENUM, vue `User` / `ChatGPT` (16 / 16) |
| C-17 | CONFORME | `conversation_id` UUID avec clé étrangère, présent dans la vue |
| C-18 | CONFORME | Dépôt public `mordehailevy/cortanyx` existant. Voir ACTION A1 |
| C-19 | CONFORME | `README.md:8` : lien GitHub |
| C-20 | CONFORME | `.gitignore` contient `.env`, `*.env`, `!.env.example`. Aucun `.env` sur GitHub |
| C-21 | CONFORME | Dossier `MordehaiLevy/` avec les 3 dossiers. Export importable et à jour |
| C-22 | CONFORME | `Backend/ChatGPT-Clone.postman_collection.json` (13 requêtes), présent dans le zip |
| C-23 | CONFORME | Pas de `env/` dans le zip |
| C-24 | CONFORME | Pas de `node_modules/` dans le zip |
| C-25 | CONFORME | Un seul zip, régénéré sans fichiers fantômes |

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| A1 | ACTION en attente (pas un défaut du code) | GitHub n'a toujours qu'un commit (`abd598c`, ancienne version). 43 entrées sont modifiées ou non suivies en local. Le correcteur qui clone verra l'ancienne version, sans `pinned` ni nouvelle sidebar. | `gh api repos/mordehailevy/cortanyx/commits` donne 1 commit. `git status --short` donne 43 lignes. | Commit puis push, avec l'accord de l'utilisateur. Ensuite vérifier `gh api …/git/trees/main?recursive=1` : aucun `.env`, et l'export contient `pinned`. |
| 1 | MINEUR | Le commentaire du `schema.sql` dit « updated_at : Last message time (not changed by rename / pin) ». L'export a perdu `ON UPDATE`, donc c'est cohérent. Il faut que le backend mette bien `updated_at` à jour à chaque message. | `models.py:32` : `server_default=func.now()`. Test réel : `updated_at` = 21:02:43, cohérent avec le dernier message. | Aucune action. Garder ce test dans la suite pytest si absent. |
| 2 | IDÉE | Si un correcteur lance `schema.sql` plutôt que l'export, il perd les conversations d'exemple : c'est dit au README (« without data »). | `README.md:143` | Rien à faire. |

## Vérification des corrections du tour précédent
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 (BLOQUANT) : export sans `pinned` | Oui | `grep -c pinned` = 2. Import réussi. Colonne `pinned tinyint(1) default 0` présente. 7 / 32 / 32 |
| 2 (BLOQUANT) : zip avec fantômes | Oui | `rm -f` dans le script. `unzip -l` : plus de `Header.tsx` ni `Sidebar.tsx`. Garde-fou si l'export n'a pas `pinned` |
| 3 (MAJEUR) : `docs/audit/` dans le zip | Oui | `--exclude 'docs/audit/'`. Aucune occurrence dans `unzip -l`. Seul `docs/screenshots` reste, ce qui est souhaité |
| 4 (MAJEUR) : GitHub en retard | Non, c'est l'ACTION A1 | Push prévu à la fin avec l'accord de l'utilisateur |
| 5 (MINEUR) : Postman | Oui | 13 requêtes, assertions SSE et Regenerate ajoutées |
| 6 (IDÉE) : commande d'import | Oui | `README.md:137-140` |

Pas de régression trouvée en C-01 à C-25.

## Ce qu'il faudrait pour passer à 10
1. Faire le commit et le push. Je vérifierais l'arbre GitHub, l'absence de `.env` et l'égalité du contenu avec le zip.
2. Ré-exporter la base et régénérer le zip si le schéma ou les données changent encore. Le script refuse déjà un export obsolète.
3. Lancer le runner Postman une dernière fois (je ne l'ai pas exécuté).

## Nettoyage et traçabilité
- Conversation de test créée puis supprimée : `0eefdada-fdee-4316-b897-89578c6b47fa` (DELETE 204, GET 404).
- Messages envoyés au chat : 2 sur 6.
- Les 7 conversations de `conversations-avant-audit.txt` sont toutes intactes : `GET` renvoie 200 pour chacune.
- Base temporaire `audit_import_tmp` supprimée.
- Le zip a été régénéré avec `./make_submission.sh`, comme la méthode le prévoit. Aucun fichier suivi par git n'a été modifié, et il n'y a eu ni commit ni push. Aucun secret affiché, et le `.env` n'a pas été ouvert.
- Fichier temporaire : `/private/tmp/claude-501/-Users-annahbenyamine-RADAR/96b9b765-907d-4632-8a2f-fda7a8c7a804/scratchpad/audit-conformite/imp.sql`.
- Je n'ai pas testé l'interface dans le navigateur : les verdicts d'interface reposent sur le code et le README.
