# Grille commune des audits Cortanyx

Tous les agents d'audit rendent leur rapport **dans ce format exact**, en français, sans rien inventer : chaque constat cite une preuve (fichier:ligne, commande lancée et son résultat, ou capture/observation dans le navigateur).

## Barème (note sur 10)
- **10** : niveau production, rien à redire dans ton domaine.
- **9** : excellent, seulement des détails cosmétiques.
- **8** : bon, quelques améliorations utiles mais rien d'important.
- **6–7** : correct mais des défauts visibles qu'un correcteur ou un utilisateur remarquerait.
- **≤ 5** : problèmes sérieux.

**Validation d'un audit : note ≥ 9 et aucun point BLOQUANT.**

## Gravité des constats
- **BLOQUANT** : consigne non respectée, bug qui casse un parcours, faille de sécurité réelle, donnée perdue, secret exposé.
- **MAJEUR** : défaut visible ou risque réel, à corriger avant le rendu.
- **MINEUR** : amélioration de qualité.
- **IDÉE** : bonus qui rendrait le projet encore meilleur (le maître décide).

## Format du rapport (obligatoire)

```
# Audit <nom-de-l-agent> — tour <N>
Note : X/10 — VALIDÉ | NON VALIDÉ

## Ce qui est excellent (3 à 6 puces, avec preuves)

## Constats
| # | Gravité | Constat | Preuve | Correction proposée (précise, applicable) |
|---|---------|---------|--------|-------------------------------------------|

## Vérification des corrections du tour précédent (à partir du tour 2)
| # du tour précédent | Corrigé ? | Preuve |

## Ce qu'il faudrait pour passer à 10
```

## Règles communes
- Tu **n'écris dans aucun fichier du projet** et tu ne modifies rien (ni code, ni base, ni GitHub, ni compte OpenAI). Tu analyses, tu testes, tu proposes. Seul le maître corrige.
- Exception : tu peux créer des fichiers temporaires dans le dossier scratchpad que le maître t'indique, et les supprimer à la fin.
- Ne jamais afficher, copier ou citer une clé API, un mot de passe ou le contenu de `Backend/.env`. Pour vérifier un secret, ne regarde que sa présence, son format ou ses 4 derniers caractères.
- Les appels réels à OpenAI coûtent de l'argent (projet plafonné à 10 $/mois) : **au maximum 6 messages envoyés au chat par agent et par tour**, courts.
- Si tu crées des conversations de test dans l'application, **supprime-les à la fin** (via l'API `DELETE /api/conversations/{id}` ou le menu de l'interface), et liste leurs identifiants dans ton rapport.
- Dans le navigateur intégré : ouvre **ton propre onglet** (`tabs_create`), travaille dedans, remets la taille par défaut (`resize_window` preset `desktop`) et ferme-le à la fin. Ne touche pas aux onglets des autres.
- Sois exigeant comme un professionnel, mais juste : ne pénalise pas un choix documenté et raisonnable.
