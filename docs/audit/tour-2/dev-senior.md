# Audit audit-dev-senior — tour 2
Note : 8/10 — NON VALIDÉ

Le défaut MAJEUR du tour 1 est corrigé (je l'ai vérifié en vrai), ainsi que tous les MINEURS retenus. **Mais la correction #3 (rendre le texte tapé) crée une nouvelle régression visible.** Une fois qu'un texte a été rendu, il réapparaît dans le composeur après chaque envoi et à chaque « New chat », jusqu'au rechargement de la page. C'est le seul point qui empêche la validation.

Méthode :
- Relu le code modifié : `useChat.ts`, `ChatPage.tsx`, `Composer.tsx`, `Markdown.tsx`, `security.py`, `routers/conversations.py`, `conftest.py`, ainsi que `schema.sql` et l'export SQL.
- Relancé pytest, tsc, lint et build (build écrit dans le scratchpad puis supprimé).
- Rejoué 6 scénarios dans mon propre onglet, fermé ensuite, avec **3 messages envoyés au chat** au total.

## Ce qui est excellent (3 à 6 puces, avec preuves)
- **Le conflit annulation / navigation est réglé proprement.** La ref `activeRef` est mise à jour dans `openConversation` (`useChat.ts:196`), `newChat` (`:187`) et à la création (`:87`). Les `catch` ne touchent l'écran que si `activeRef.current === cid` (`:110-125`, `:166`). Rejoué en vrai (T4b) : après un clic sur SQL avant le 1er mot, l'adresse reste `/chat/711d022f` pendant 3 s (12 relevés). Le titre et le contenu sont ceux de SQL, le composeur est vide, la conversation abandonnée `678b0f0c…` renvoie 404, et SQL garde ses messages 33-36.
- **La navigation est entièrement juste**, vérifiée en vrai :
  - Retour vers `/` → écran vide ; Suivant → SQL.
  - Retour entre deux conversations (Salutation → SQL) → bon contenu.
  - Lien invalide ouvert depuis une conversation → `/`, écran vide, et le message « Conversation not found. » reste affiché (#2 corrigé).
- **La coloration syntaxique est allégée sans risque XSS.** On passe à `highlight.js/lib/core` avec 12 langages (`Markdown.tsx:1-23`). La sortie de hljs est échappée, avec un commentaire qui le dit (`:38`), et `useMemo` évite de recalculer à chaque fragment (`:39-42`). Le chunk Markdown fait **237,80 kB (gzip 73,69)**, contre 330,48 au tour 1.
- **La robustesse côté serveur est vérifiée.** Un corps chunked de 100 000 caractères renvoie désormais **413** (vérifié avec curl). Le drapeau `inserting`, avec `rollback`, déclenche un `error` si l'enregistrement de la réponse échoue (`conversations.py:139-148`), couvert par `test_answer_save_failure_sends_error_and_keeps_db_clean`. L'index `idx_messages_created` est présent dans `schema.sql:45` et dans l'export (`chatgpt_clone.sql:71`).
- **Les tests et l'outillage sont propres.** pytest : `34 passed in 0.87s`. `conftest.py` fixe sa configuration avant d'importer l'application (`:6-7`). `tsc -b` et oxlint sortent avec le code 0.

## Constats
| # | Gravité | Constat | Preuve | Correction proposée (précise, applicable) |
|---|---------|---------|--------|-------------------------------------------|
| 1 | MAJEUR | **Régression introduite par #3 : le texte rendu reste « collé » au composeur.** `draft` n'est jamais vidé. `Composer` lit `initialValue={chat.draft?.text}` à chaque montage, et il est remonté à chaque fois que la page passe de l'état vide à l'état avec messages, ou l'inverse (le composeur change de parent entre `EmptyState` et le bas de page). Conséquences : **(a)** juste après l'envoi du texte rendu, il est toujours dans le composeur, donc un 2e Entrée l'envoie une deuxième fois ; **(b)** chaque « New chat » de la session pré-remplit ce vieux texte, jusqu'au rechargement. | Reproduit (T5) dans une nouvelle conversation. J'envoie « Audit T5: say ok. », puis Stop avant le 1er mot : le composeur contient bien le texte, l'adresse est `/` et la conversation `02fb3e12…` renvoie 404 (#3 fonctionne). Ensuite, Entrée : le composeur 400 ms après l'envoi contient « Audit T5: say ok. », et toujours après la réponse « Ok. ». Puis New chat : le composeur sur `/` contient encore « Audit T5: say ok. ». Code : `useChat.ts:35,119` (aucun `setDraft(null)`), `ChatPage.tsx:98-100`, `Composer.tsx:16` | Rendre le texte une seule fois. Dans `send` (début) et dans `newChat` / `openConversation`, faire `setDraft((d) => (d ? { text: '', n: d.n } : d))` : on garde `n`, ce qui évite un remontage inutile, et un montage suivant reçoit `''`. Alternative : `Composer` appelle `onDraftConsumed()` dans un `useEffect` au montage. Ajouter un test manuel ou Playwright : « Stop avant le 1er mot → renvoyer → le composeur est vide → New chat → le composeur est vide ». |
| 2 | MINEUR | **La valeur du contexte change toujours à chaque rendu** (`useMemo([chat])` ne sert à rien). Le choix est documenté et `MessageBubble` est mémoïsé, mais la barre latérale et ses éléments sont redessinés à chaque fragment reçu. | `ChatContext.tsx:20-23` | Envelopper `ConversationItem` dans `memo` et lui passer `active` en prop. Cela suffit à supprimer l'essentiel du coût sans éclater le contexte. |
| 3 | MINEUR | **Le parseur SSE et la navigation n'ont toujours aucun test automatique côté navigateur.** Le refus est documenté (hors périmètre du cours), mais c'est précisément là que se trouvaient les régressions des tours 1 et 2. | `docs/audit/tour-1/SYNTHESE.md:22`. Pas de `*.test.ts` dans `Frontend/` | Au minimum, une liste de vérifications manuelles dans le README (Retour, changer pendant le flux, Stop avant le 1er mot puis renvoyer, lien invalide). Idéalement, un test Vitest de `readStream`. |
| 4 | IDÉE | **Dates naïves (heure locale du serveur)**, reporté et documenté. Je ne le pénalise pas. | `conversation_service.py:65,146` | UTC partout si le projet est un jour déployé. |

### Conversations de test
- `678b0f0c-219c-41f8-8a6f-21bb80ef6a7b` (T4b, annulée avant le 1er mot) : supprimée par l'application, GET renvoie 404.
- `02fb3e12-99fc-40f5-81a5-1c57c695ad34` (T5, Stop avant le 1er mot) : supprimée par l'application, GET renvoie 404.
- `dd6570c7-e951-4f96-8fa0-a5b7db2f606f` (T5, renvoi, messages 158-159) : supprimée par `DELETE`, réponse 204.
- Les 12 conversations protégées sont intactes. Vérifié pour `711d022f…` : messages `[33, 34, 35, 36]`.

### Sorties des commandes
- `env/bin/python -m pytest -q` : `34 passed in 0.87s`.
- `npx tsc -b` : code 0 ; oxlint : code 0.
- `vite build` : `index.css 51.63 kB`, `AboutPage 8.29 kB`, `Markdown 237.80 kB (gzip 73.69)`, `index 441.13 kB (gzip 141.26)`. Aucun avertissement de taille.

## Vérification des corrections du tour précédent
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 (MAJEUR, conflit annulation / navigation) | Oui | T4b : 12 relevés d'adresse sur `711d022f`, titre « SQL vs NoSQL Database Comparison · Cortanyx », composeur vide, `678b0f0c` → 404. Code : `useChat.ts:87,110-125,166,187,196` |
| 2 (« Conversation not found » perdu) | Oui | Lien `/chat/0000…` ouvert depuis SQL → `/ \| EMPTY \| alert: Conversation not found.` Code : `ChatPage.tsx:25` (`newChat(true)`), `useChat.ts:185-190` |
| 3 (texte perdu après Stop avant le 1er mot) | Oui, mais avec régression (constat 1) | Le texte revient bien dans le composeur après Stop (T5), mais il n'est jamais consommé. |
| 4 (chunk Markdown 330 kB) | Oui | 237,80 kB (gzip 73,69) ; `Markdown.tsx:1-23` |
| 5 (413 contourné en chunked) | Oui | curl chunked de 100 kB → `413` ; `security.py:33-74` ; `test_chunked_body_is_limited_too` |
| 6 (budget sans index) | Oui | `schema.sql:45`, `chatgpt_clone.sql:71` (`idx_messages_created`) |
| 7 (échec de `save_answer`) | Oui | `conversations.py:139-148,158-163` ; `test_answer_save_failure_sends_error_and_keeps_db_clean` |
| 8 (tests côté navigateur) | Refusé, documenté | `SYNTHESE.md:22` : reste MINEUR (constat 3) |
| 9 (dates naïves) | Reporté, documenté | IDÉE, non pénalisée |

## Ce qu'il faudrait pour passer à 10
- **Corriger le constat 1**, un changement de 2 lignes dans `useChat.ts` : vider `draft.text` à l'envoi, dans `newChat` et dans `openConversation` (en gardant `n`). Avec cette correction et rien d'autre, je mettrais **9/10 VALIDÉ**.
- Constat 2 : `memo` sur `ConversationItem` pour que la barre latérale ne soit plus redessinée pendant le flux.
- Constat 3 : au minimum une liste de vérifications manuelles de navigation dans le README, ou un test Vitest du parseur SSE. C'est ce qui distinguerait un 9 d'un 10.
