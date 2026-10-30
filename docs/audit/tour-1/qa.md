# Audit audit-qa — tour 1
Note : 9/10 — VALIDÉ (aucun point BLOQUANT ni MAJEUR ; deux points MINEURS)

## Ce qui est excellent
- **Newman** : 13 requêtes, 13 scripts de test, 16 assertions, 0 échec. Le flux SSE a maintenant ses assertions (« 200 + event-stream », « event order: user_message, delta..., done ») et « Regenerate last answer » est couvert (« new answer streamed »). La collection couvre les 9 endpoints du README. Elle a envoyé 4 messages au chat.
- **pytest** : 32 tests passent, 3 fois de suite (0,74 s, 0,82 s, 0,81 s). Aucun test instable.
- **Correction #1 vérifiée en conditions réelles** : `curl -s -N --max-time 0.25 -X POST …/messages/stream` avec `{"content":"Dis oui."}` a reçu `user_message` (id 123). Après 6 s, `GET /api/conversations/{id}` renvoie `messages: []`. Le message utilisateur a bien été retiré, alors qu'au tour 0 il restait orphelin.
- **Sécurité** (nouveautés) :
  - corps de 70 Ko avec Content-Length : 413 `Request body too large` ;
  - `Host: evil.example.com` : 400 `Invalid host header` ;
  - les trois en-têtes `x-content-type-options: nosniff`, `referrer-policy: no-referrer`, `x-frame-options: DENY` sont présents sur `/api/health` ;
  - les 422 n'écho plus l'entrée : `{"detail":[{"type":"string_type","loc":["body","content"],"msg":"Input should be a valid string"}]}`, sans `input` ni `ctx`.
- **Regenerate** : `POST /regenerate` sur une conversation vide donne 409 `Nothing to regenerate in this conversation`. Sur un id inconnu : 404. Le succès passe dans Newman. Le test pytest `test_regenerate_failure_keeps_previous_answer` couvre le cas d'échec (l'ancienne réponse est conservée). `prepare_regenerate` ne remplace la réponse qu'après succès.
- **Limite de débit** : après 8 requêtes invalides de ma part (compteur partagé avec les autres agents sur la même IP), j'ai eu un 429 avec l'en-tête `retry-after: 1`. Cela confirme que l'en-tête est bien envoyé, ce que je n'avais pas pu voir au tour 0.
- **Liste** : `?limit=500` donne 200, `?limit=0` donne 422, `?limit=501` donne 422, `?limit=abc` donne 422.
- **Titres** : `a\u0000b\u0007c‮d‏ e` devient `abcd e`. Un titre composé uniquement de caractères de contrôle donne 422 `Title cannot be empty`.
- **Tests automatiques ajoutés** : budget journalier (`test_daily_token_budget`), clé manquante en 503 (`test_missing_key_is_a_clear_503`). Je n'ai pas pu tester ces deux cas en direct sans toucher à `.env` ni dépasser 500 000 jetons.

