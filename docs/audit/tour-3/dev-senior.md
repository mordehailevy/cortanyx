# Audit audit-dev-senior — tour 3
Note : 9/10 — VALIDÉ

Toutes les corrections du tour 2 sont faites, et je les ai vérifiées dans le navigateur. Je n'ai trouvé aucune régression sur les scénarios des tours 1 et 2 : T4, Retour/Suivant, suppression, lien invalide, texte rendu. Il ne reste aucun BLOQUANT ni aucun MAJEUR.

Méthode : j'ai relu le code modifié (`useChat.ts` avec `consumeDraft` et `discardedRef`, `ChatContext.tsx` avec `ActionsContext`, `AppSidebar.tsx`, la section « Manual checks » du README). J'ai relancé pytest, tsc, lint et build (sortie dans le scratchpad, supprimée ensuite). J'ai rejoué 7 scénarios dans mon propre onglet, fermé à la fin. **3 messages ont été envoyés au chat.**

## Ce qui est excellent (3 à 6 puces, avec preuves)
- **Le texte rendu au composeur est désormais à usage unique, vérifié en vrai (T5b).**
  - Stop avant le 1er mot : le composeur contient « Audit T5b: say ok. », l'adresse est `/`, la conversation `0047100c…` renvoie 404.
  - Renvoi du message : composeur vide à 400 ms et vide après la réponse « Ok. ».
  - New chat : composeur vide.
  - Code : `consumeDraft` vide le texte en gardant `n` (`useChat.ts:282`), appelé dans `send` (`:65`), `newChat` (`:196`) et `openConversation` (`:206`).
- **Pas de régression sur le conflit annulation / navigation (T4c).** Clic sur SQL avant le 1er mot : l'adresse reste `711d022f` sur les 12 relevés, le titre et le contenu sont ceux de SQL, il n'y a aucune alerte, et la conversation abandonnée `c892de16…` renvoie 404. `discardedRef` (`useChat.ts:119-120,203`) empêche aussi de rouvrir une conversation supprimée localement.
- **La navigation est entièrement juste, vérifiée en vrai :**
  - Retour vers `/` : écran vide. Suivant : SQL.
  - Retour de Salutation vers SQL : bon contenu.
  - Lien `/chat/0000…` : retour à `/` avec « Conversation not found. » affiché.
  - Suppression de la conversation ouverte (`ce65a6d1…`) : retour à `/`, écran vide, conversation en 404.
- **Les re-rendus sont maîtrisés.** `ConversationItem` est mémoïsé et reçoit `active` en prop (`AppSidebar.tsx:199,207`). Les actions passent par un contexte séparé, mémoïsé sur `togglePin` (`ChatContext.tsx:15-30`). `MessageBubble` est mémoïsé. Le choix de ne pas éclater le contexte principal est raisonnable et documenté.
- **Tout passe et rien n'a régressé côté build :**
  - pytest : `34 passed in 1.71s`.
  - `tsc -b` : code 0 ; oxlint : code 0.
  - Build : `index 441.72 kB (gzip 141.45)` et `Markdown 237.80 kB (gzip 73.68)` (chargé en lazy), `AboutPage 8.29 kB`, aucun avertissement de taille.
- **Le README est désormais exploitable par un repreneur.** La section « Manual checks » (`README.md:188-198`) liste exactement les 7 parcours qui ont régressé pendant l'audit : contexte, Stop, Stop avant le 1er mot, changement pendant le flux, Retour/Suivant, suppression et lien invalide, piège de focus sur mobile.

## Constats
| # | Gravité | Constat | Preuve | Correction proposée (précise, applicable) |
|---|---------|---------|--------|-------------------------------------------|
| 1 | MINEUR | **Dans le tiroir mobile, la mémoïsation de `ConversationItem` ne sert à rien.** `onNavigate={() => setDrawerOpen(false)}` est une nouvelle fonction à chaque rendu de `Shell`, donc chaque élément est redessiné à chaque fragment tant que le tiroir est ouvert. L'impact est faible (le tiroir est rarement ouvert pendant un flux), et la barre latérale sur ordinateur n'est pas concernée (`onNavigate` y est indéfini). | `App.tsx:91`, `AppSidebar.tsx:199` | `const closeDrawer = useCallback(() => setDrawerOpen(false), [])`, puis `onNavigate={closeDrawer}`. |
| 2 | MINEUR | **Aucun test automatique côté navigateur.** Le refus est documenté, et la liste de vérifications manuelles du README compense en partie. Les parcours qui ont régressé deux fois restent toutefois vérifiés seulement à la main. | `README.md:188-198` ; pas de `*.test.ts` dans `Frontend/` | Un test Vitest de `readStream`, sur la partie la plus délicate : bloc coupé entre deux fragments, `\r\n`, flux sans `done`, `error` reçu après `done`. |
| 3 | IDÉE | **Les dates restent naïves (heure locale du serveur).** Reporté et documenté, non pénalisé. | `conversation_service.py:65,146` | UTC partout si le projet est un jour déployé. |

### Conversations de test
- `ce65a6d1-06f2-4c55-906b-227dfc1b6683` : créée par l'API, supprimée par le menu de l'interface → 404.
- `c892de16-175b-484c-90b6-800e6e0f9a67` (T4c) et `0047100c-7307-4cdf-ba8b-f65ad11375c5` (T5b, Stop) : supprimées par l'application → 404.
- `f937619f-4df9-491c-9f77-ca6d0b0262d6` (T5b, renvoi, messages 165-166) : supprimée par `DELETE` → 204.
- Les 12 conversations protégées répondent toutes 200. `711d022f…` garde ses messages `[33, 34, 35, 36]`.

## Vérification des corrections du tour précédent
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 (MAJEUR, texte rendu « collé ») | Oui | T5b : texte rendu après Stop, composeur `""` à 400 ms et après la réponse, `""` après New chat. `useChat.ts:65,196,206,282` |
| 2 (barre latérale redessinée pendant le flux) | Oui (ordinateur) ; reste mineur sur mobile | `AppSidebar.tsx:199,207`, `ChatContext.tsx:15-30`. Sur mobile, voir le constat 1. |
| 3 (aucune vérification de la navigation) | Oui (sous forme manuelle) | `README.md:188-198`. Pas de test automatique (constat 2, non bloquant). |
| 4 (dates naïves) | Reporté, documenté | IDÉE, non pénalisée |
| Nouveau (échec rapide du 1er message → « Conversation not found. ») | Oui (code relu) | `useChat.ts:119-120` (`discardedRef.add` avant la suppression), `:203` (retour `false` sans requête). Aussi couvert indirectement par T5b : après Stop, l'adresse est `/` sans fausse alerte. |

## Ce qu'il faudrait pour passer à 10
- Constat 1 : un `useCallback` sur `closeDrawer` dans `App.tsx`.
- Constat 2 : un fichier `Frontend/src/lib/api.test.ts` (Vitest) pour le parseur SSE. Ce serait la seule protection automatique de la partie du front qui a été la plus fragile pendant l'audit.
- Optionnel : passer les dates en UTC.
