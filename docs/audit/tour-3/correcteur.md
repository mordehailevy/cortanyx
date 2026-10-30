# Audit audit-correcteur — tour 3
Note : 9,5/10 (96/100 au barème du jury) — VALIDÉ (aucun point bloquant, aucun MAJEUR)

## Ce qui est excellent
- **Le parcours « premier message sans clé » est corrigé, rejoué dans mon propre onglet (tab-22).** Après saisie réelle de « Bonjour test » et Entrée : l'alerte affiche « The assistant is not configured: the server has no OpenAI API key (Backend/.env). » avec le bouton Retry, le texte saisi est revenu dans la zone de saisie (`textarea` = « Bonjour test »), l'URL reste `/`. Réseau : création 201, flux 200, DELETE 204, liste 200, et **plus aucun `GET /api/conversations/<id>` en 404**. Retry rejoue le même message sans changer l'écran.
- **Un échec dans une conversation existante est aussi propre.** Dans la conversation importée `b59f8614-…`, l'envoi de « suite » affiche la même erreur claire avec Retry, et les 6 éléments de la conversation restent à l'écran.
- **Parcours README dans l'ordre exact, sans clé : tout passe.** Zip neuf de 268 Ko (82 fichiers), sans `docs/audit/`, `Header`, `Sidebar`, `.env`, `env/` ni `node_modules/`. Import de l'export : 12 conversations, 48 messages, `pinned` présent. `cp .env.example .env`, `pip install -r requirements-dev.txt`, `pytest -q` : **34 passed en 0,75 s** avec le `.env` copié.
- **Serveur et build en bonne santé.** `/api/health` ok (clé non configurée), liste 200. `npm run build` : principal 441,72 kB, Markdown 237,80 kB, page À propos 8,29 kB, pas d'avertissement de taille. `npm run lint` : propre.
- **Documentation exacte.** Le README annonce 34 tests, conforme à `pytest`. Les 2 avertissements npm (outil de build) sont expliqués, et le mode mono-utilisateur local figure dans « Security ».

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | MINEUR | **GitHub n'est pas à jour (action en attente, voulue).** C-18/C-19 ne seront démontrés par la copie distante qu'après le push. | Information du coordinateur. Dépôt non revérifié dans ce tour. | Avec l'accord de l'étudiant : commit, `git push`, puis `gh api repos/mordehailevy/cortanyx/git/trees/main?recursive=1` pour vérifier que `requirements-dev.txt`, `AppSidebar.tsx` et l'export à jour y figurent. Vérifier ensuite que `https://github.com/mordehailevy/cortanyx` est bien indiqué dans le README. |
| 2 | IDÉE | Les dates de l'API restent sans fuseau (`2026-10-30T02:05:56.398000`, sans `Z`). | `GET /api/conversations/{id}` (tour 2, inchangé). | Sérialiser en UTC avec `Z`. Cosmétique. |

## Vérification des corrections du tour précédent
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 MAJEUR : « Conversation not found. » après l'échec du premier message, texte perdu | **Oui** | Replay réel : alerte « The assistant is not configured… » + Retry, `textarea` = « Bonjour test », pas de GET 404 dans le journal réseau, Retry fonctionne. |
| 2 MINEUR : README disait 32 tests | **Oui** | README ligne 41 : « 34 automated tests » ; `pytest` : 34 passed. |
| 3 MINEUR : GitHub en retard | En attente (voulu) | Push prévu à la fin avec l'accord de l'étudiant. Constat 1. |
| 4 MINEUR : avertissements npm non expliqués | **Oui** | Phrase ajoutée au README (annoncée et non contredite par `npm install`, qui affiche « 2 moderate severity vulnerabilities »). |
| 5 IDÉE : dates sans fuseau | Non (idée) | Constat 2. |

## Journal d'installation (commande → résultat)
| Étape | Commande | Résultat |
|---|---|---|
| Zip | `./make_submission.sh` | « Created MordehaiLevy.zip (268K) », 82 fichiers, propre. |
| Base | `sed s/chatgpt_clone/correcteur_tmp/g Database/chatgpt_clone.sql \| mysql -u root` | 12 conversations, 48 messages, `pinned` tinyint(1) indexé. |
| Backend | `python3.12 -m venv env`, `cp .env.example .env`, `pip install -r requirements-dev.txt`, `pytest -q` | **34 passed en 0,75 s.** |
| Backend, démarrage | `.env` adapté (base `correcteur_tmp`, clé vide), `uvicorn app.main:app --port 8010 --no-proxy-headers` | `/api/health` ok, `openai_key_configured: false`, liste 200. |
| Frontend | `npm install`, `npm run build`, `npm run lint` | OK, 2 avertissements d'outil de build, pas d'avertissement de taille. |
| Navigateur | Vite sur 5199 avec le proxy vers 8010 (copie locale modifiée), saisie réelle dans mon onglet | Parcours « premier message sans clé » corrigé (voir plus haut). |

Parcours du README : plus aucun point flou. Seuls restent l'action GitHub en attente et l'absence de vrai échange OpenAI (pas de clé dans ma copie), couverts par les 34 tests au faux client.

## Détail du barème
| Critère | Points obtenus |
|---|---|
| Respect de l'énoncé (C-01 à C-25) | 28/30. C-18/C-19 en attente du push (-2). Tout le reste est conforme. |
| Fonctionnement | 19/20. Pas de vrai échange OpenAI testable sans clé (-1). |
| Qualité du code serveur | 15/15. |
| Qualité du code client | 10/10. |
| Base de données | 10/10. |
| Esthétique et expérience utilisateur | 9/10. |
| Documentation, Postman, facilité d'installation | 5/5. |
| **Total** | **96/100** (bonus déjà au maximum des critères : streaming avec Stop, régénération, hébreu RTL, 34 tests indépendants du `.env`, hôte de confiance, limites de corps) |

## Ce que j'écrirais en commentaire sur la copie
« Excellent rendu : installation dans l'ordre du README sans une seule erreur, 34 tests verts, export qui fonctionne, erreurs claires y compris sans clé OpenAI, interface soignée. Poussez la dernière version sur GitHub avant la remise et vérifiez que le lien du README y mène : je mets 9,5. »

## Ce qu'il faudrait pour passer à 10
- Pousser sur GitHub et vérifier l'arbre distant (constat 1).
- Sérialiser les dates avec `Z` (constat 2).

Nettoyage fait : serveur 8010 et Vite arrêtés, base `correcteur_tmp` supprimée, dossier de travail supprimé, mon onglet tab-22 fermé (je n'ai touché à aucun autre). Conversations de test : `ad456f93-6892-4fee-a08b-865c4ec075ed` supprimée par le client lui-même, dans `correcteur_tmp` détruite avec la base. Le serveur sur 8000 répond toujours, la base `chatgpt_clone` n'a pas été touchée, aucun appel au vrai chat. Seul fichier modifié dans le projet : `/Users/annahbenyamine/MordehaiLevy/MordehaiLevy.zip` (régénéré par `./make_submission.sh`).
