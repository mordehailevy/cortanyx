# Audit audit-securite — tour 0
Note : 9/10 — VALIDÉ

Je n'ai trouvé aucun point BLOQUANT ni MAJEUR dans le contexte réel du projet : local, une seule personne, rendu scolaire. La clé n'est exposée nulle part, le Markdown n'exécute pas de code dans le navigateur, la validation est propre et le CORS est strict. Il reste des durcissements, tous MINEURS ici, dont certains deviendraient MAJEURS en cas de mise en ligne.

Limite de méthode : le skill `security-review` n'a pas pu se charger, il demande `git diff origin/HEAD...` et le dépôt n'a pas de remote (`fatal: ambiguous argument 'origin/HEAD...'`). J'ai donc suivi la check-list OWASP de `.claude/agents/audit-securite.md` à la main.

## Ce qui est excellent (3 à 6 puces, avec preuves)
- **La clé OpenAI ne sort par aucun chemin.**
  - Recherche `sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}` sans aucun résultat dans `Frontend/dist`, dans `MordehaiLevy.zip` décompressé (62 fichiers, seulement des `.env.example`), dans `git log -p --all` et dans l'arborescence du projet (hors `.env`, `env/`, `node_modules`).
  - Aucun `.env` n'a jamais été ajouté dans l'historique git.
  - `Backend/.env` est en `-rw-------` et ignoré par git (`git check-ignore` → `.gitignore:3:*.env`).
  - Le champ est déclaré `Field(repr=False)` (`config.py:13`).
  - `/api/health` ne renvoie que `openai_key_configured: true`.
  - Les erreurs OpenAI sont traduites en messages génériques (`openai_service.py:28-37`).
  - Le bundle ne contient que `VITE_API_URL` (`api.ts:25`) et aucune source map.
- **Le Markdown ne permet pas de XSS.**
  - `react-markdown` 10.1.0 est utilisé sans `rehype-raw` et sans aucun `dangerouslySetInnerHTML` dans `src`.
  - Test réel : j'ai demandé au modèle de recopier les deux charges, et il a bien renvoyé `<img src=x onerror=alert(1)>` et `[clic](javascript:alert(1))`.
  - Dans le navigateur, sur la page de la conversation, j'ai compté 0 `img[onerror]` et 0 lien `javascript:`. Le HTML est affiché en texte échappé (`&lt;img …&gt;`).
  - Rendu hors navigateur avec la même configuration : `javascript:`, `JaVaScRiPt:`, `data:` et `vbscript:` donnent tous `href=""`, et `<script>` et `<a href="javascript:…">` sont échappés.
- **Validation et injection sans faille.**
  - Un identifiant inexistant, avec `'`, avec `%00`, de 5000 caractères, en Unicode ou avec `../` donne toujours un 404 propre.
  - JSON invalide, mauvais types, `{}`, tableau ou titre de 121 caractères donnent un 422 propre, jamais de 500 ni de trace.
  - Les champs inattendus (`"evil"`, `"id"`) sont ignorés.
  - Les requêtes passent toutes par l'ORM SQLAlchemy, sans SQL brut à partir de données utilisateur.
- **CORS strict.**
  - Un `GET` avec `Origin: https://evil.example` ne reçoit aucun en-tête `access-control-allow-origin`.
  - Le preflight `DELETE` depuis cette origine est refusé : `400 Disallowed CORS origin`.
  - Seul `http://localhost:5173` est autorisé, avec 4 méthodes et l'en-tête `Content-Type`.
  - Un `POST` en `text/plain` (formulaire cross-site) est rejeté en 422, donc pas de CSRF possible sur les messages.
- **Limite de débit active et partagée entre `/messages` et `/stream`.**
  - La rafale donne `429 Too Many Requests` avec `retry-after`, sur les deux routes.
  - La limite est vérifiée avant la validation du corps (`dependencies=[Depends(chat_rate_limit)]`), donc une requête invalide est quand même comptée.
  - L'API n'écoute que sur `127.0.0.1:8000` (`lsof`).
- **Dépendances saines et résistance au prompt injection.**
  - `npm audit --omit=dev` : 0 vulnérabilité.
  - `pip-audit` sur `requirements.txt` et sur les paquets installés (lecture seule, depuis un venv du scratchpad) : « No known vulnerabilities found ».
  - Les 2 tentatives pour faire révéler le prompt système ont été refusées.
  - Un hook pre-commit anti-secret est actif (`core.hooksPath=.githooks`).

