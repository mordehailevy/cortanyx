# Audit audit-utilisateur — tour 1
Note : 9/10 — VALIDÉ (aucun BLOQUANT ni MAJEUR ; 5 points MINEUR résiduels)

Notes par persona : Lucas (ordinateur) 9/10 ; Noa (mobile, hébreu, sombre) 9/10 ; correcteur pressé 9/10. Note globale 9/10.

Méthode : nouvel onglet tab-13 dans le navigateur intégré, 6 messages envoyés au chat (la limite est atteinte). Je n'ai relevé les chiffres que par le DOM et l'API. Le volet du navigateur a été redimensionné par l'environnement, donc les captures sont à des largeurs variables.

## Ce qui est excellent
- **Refresh en pleine réponse.**
  - Prompt « Explique en 400 mots… » envoyé, rechargement environ 2 s plus tard.
  - La réponse reste tronquée (« …4. Avantages des index **Rapidité »), mais l'application propose maintenant le bouton « Regenerate this answer ».
  - Le titre est « Explique en 400 mots comment fonctionne un index SQL. » (plus de « New conversation »), et l'onglet reprend ce titre.
  - Le clic sur Regenerate remplace la réponse : une seule question affichée, un seul message assistant, bouton « Stop generating » pendant la génération.
- **Stop puis Regenerate.** Après Stop, la mention « Stopped » s'affiche avec Copy et Regenerate (réponse arrêtée à « En résumé, les index SQL sont »).
- **Changement de conversation pendant une réponse.**
  - J'ai envoyé un message puis cliqué tout de suite sur une autre conversation. La conversation ouverte n'affiche aucun Stop ni texte étranger.
  - Le retour dans la première conversation est propre, sans doublon.
  - Le Retour du navigateur (`history.back()`) ramène bien à `/chat/4067…` avec le bon titre d'en-tête et le bon `document.title`.
- **Hébreu, mobile 375 px, sombre.**
  - Même en rechargeant au milieu de la génération, le bouton Regenerate apparaît (réponse partielle de 1299 caractères). Après clic, la réponse complète fait 2653 caractères, avec une seule question.
  - Le texte est bien en RTL, sans débordement horizontal (`scrollWidth` = 375).
  - Le titre d'en-tête hébreu est tronqué proprement avec « … ». Dans le tiroir, l'élément actif a un liseré bleu.
  - Le bouton Regenerate fait 44×44 px et devient une icône seule sur mobile. Aucun contrôle de l'accueil n'est sous 44 px.
- **Lien invalide.** `/chat/inconnu` redirige vers l'accueil et affiche « Conversation not found. ».
- **Titre d'onglet dynamique.** « New chat · Cortanyx », « Salutation simple en une phrase · Cortanyx », etc.
- **Tiroir et menus.** Le tiroir mobile sombre est net. La bascule de thème (« Switch to dark theme ») fonctionne, `background-color` passe à `rgb(11, 17, 32)`.

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | MINEUR | Après un Refresh mid-stream, la réponse tronquée n'affiche aucune mention « Interrompue ». Seul le bouton Regenerate signale le problème. Le marqueur « Stopped » après un Stop disparaît aussi au rechargement. Persona : correcteur. | Après reload : texte terminé par « **Rapidité Copy Regenerate », sans mention. Après Stop puis reload : plus de « Stopped ». | Persister un drapeau `interrupted` sur le message (colonne ou champ calculé) et afficher « Stopped » ou « Interrupted » au rechargement. |
| 2 | MINEUR | Après Stop, l'écran est un peu plus court que la base : écran « …les index SQL sont », rechargement « …les index SQL sont des outils puissants ». L'écart se réduit à quelques mots depuis le tour 0. Persona : Lucas. | Comparaison du texte avant et après `navigate`. | Sauvegarder exactement ce qui a été rendu, ou arrêter le flux côté serveur au moment du Stop et renvoyer le texte final au client. |
| 3 | MINEUR | Changer de conversation juste après l'envoi, avant le premier mot, supprime silencieusement la question. L'utilisateur perd le texte tapé sans le savoir. Comportement annoncé par le coordinateur (« retire la question »), mais rien ne l'explique. Persona : correcteur. | J'ai envoyé « Donne 10 conseils… » puis cliqué sur « Salutation… » tout de suite. De retour, `GET /api/conversations/4067…` ne contient que 2 messages (ma question et la réponse initiales). Mon nouveau texte n'apparaît plus. | Remettre le texte dans la zone de saisie à l'annulation, ou afficher un toast « Message annulé ». |
| 4 | MINEUR | Chargement initial avec `prefers-color-scheme: dark` : la page s'ouvre en thème clair (la bascule du thème dit « Switch to dark theme »). Le thème suit un réglage interne et non le système au premier chargement. Persona : Noa. | À 375 px, colorScheme sombre émulé, `navigate` vers `/` : l'interface est claire. Clic sur la bascule : devient sombre. Point à vérifier : le navigateur intégré peut resynchroniser lui-même le thème, donc ce constat est à confirmer. | Initialiser le thème par `matchMedia('(prefers-color-scheme: dark)')` quand aucune préférence n'est stockée. |
| 5 | IDÉE | La suppression via le tiroir mobile laisse le tiroir ouvert après la redirection vers l'accueil (observé au tour 0, non retesté ce tour). | Observation du tour 0. | Fermer le tiroir après suppression. |

