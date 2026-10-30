# Audit audit-qa — tour 0
Note : 7.5/10 — NON VALIDÉ (un point MAJEUR : message utilisateur orphelin quand on coupe le flux avant le premier mot)

## Ce qui est excellent
- **Collection Postman** : `npx newman@6 run Backend/ChatGPT-Clone.postman_collection.json` donne 12 requêtes, 0 échec, 13 assertions vertes (health, création, liste, message JSON, suivi qui se souvient du prénom, flux SSE, lecture, renommage, épinglage, 422, 404, suppression 204). La collection couvre les 8 endpoints du README.
- **Tests automatiques** : `env/bin/python -m pytest -q` donne 12 passed, 3 fois de suite (0,16 à 0,20 s). Aucun test instable. Ils utilisent un faux client OpenAI, donc ni réseau ni coût.
- **Validations** : tous les cas renvoient un 422 propre avec le champ fautif. Cas testés : contenu vide, espaces seuls, 8001 caractères, JSON invalide, mauvais type, champ manquant, corps vide, mauvais Content-Type, titre de 121 caractères (rejeté), `PATCH {}`, `{"title":"   "}`, `pinned:"maybe"`. Le titre de 120 caractères est accepté. 8000 caractères est accepté (vérifié via `MessageIn` en Python, sans appel au chat), avec ou sans espaces autour.
- **Identifiants** : id inexistant, injection `' OR 1=1--`, id de 200 caractères et de 40 000 caractères donnent tous 404 `Conversation not found` (GET, PATCH, DELETE, POST messages). Aucun 500.
- **Unicode** : le titre `שלום עולם 🚀 hello مرحبا` est stocké en utf8mb4 (23 caractères, hex correct) et relu à l'identique par l'API. `v_conversation_messages` affiche bien les accents. Les titres sont relus tels quels.
- **Épinglage** : la liste classe les épinglées d'abord, puis par activité récente. Renommer ou désépingler ne change pas `updated_at` (20:46:17.118 avant et après).
- **Cascade** : après suppression de 3 conversations qui avaient 5 messages, il reste 0 message dans `messages` pour ces ids et 0 message orphelin dans toute la base.
- **Flux SSE complet** : l'ordre est `user_message`, puis 10 `delta`, puis `done`, puis `title`. Les messages 85 (user) et 86 (assistant, 404 tokens) sont en base, et le titre généré est « Salutation simple en français ».
- **Coupure client en cours de réponse** (`curl --max-time 2`) : la réponse partielle est enregistrée. Le client a reçu 120 deltas, soit 500 caractères, et la base contient 500 caractères en assistant (message 90). Le contexte reste cohérent.
- **Concurrence** : 5 `POST /api/conversations` en parallèle donnent 5 × 201 avec 5 ids distincts. La liste reste cohérente, sans doublon.
- **Limite de débit** : 429 avec `{"detail":"Too many messages. Please wait 5 seconds."}`. La fenêtre glissante a bien libéré les requêtes après 62 s.
- **Reprise sans clé OpenAI** (lecture du code, `.env` non touché) : `openai_service.py:52-53` lève `AIServiceError("OPENAI_API_KEY is missing…", 500)`. `conversations.py` supprime ensuite le message utilisateur dans les deux routes (JSON et SSE). Aucune donnée orpheline dans ce cas.