## Campagne de test
| Cas | Attendu | Obtenu | OK/KO |
|---|---|---|---|
| Newman (13 requêtes, 16 assertions) | tout vert | 0 échec | OK |
| pytest ×3 (32 tests) | stable | 32 passed ×3 | OK |
| Coupure avant le 1er mot (`--max-time 0.25`) | pas de message `user` orphelin | `messages: []` | OK |
| Regenerate sans question | 409 | 409 | OK |
| Regenerate, id inconnu | 404 | 404 | OK |
| Regenerate, succès (Newman) | nouvelle réponse streamée | OK | OK |
| Regenerate, échec : ancienne réponse conservée | conservée | couvert par pytest (non reproduit en direct, faute de moyen de faire échouer OpenAI) | OK (test) |
| Corps de 70 Ko avec Content-Length | 413 | 413 | OK |
| Corps de 70 Ko en `Transfer-Encoding: chunked` | 413 | **422 « Message is too long »** : le corps a été lu en entier, sans limite | KO (voir #1) |
| Host inconnu | 400 | 400 | OK |
| En-têtes nosniff, no-referrer, DENY | présents | présents | OK |
| 422 sans écho de l'entrée | pas de `input` | pas de `input` | OK |
| Titre avec caractères de contrôle | nettoyé | `abcd e` | OK |
| Titre uniquement en caractères de contrôle | 422 | 422 | OK |
| Liste `limit` 0 / 501 / abc / 500 | 422 / 422 / 422 / 200 | idem | OK |
| Retry-After sur 429 | présent | `retry-after: 1` | OK |
| Cascade et orphelins en base | 0 | 0 message orphelin après nettoyage | OK |
| Budget journalier 429, clé manquante 503 | voir pytest | pytest vert ; non reproduit en direct | OK (test) |
| Un envoi en échec ne change pas `updated_at` | inchangé | couvert par pytest ; non reproduit en direct | OK (test) |

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | MINEUR | La limite de 64 Ko ne s'applique qu'avec l'en-tête `Content-Length`. Un client qui envoie en `Transfer-Encoding: chunked` contourne le 413 : le serveur lit tout le corps avant de répondre 422. La mémoire n'est donc pas protégée contre un très gros corps. | `Backend/app/security.py`, lignes qui lisent `content-length` : `if length.isdigit() and int(length) > self.max_body_bytes`. Reproduction : `curl -s -w "%{http_code}" -X POST $B/$ID/messages -H 'content-type: application/json' -H 'Transfer-Encoding: chunked' -d @big.json` (corps de 70 Ko) renvoie `422 … too long`, alors que la même requête avec Content-Length renvoie 413. | Dans `SecurityMiddleware`, envelopper `receive` : cumuler la taille des morceaux `http.request` et, au-delà de `max_body_bytes`, renvoyer 413 (ou lever une exception interceptée). Test pytest : envoyer un générateur de morceaux (`data=iter([b"x"*40000, b"x"*40000])` avec httpx) et attendre 413. |
| 2 | MINEUR | Pas d'assertion Postman sur la réponse de « Regenerate last answer » au-delà de « new answer streamed », ni de requête pour les cas 409 et 404 de la nouvelle route. | Sortie Newman : une seule assertion pour cette requête ; aucune requête 409 dans la collection. | Ajouter deux requêtes à la collection : `POST /api/conversations/{id}/regenerate` sur une conversation vide (attendu 409) et sur `does-not-exist` (attendu 404). |

## Vérification des corrections du tour précédent
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 (message utilisateur orphelin après coupure avant le 1er mot) | Oui | `curl --max-time 0.25` puis `GET` : `messages: []` ; test pytest ajouté, 32 tests verts |
| 2 (caractères de contrôle dans les titres) | Oui | `PATCH {"title":"a\u0000b\u0007c‮d‏ e"}` donne `abcd e` ; titre 100 % contrôle donne 422 |
| 3 (titre de secours quand le flux est arrêté) | Non vérifié en direct : je n'ai plus de budget pour un 7e message au chat ; couvert par l'affirmation du coordinateur et les tests pytest | Dans mon test, la conversation coupée avant le 1er mot n'a plus de messages, donc le titre reste « New conversation », ce qui est cohérent |
| 4 (assertions SSE dans Postman) | Oui | Newman : « 200 + event-stream » et « event order: user_message, delta..., done » |
| 5 (limite de liste) | Oui | `?limit=500` 200, `501` 422, `0` 422 |
| 6 (limite de débit documentée) | Non vérifié dans le README (hors périmètre de mes tests d'API) | — |
| Retry-After testé | Oui | `retry-after: 1` observé sur un vrai 429 |

## Hygiène de l'audit
- **Messages envoyés au vrai chat : 6 sur 6.** Newman 4 (JSON, suivi, flux, regenerate) ; 1 par erreur de ma part, car mon test « 422-echo » contenait un `content` valide avec des champs inconnus, donc la requête est passée et a été traitée (champs inconnus ignorés : 200) ; 1 pour la coupure à 0,25 s (message utilisateur enregistré, puis retiré).
- Le temps de la coupure à 0,25 s n'a pas permis d'observer le comportement de « Stop » au milieu d'une réponse déjà commencée (testé au tour 0).
- Conversations créées : `0f27df3d-cc8a-491f-8f47-d9281803284e` (supprimée, 204), `1abac86b-9544-44de-b3c5-5a9e39b00b31` (supprimée, 204), `103365eb-b9ce-4964-a012-39fc5cb0eaf4` (supprimée plus tôt), celle de Newman `a003bfb0-c2d3-4266-a7bb-30d5ecb1c37c` (supprimée par la collection). 0 message orphelin en base.
- Les 6 conversations d'avant l'audit sont intactes. Les autres conversations présentes (par ex. `c1c2e9d3…`, `5e062301…`, `99b050ec…`, `40678932…`, `892b8755…`) appartiennent à d'autres agents ; je n'y ai pas touché.
- Aucun fichier du projet modifié, `Backend/.env` non lu, `docs/audit/conversations-avant-audit.txt` intact. Scratchpad vidé.

## Ce qu'il faudrait pour passer à 10
- Appliquer la limite de taille aussi aux corps `chunked` (#1) et ajouter son test.
- Ajouter à la collection Postman les cas 409 et 404 de `/regenerate` (#2).
- Idéalement, un test automatique qui vérifie en direct (ou avec un faux client) qu'un « Stop » au milieu d'une réponse donne un titre de secours.
