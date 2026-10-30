# Rapport final de l'audit multi-agents — Cortanyx (30/10/2026)

Agent maître : `.claude/skills/audit-maitre/SKILL.md` · 7 sous-agents : `.claude/agents/audit-*.md` · Référence : `consignes.md` (C-01 à C-25), `grille.md`.

## Notes, tour par tour (validation = ≥ 9/10 sans BLOQUANT)

| Audit | Tour 0 | Tour 1 | Tour 2 | Tour 3 |
|---|---|---|---|---|
| Conformité aux consignes | 6 | **9,5 ✅** | – | – |
| Développeur senior (10 ans) | 7 | 8 | 8 | **9 ✅** |
| Utilisateurs (3 personas) | 8 | **9 ✅** | – | – |
| Sécurité | **9 ✅** | – | – | – |
| Design et accessibilité | 7 | 8 | 8 | **9 ✅** |
| Correcteur John Bryce | 83/100 | 89/100 | 92/100 | **96/100 ✅** |
| QA (Newman, cas limites) | 7,5 | **9 ✅** | – | – |

**Résultat : les 7 audits sont validés, les 25 consignes sont conformes.**

## Ce que l'audit a fait corriger (principaux points)
- Livrables : export SQL périmé (bloquant), zip qui gardait des fichiers supprimés (bloquant), fichiers d'audit dans le zip, README (import, utilisateur MySQL, clé requise, nombre de tests, vérifications manuelles).
- Fiabilité : contrat du streaming (Stop avant / pendant la réponse, erreur après `done`, flux coupé, échec d'enregistrement), 3 bugs de navigation (changer de conversation pendant une réponse, Retour du navigateur, suppression), 3 régressions introduites par des corrections et rattrapées au tour suivant.
- Fonctionnalités : **Regenerate**, mention *Stopped*, titre de secours, texte rendu au champ, « Conversation not found ».
- Sécurité : budget de jetons par jour, limite 64 Ko (y compris `chunked`), hôtes autorisés, en-têtes, images Markdown en liens, erreurs 422 sans écho.
- Accessibilité : focus dans les dialogues et le tiroir (pile de pièges), cibles 44 px, contrastes (Delete, conversation active, champs), titre de page, `lang="he"`.
- Performance : JavaScript initial 775 → 442 ko, Markdown chargé à la demande (330 → 238 ko), liste et bulles mémoïsées.
- Tests : 12 → 34 tests pytest (indépendants du `.env`), collection Postman 12 → 17 requêtes (0 échec sous Newman).

## Refusés, avec la raison
Interface traduite en hébreu (hors énoncé ; contenu multilingue déjà géré), recherche plein texte (titres seulement, documenté), génération poursuivie après un rafraîchissement (rendrait Stop inutile ; Regenerate à la place), tests Vitest/Playwright (hors périmètre du cours ; liste de vérifications manuelles), dates en UTC (heure locale documentée), marqueur *Stopped* persistant (une colonne de plus pour un détail).

## Reste à faire (Mordehai)
1. Autoriser le commit et le push sur GitHub (C-18/C-19 : la version publique doit être celle du zip).
2. Envoyer `MordehaiLevy.zip` sur le site du cours.
3. Activer la double authentification du compte OpenAI.