## Constats
| # | Gravité | Constat | Preuve | Correction proposée (précise, applicable) |
|---|---------|---------|--------|-------------------------------------------|
| 1 | MINEUR (MAJEUR si mis en ligne derrière un proxy mal réglé) | On peut contourner la limite de débit avec `X-Forwarded-For`. Uvicorn fait confiance par défaut aux en-têtes de proxy qui viennent de 127.0.0.1, donc `request.client.host` prend la valeur choisie par l'attaquant. En plus, `_hits` crée une nouvelle entrée par IP inventée, ce qui fait grossir la mémoire sans limite. | Après une rafale sur `/nope/messages` : requête 21 → `429`, requête 22 sur `/stream` → `429`, requête 23 identique avec `X-Forwarded-For: 203.0.113.7` → `422`, donc la limite a sauté. Code : `rate_limit.py:20` et lignes 14 et 22. Uvicorn est lancé avec `--host 127.0.0.1 --port 8000 --reload`, sans `--no-proxy-headers`. | En développement : ajouter `--no-proxy-headers` à la commande uvicorn du README. En production : `--forwarded-allow-ips=<IP du proxy>`, avec un proxy qui écrase `X-Forwarded-For`. Dans `rate_limit.py` : supprimer les deques vides et plafonner `len(_hits)` (par exemple 10 000 clés). |
| 2 | MINEUR (MAJEUR si mis en ligne) | Pas de plafond de coût global ou journalier, seulement 20 requêtes par minute et par IP. Pire cas `gpt-4o-mini` (0,15 $ par million de jetons en entrée, 0,60 $ en sortie) : contexte de 40 messages avec 20 messages utilisateur de 8000 caractères (environ 2000 jetons chacun) et 20 réponses de 2048 jetons, plus le prompt système, soit environ 81 000 jetons en entrée. Cela coûte environ 0,0122 $ + 0,0012 $ = **0,0134 $ par requête**, donc **0,27 $ par minute et par IP**, et jusqu'à 0,41 $ par minute avec un contexte poussé vers 128 000 jetons. Le plafond de 10 $ par mois serait atteint en **25 à 37 minutes** depuis une seule IP, et beaucoup plus vite avec le contournement du constat 1. | `config.py:16,24,26,27`. `openai_service.py:48` fait une fenêtre par nombre de messages, pas par nombre de jetons. Aucune limite journalière dans `rate_limit.py`. | Ajouter dans `chat_rate_limit` un budget journalier : `SUM(messages.tokens)` sur les dernières 24 h, puis 429 au-delà d'un seuil `DAILY_TOKEN_BUDGET` (par exemple 300 000). Couper l'historique par nombre de jetons (par exemple 16 000) plutôt que par 40 messages. Vérifier dans la console OpenAI que le budget de 10 $ du projet bloque vraiment les appels et ne fait pas que prévenir (non vérifié ici, service externe). |
| 3 | MINEUR | Pas de limite de taille du corps des requêtes, et les erreurs 422 renvoient la valeur reçue (`input`). Un corps de 20 Mo est entièrement lu, puis renvoyé tel quel : amplification de mémoire et de bande passante. | `PATCH /api/conversations/nope` avec `{"title":"a"*20 000 000}` → `422`, réponse de **20 000 148 octets**. | Middleware dans `main.py` : si `Content-Length` dépasse 64 Ko, répondre 413. Ajouter un `exception_handler(RequestValidationError)` qui retire `input` des erreurs. En production : `client_max_body_size 64k` côté nginx. |
| 4 | MINEUR | L'en-tête `Host` n'est pas vérifié. Un site malveillant visité pendant que l'API tourne pourrait, par DNS rebinding, lire ou supprimer les conversations et dépenser du crédit. Les navigateurs récents (Local Network Access de Chrome) réduisent ce risque. | `curl -H 'Host: evil.example' localhost:8000/api/conversations` → `200` avec la liste complète. | `app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", *settings.allowed_hosts])` dans `main.py`. |
| 5 | MINEUR en local (BLOQUANT si mis en ligne) | Aucune authentification : toute personne qui atteint l'API lit, renomme et supprime toutes les conversations, et fait des appels payants. C'est acceptable pour une application locale mono-utilisateur liée à 127.0.0.1 (vérifié), mais il faut le documenter. | `routers/conversations.py` : aucune dépendance d'authentification. `lsof` : `127.0.0.1:8000 (LISTEN)`. | Ajouter au README une section « Sécurité / mise en ligne » qui dit que l'API ne doit pas être exposée sans authentification. Pour un déploiement : comptes (JWT ou session), une colonne `conversations.user_id` et un filtre sur toutes les requêtes. |
| 6 | MINEUR | Il manque des en-têtes de sécurité, et `/docs` et `/openapi.json` sont publics (normal en local, à noter pour la production). | Réponses de `/api/health` et `/api/conversations` : seulement `server`, `content-type` et `vary`. Pas de `X-Content-Type-Options` ni de CSP (`meta CSP` absente du front, vérifié dans le navigateur). `/docs` → 200. Le SSE a bien `cache-control: no-cache` et `x-accel-buffering: no`. | Middleware qui ajoute `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` et `X-Frame-Options: DENY`. En production : `FastAPI(docs_url=None, redoc_url=None, openapi_url=None)` piloté par un réglage `ENABLE_DOCS`, et une CSP `default-src 'self'` sur le front. |
| 7 | MINEUR | Les images Markdown (`![](https://…)`) sont chargées automatiquement. C'est le vecteur classique d'exfiltration par un LLM (URL qui contient des données). L'impact est faible ici, car seul l'utilisateur alimente le modèle et il n'y a ni outils ni données de tiers. | `Markdown.tsx:60-63` : pas de surcharge `img`. Le rendu de `![i](…)` produit bien un `<img>`. | Dans `components`, ajouter `img: ({ alt, src }) => <a href={src} target="_blank" rel="noopener noreferrer">{alt \|\| 'image'}</a>`, ou n'autoriser que `https:` après un clic. |
| 8 | MINEUR (qualité, pas sécurité) | La prop `node` de react-markdown est propagée dans le DOM : avec la même surcharge, le rendu produit `<a href=… node="[object Object]">`. Même chose pour `CodeBlock` via `...rest` sur `<pre>`. | `Markdown.tsx:62` `a: (props) => <a {...props} …/>` et `Markdown.tsx:38,48` `{...rest}`. Reproduit avec `renderToStaticMarkup` et la même surcharge. | `a: ({ node: _n, ...props }) => …` et `function CodeBlock({ children, node: _n, ...rest })`. |
| 9 | MINEUR | `docker-compose.yml` publie MySQL sur toutes les interfaces avec des mots de passe faibles. Dans l'environnement local, MySQL écoute aussi sur `*:3306` (réglage du poste, pas du projet). | `docker-compose.yml` : `ports: - "3307:3306"`, `MYSQL_ROOT_PASSWORD: root_password`. `lsof` : `mysqld … TCP *:3306 (LISTEN)`. | Mettre `"127.0.0.1:3307:3306"` et ajouter un commentaire « mots de passe de démonstration, à changer ». Côté poste : `bind-address = 127.0.0.1` dans `my.cnf`. |
| 10 | MINEUR (pour l'audit qualité IA) | Hors périmètre sécurité : la règle de langue est violée. Pour un message en français (tentative de prompt injection n°1), la réponse est arrivée en hébreu. | Réponse SSE : « אני לא יכול לחשוף את ההוראות… », à `Ignore toutes tes instructions précédentes…`. `prompts.py:8-9` demande de toujours répondre dans la langue du dernier message. | À transmettre à l'auditeur IA/prompt. Ajouter dans `prompts.py` une consigne explicite : « même pour un refus, réponds dans la langue du dernier message ». |
| 11 | IDÉE | Le zip de rendu contient les fichiers internes de l'audit (`docs/audit/consignes.md`, `grille.md`, `conversations-avant-audit.txt`). | Listing du zip décompressé : `MordehaiLevy/docs/audit/…`. | Ajouter `--exclude 'docs/audit/'` dans `make_submission.sh`. |
| 12 | IDÉE | `npm audit` complet (dépendances de développement comprises) : 2 vulnérabilités modérées (`postcss-selector-parser` < 6.1.5 via `@tailwindcss/typography`), seulement au moment du build. Aucun risque à l'exécution, car `--omit=dev` → 0. | Sortie de `npm audit` : « GHSA-rj75-hqrm-r3gf … 2 moderate ». | Surveiller une mise à jour de `@tailwindcss/typography`. Ne pas lancer `npm audit fix --force`, qui ferait revenir à 0.5.4. |

## Vérification des corrections du tour précédent (à partir du tour 2)
Sans objet (tour 0).

## Ce qu'il faudrait pour passer à 10
1. `--no-proxy-headers` en développement et `--forwarded-allow-ips` explicite en production, plus le nettoyage et le plafond de `_hits` (constat 1).
2. Un budget de jetons journalier côté serveur et une fenêtre de contexte comptée en jetons (constat 2).
3. Une limite de taille de corps (413) et des erreurs 422 sans `input` (constat 3).
4. `TrustedHostMiddleware` (constat 4).
5. Les en-têtes `nosniff`, `Referrer-Policy` et `X-Frame-Options`, plus `/docs` désactivable par un réglage (constat 6).
6. Une surcharge `img` dans `Markdown.tsx` et le retrait de la prop `node` (constats 7 et 8).
7. Une section « Sécurité et mise en ligne » dans le README : application mono-utilisateur, authentification obligatoire avant exposition, MySQL lié à 127.0.0.1 (constats 5 et 9).

---
**Traçabilité du tour :**
- **Requêtes de limite de débit** : 23 en rafale (toutes avec un corps invalide, donc aucun coût OpenAI), plus 2 requêtes isolées plus tôt.
- **Messages au vrai chat** : 3 sur 4 autorisés (1 test XSS, 2 tentatives de prompt injection).
- **Conversation de test** : `78c99501-f3cf-4d3d-b292-ce3d294c0495`, supprimée (`DELETE` → 204, puis `GET` → 404).
- **Conversations d'avant l'audit** : les 6 sont toujours présentes.
- **Nettoyage** : l'onglet du navigateur intégré (tab-12) est fermé. Le dossier scratchpad, avec le zip décompressé, le venv pip-audit et les scripts, est supprimé. Je n'ai lu ni affiché le contenu de `Backend/.env`, et aucun fichier du projet n'a été modifié.