## Campagne de test
| Cas | Attendu | Obtenu | OK/KO |
|---|---|---|---|
| Newman (12 requêtes, 13 assertions) | tout vert | 0 échec | OK |
| pytest ×3 | stable | 12 passed ×3 | OK |
| Message vide / espaces / 8001 car. | 422 | 422 (3 messages d'erreur distincts) | OK |
| Message de 8000 car. | accepté | accepté (via `MessageIn`) | OK |
| JSON invalide / type faux / champ manquant / corps vide / text/plain | 422 | 422 | OK |
| `PATCH {}` / titre blanc / 121 car. / `pinned:"maybe"` / `title:5` / JSON invalide | 422 | 422 | OK |
| Titre de 120 car. | 200 | 200 | OK |
| `PATCH` avec champ inconnu `{"title":"ok","foo":1}` | 200 ou 422 (choix) | 200, champ ignoré | OK |
| Ids inexistant / injection / 200 / 40 000 car. | 404 | 404 | OK |
| DELETE / PATCH / POST messages sur id inexistant | 404 | 404 | OK |
| Titre hébreu + emoji + arabe | aller-retour sans perte | identique, en base et en API | OK |
| Titre avec caractères de contrôle (NUL, BEL, U+202E, U+200F) | rejeté ou nettoyé | **accepté tel quel et stocké** | KO (voir #2) |
| Ordre de la liste (épinglées, puis récentes) | correct | correct | OK |
| `updated_at` inchangé au renommage / désépinglage | inchangé | inchangé | OK |
| Cascade des messages | 0 reste | 0 reste, 0 orphelin global | OK |
| SSE complet | `user_message`, `delta`…, `done`, `title` | respecté | OK |
| Coupure à 2 s en cours de réponse | partielle enregistrée | 500 car. enregistrés, 1 user + 1 assistant | OK |
| Coupure avant le premier mot (0,25 s) | message utilisateur retiré ou réponse enregistrée | **message `user` seul resté en base** | KO (voir #1) |
| 5 créations en parallèle | 5 ids distincts | OK | OK |
| Limite de débit 429 | 429 + `Retry-After` | 429 observé, mais l'en-tête `Retry-After` n'a pas pu être capturé : mon propre curl voyait une réponse 422, car la fenêtre s'était libérée (voir note) | à confirmer |
| Clé OpenAI manquante | erreur claire, rien d'orphelin | OK d'après le code (lecture seule) | OK |

Note sur la limite de débit : le compteur est par IP (`rate_limit.py`) et d'autres agents d'audit tournent en parallèle depuis la même IP locale. J'ai donc eu un 429 avant d'avoir atteint 20 requêtes moi-même. L'en-tête `Retry-After` est bien posé dans le code (`rate_limit.py`, `headers={"Retry-After": str(retry)}`) mais je ne l'ai pas vu sur le réseau. Je n'ai pas relancé de requêtes pour ne pas dépasser mon budget de 25.

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | MAJEUR | **Message utilisateur orphelin** quand le client coupe le flux avant le premier mot. Le texte du README dit « the database never holds unanswered messages », ce qui est faux dans ce cas. Au tour suivant, l'historique envoyé à OpenAI contient deux messages `user` de suite. | `conversations.py`, bloc `except asyncio.CancelledError` : `if parts and not saved:` ne fait rien quand `parts` est vide. Reproduction : créer une conversation, puis `curl -s -N --max-time 0.25 -X POST $B/$ID/messages/stream -H 'content-type: application/json' -d '{"content":"Dis oui."}'`, puis `GET /api/conversations/$ID` donne `[('user','Dis oui.')]` (message 93). | Dans le `except CancelledError`, si `not parts and not saved`, appeler `svc.delete_message(session, user_msg.id)` (user_msg initialisé à `None` avant le `try`). |
| 2 | MINEUR | Les titres acceptent les caractères de contrôle (NUL `\u0000`, BEL, U+202E inversion de sens de lecture, U+200F). Ils sont stockés tels quels, ce qui permet de faire afficher un titre inversé dans la barre latérale. | `PATCH {"title":"a\u0000b\u0007c‮d‏"}` donne 200 et la relecture renvoie la même chaîne. | Dans `strip_title` (`schemas.py`), supprimer les caractères de catégorie Unicode `Cc`, `Cf` : `v = "".join(ch for ch in v if unicodedata.category(ch) not in ("Cc","Cf")).strip()`. Faire pareil pour `MessageIn` si on veut. |
| 3 | MINEUR | Après un arrêt (« Stop ») au milieu d'une première réponse, le titre reste « New conversation ». Dans la liste elle ressemble à une conversation vide. La réponse partielle est pourtant en base. | Conversation coupée à 2 s : `title = New conversation` alors que 2 messages sont enregistrés. `tokens` vaut NULL pour la réponse partielle. | Dans le `except CancelledError`, après l'enregistrement de la partie, définir un titre local (par ex. les 40 premiers caractères du message utilisateur) si le titre est encore `DEFAULT_TITLE`. |
| 4 | MINEUR | Le test SSE de la collection Postman n'a **aucune assertion** : « Send message (streaming SSE) » n'affiche aucun test dans Newman (11 scripts de test pour 12 requêtes). Le flux, point central de l'application, n'est donc pas vérifié par la collection. | Sortie Newman : aucune ligne `✓` sous cette requête. | Ajouter dans l'onglet Tests de cette requête : `pm.test("SSE order", () => { const t = pm.response.text(); pm.expect(t).to.include("event: user_message"); pm.expect(t).to.include("event: delta"); pm.expect(t.indexOf("event: done")).to.be.above(t.indexOf("event: delta")); });` |
| 5 | MINEUR | `list_conversations` est limité à 50 sans pagination ni avertissement. Au-delà, les plus anciennes disparaissent de l'interface sans message. | `conversation_service.py`, `limit: int = 50` ; aucun paramètre `limit` ou `offset` n'est exposé par la route ni documenté dans le README. | Exposer `?limit=&offset=` (avec `Query(50, le=200)`) ou documenter la limite dans le README. |
| 6 | MINEUR | La limite de débit compte aussi les requêtes invalides (422) et les requêtes sur un id inexistant (404), car la dépendance de débit s'exécute avant la validation. Un client qui se trompe se bloque tout seul 1 minute. | `rate_limit.py` utilisé comme `dependencies=[Depends(chat_rate_limit)]` ; observé : plusieurs 422 puis des 429 sur des requêtes sans appel à OpenAI. | Documenter ce choix dans le README, ou ne compter qu'après validation en déplaçant l'appel dans le corps de la route. |
| 7 | IDÉE | Les tests automatiques ne couvrent pas le comportement SSE à la coupure du client, ni les caractères de contrôle. | `Backend/tests/test_api.py`, 12 tests, aucun sur `CancelledError`. | Voir le test proposé ci-dessous. |

Test pytest proposé pour #1 (à placer dans `Backend/tests/test_api.py`, avec un faux client qui attend avant le premier mot) :
```python
def test_disconnect_before_first_token_leaves_no_orphan(client, fake_ai):
    import asyncio
    async def slow_stream(history):
        await asyncio.sleep(5)
        yield StreamChunk(delta="x")
    fake_ai.stream_reply = slow_stream
    cid = client.post("/api/conversations").json()["id"]
    # simuler la coupure : appeler directement le générateur de la route et l'annuler, puis vérifier
    # qu'aucun message role=user ne reste sans réponse
    msgs = client.get(f"/api/conversations/{cid}").json()["messages"]
    assert not msgs or msgs[-1]["role"] == "assistant"
```
(Le TestClient ne sait pas couper un flux, donc ce test demande d'invoquer `events()` avec `asyncio.wait_for(..., 0.1)`, ou de passer par `httpx.AsyncClient` avec un timeout court.)

Test pour #2 :
```python
def test_title_rejects_control_chars(client):
    cid = client.post("/api/conversations").json()["id"]
    r = client.patch(f"/api/conversations/{cid}", json={"title": "a\u0000b‮c"})
    assert r.status_code == 422 or r.json()["title"] == "abc"
```

## Vérification des corrections du tour précédent
Sans objet : tour 0.

## Hygiène de l'audit
- Messages envoyés au vrai chat : **6 sur 6** (Newman 3 : JSON, suivi, flux ; puis flux complet 1 ; flux coupé à 2 s 1 ; flux coupé à 0,25 s 1).
- Conversations créées puis supprimées (toutes en 204) : `4b4dd150-4204-4f0d-a36a-706254fd3b2d`, `400f3657-39b2-403f-897c-c55ec503a858`, `9bf535b4-4220-46df-bbdb-3e819651a4d3`, `0b2478a6-107b-4eb4-be7a-c48a7167dde2`, `79e2cbf1-4ffc-45f1-aec9-482dccde7b45`, `32db9188-750b-40d4-9fd9-6f958ef8609d`, `27207b79-df13-45fc-ba4d-dda56c993bae`, plus 5 créées en parallèle (ids dans les réponses 201, supprimées) et celle de Newman `b5ff4068-c8d9-47b8-9c6e-3e7983846f4d` (supprimée par la collection).
- Les 6 conversations d'avant l'audit sont intactes. Après nettoyage, la liste contient en plus trois conversations qui ne sont **pas les miennes** (créées par d'autres agents en parallèle) : `96519c13-f3c9-420a-95cd-42a003f6b5f2` « AUDIT test Lucas » (épinglée), `b95b1fb4-3e02-437b-9c0a-e9b45173c909` et `fde58320-75f4-47ac-b087-79548b1608bb`. Je les ai laissées.
- Aucun fichier du projet modifié, `Backend/.env` non lu. Scratchpad vidé.

## Ce qu'il faudrait pour passer à 10
- Corriger #1 (suppression du message utilisateur si le flux est coupé avant tout contenu) et ajouter le test de non-régression.
- Ajouter des assertions à la requête SSE de la collection Postman (#4), et idéalement un test de coupure client.
- Nettoyer les caractères de contrôle dans les titres (#2) et donner un titre aux conversations interrompues (#3).
- Documenter ou rendre paramétrable la limite de 50 conversations (#5) et préciser que la limite de débit compte aussi les requêtes invalides (#6).
- Confirmer en test automatique l'en-tête `Retry-After` du 429 (`assert r.headers["Retry-After"].isdigit()` dans `test_rate_limit`).