## Vérification des corrections du tour précédent
| # du tour précédent | Corrigé ? | Preuve |
|---|---|---|
| 1 (Refresh pendant la réponse : réponse figée) | Oui | Regenerate présent après reload, remplace la réponse, titre généré (« Explique en 400 mots… »). |
| 2 (pas de Régénérer) | Oui | Bouton « Regenerate this answer » sous la dernière réponse. Il est en icône 44×44 sur mobile. |
| 3 (écran différent de la base après Stop) | En grande partie | Mention « Stopped » présente. Il reste un écart de quelques mots, voir constat 2. |
| 4 (URL inconnue silencieuse) | Oui | `/chat/inconnu` : « Conversation not found. ». |
| 5 (envoi ne ramène pas en bas) | Oui, non vérifié en profondeur | L'envoi depuis une conversation ouverte affiche la nouvelle réponse sans que je doive défiler. Je n'ai pas refait le cas « remonté tout en haut puis envoyer ». |
| 6 (recherche annoncée) | Non retesté | Non rejoué ce tour. |
| 7 (cibles tactiles 44 px) | Oui | Accueil mobile : aucun contrôle sous 44 px. Regenerate 44×44. |
| 8 (interface en anglais) | Documenté, accepté | Choix documenté dans le README selon le coordinateur. |
| 9 (`<bdi>` dans la suppression) | Non retesté | Suppression non rejouée avec un titre bidi ce tour. |
| 10 (titre d'onglet) | Oui | `document.title` suit la conversation. |
| 11 (conversations « New conversation ») | Oui | Le tiroir ne montre plus que des titres réels, y compris pour une conversation interrompue. |
| Retour navigateur / changement de conversation pendant une réponse | Oui | Voir « Ce qui est excellent ». |

## Moment wahou
- Le Refresh en plein milieu d'une réponse : c'était le pire moment du tour 0, et il se rattrape maintenant en un clic sur Regenerate, avec un titre déjà généré. C'est exactement le comportement de ChatGPT.
- L'hébreu mobile en thème sombre reste le point fort, avec des paragraphes longs bien justifiés.

## Moment où j'aurais quitté l'application
Aucun ce tour. Le seul petit point de friction est la question tapée qui disparaît sans explication si on change de conversation trop vite (constat 3).

## Conversations créées et supprimées
- `40678932-9bfa-44e0-bab2-f8ce4837d630` (index SQL) : 204.
- `99b050ec-3a84-46ed-bb64-b25e96d76358` (histoire du vélo, « Evolution of Bicycle History ») : 204.
- `c1c2e9d3-a67c-4a78-8a10-7b663041ccea` (hébreu, 7 méthodes de tri) : 204.
- Les 6 conversations de `conversations-avant-audit.txt` sont toujours présentes (vérification par l'API).
- Les entrées « AUDIT-DEV-T2 » et « Test d'affichage » dans la barre latérale ne sont pas de moi.
- Aucun fichier du projet modifié, aucun secret affiché.
- `resize_window` en preset `desktop` appliqué et onglet tab-13 fermé.

## Ce qu'il faudrait pour passer à 10
- Persister l'état « interrompue » et la mention « Stopped » au rechargement (constat 1).
- Faire correspondre exactement l'écran et la base après un Stop (constat 2).
- Rendre le texte tapé quand on change de conversation avant le premier mot (constat 3).
- Suivre `prefers-color-scheme` au premier chargement si ce n'est pas déjà le cas (constat 4, à confirmer).
