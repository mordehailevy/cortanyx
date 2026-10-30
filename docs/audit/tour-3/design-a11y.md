# Audit audit-design-a11y — tour 3
Note : 9/10 (Design 9/10, Accessibilité 9/10, globale = la plus basse) — VALIDÉ (aucun BLOQUANT, aucun MAJEUR)

Méthode : nouvel onglet (fermé, preset desktop remis). 0 message envoyé au chat, aucune conversation créée, renommée ou supprimée (compte de conversations identique avant et après chaque test : 28/28 en mobile, 16/16 sur bureau). Dialogues Rename et Delete ouverts puis fermés par Échap, jamais confirmés. Instantanés du focus à 30, 100, 250, 500 et 900 ms après Échap (écouteur `keydown` en capture). Thème resté en sombre (réglé par un autre agent). Je n'ai pas pu rejouer les contrastes en clair : les tokens clairs n'ont pas changé depuis le tour 2.

## Ce qui est excellent
- **Tiroir mobile (375 px), Rename** : à l'ouverture, le focus est sur « Cortanyx home » dans le tiroir. Menu → Rename : focus sur `rename-input`. 1er Échap : instantanés 30 / 100 / 250 / 500 / 900 ms = `BUTTON Options for Salutation simple en une phrase`, tiroir toujours ouvert (`drawer=true`), dialogue fermé à 900 ms (`dlg=0`), un seul événement `focusin`. 2e Échap : 30 à 900 ms = `BUTTON Open menu`, tiroir fermé à 900 ms.
- **Tiroir mobile, Delete** : focus initial sur « Cancel ». 1er Échap : cinq instantanés sur « Options for … », tiroir ouvert, dialogue fermé, 28 conversations avant et après. 2e Échap : cinq instantanés sur « Open menu », tiroir fermé. Plus aucun BODY, plus de double fermeture (pile de pièges : seul le plus haut traite Échap).
- **Bureau, barre latérale** : Rename et Delete, cinq instantanés chacun sur `Options for Salutation simple en une phrase` (focus de départ `rename-input` / `Cancel`), 16/16 conversations.
- **Bureau, en-tête de conversation** : Rename et Delete, cinq instantanés chacun sur `Conversation options: Conseils pour débuter en React`.
- **Pas de régression** : en sombre, titres de section 6,96:1, « Search chats » 6,96:1, hint du composeur 7,34:1, conversation active 11,87:1, contour du composeur 3,96:1 ; blocs de code ≥ 9,77:1 (minimum des jetons mesurés sur ce bloc ; 7,51:1 au tour 2 sur l'ensemble des blocs). Titre dynamique et `h1` sr-only présents. Pas de défilement horizontal à 1440 ni à 375. À 375 px : aucune cible < 44 px hors un lien dans le texte (195×42, exempté).

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | MINEUR | Lien d'évitement « Skip to content » toujours pas le premier arrêt de Tab (composeur auto-focalisé). Choix documenté (comme Claude.ai), inchangé. | Journal des tours 0 à 2. | Optionnel : ne pas autofocaliser le composeur au premier chargement sur mobile (évite aussi l'ouverture du clavier virtuel). |
| 2 | MINEUR | `role="status"` sur « Stopped » : présent dans le code (`MessageBubble.tsx:87`), non vérifié dans le DOM faute de réponse interrompue (0 message envoyé). | Aucune réponse arrêtée dans les conversations protégées. | À valider lors d'un test réel d'arrêt de flux. |
| 3 | IDÉE | Différence de fond entre l'item actif et la barre latérale très faible (≈ 1,2:1 en sombre) : seule la barre bleue de 3 px signale l'état avec netteté (suffisant). | Mesure du tour 1. | Optionnel : `bg-primary/10` pour l'état actif, comme Claude.ai. |

## Vérification des corrections
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 (MAJEUR) focus perdu après Rename/Delete dans le tiroir mobile | OUI | Rename et Delete dans le tiroir : 1er Échap focus sur « Options for … » à 30/100/250/500/900 ms, tiroir ouvert, dialogue fermé ; 2e Échap focus sur « Open menu ». Plus de BODY. |
| Échap fermait le dialogue ET le tiroir | OUI | Après le 1er Échap, `drawer=true dlg=0` à 900 ms. |
| Bureau (barre latérale et en-tête, Rename et Delete) | OUI, sans régression | Vingt instantanés (4 parcours × 5), tous sur le bouton déclencheur ; conversations 16/16. |
| `ConversationItem` mémoïsé | Sans impact visible | Aucune régression de rendu constatée sur la liste (titres, active, menus). |
| `role="status"` sur « Stopped » | Code présent, DOM non vérifié | Voir constat 2. |

## Ce qu'il faudrait pour passer à 10
- Vérifier `role="status"` sur « Stopped » avec une vraie réponse interrompue.
- Traiter le skip link (premier arrêt de Tab) ou le documenter comme choix assumé dans le README.
- Optionnel : fond d'item actif un peu plus marqué, et un test final des contrastes en thème clair avec l'outil de mesure.
