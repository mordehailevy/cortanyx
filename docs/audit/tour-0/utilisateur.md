# Audit audit-utilisateur — tour 0
Note : 8/10 — NON VALIDÉ (aucun BLOQUANT, mais 2 MAJEURS : une réponse coupée par un Refresh reste figée sans signal, et il n'y a pas de bouton Régénérer)

Notes par persona : Lucas (ordinateur) 8,5/10 ; Noa (mobile, hébreu, sombre) 8,5/10 ; correcteur pressé 7,5/10. Note globale 8/10.

Méthode : navigateur intégré, mon onglet tab-8, 6 messages envoyés (limite respectée). Remarques sur les captures : le volet du navigateur a été redimensionné plusieurs fois par l'environnement, donc plusieurs captures sont à des largeurs inhabituelles. Les constats ci-dessous ont été revérifiés par le DOM.

## Ce qui est excellent
- **Suivi de contexte.** J'ai demandé « Now add authentication to that example (keep it short, JWT) » après l'exemple REST. La réponse a repris l'exemple FastAPI et y a ajouté du JWT. Le saut de ligne Maj+Entrée a bien agrandi la zone de saisie, et Entrée a envoyé.
- **Titres automatiques.** La conversation est devenue « Understanding REST API with FastAPI », et la conversation hébreue « פונקציה לסכום רשימה ב-Python ».
- **Streaming et Stop.** Le bouton carré arrête la réponse au milieu d'un mot. L'envoi défile bien vers le message quand on est en bas. Sur mobile, remonter pendant la génération ne force pas de retour en bas. Le bouton « Scroll to latest message » apparaît, et son clic ramène à la fin.
- **Hébreu et sens de lecture.**
  - Mes messages hébreux et les réponses sont en RTL.
  - Le bloc de code Python reste en gauche-à-droite, avec « python » à gauche et « Copy code » à droite.
  - La zone de saisie passe en RTL dès la frappe d'hébreu.
  - Le titre dans l'en-tête est en RTL.
  - Aucun débordement horizontal (`scrollWidth` = 375 pour une largeur de 375).
- **Barre latérale.** Épingler fonctionne : la conversation passe dans « Pinned », avec une icône dans l'en-tête. Le renommage ouvre une boîte de dialogue prérempie et autofocus, et Entrée enregistre. La recherche filtre en direct, et Échap la ferme. La barre se replie en rail d'icônes et cet état persiste après navigation.
- **Mobile sombre.** Le tiroir est propre et lisible, et la bascule de thème est en bas du tiroir. La suppression demande « Delete conversation? » avec Cancel et Delete en rouge.
- **Page À propos.** Elle présente clairement le système (6 cartes, schéma React → FastAPI → MySQL → OpenAI, stack) et le développeur, avec les liens GitHub et « Try the chat ». Elle est lisible en 5 secondes.
- **Chemins invalides.** `/chat/n-importe-quoi` et `/nimporte` renvoient à l'accueil sans plantage.

## Constats
| # | Gravité | Constat | Preuve | Correction proposée |
|---|---------|---------|--------|---------------------|
| 1 | MAJEUR | Refresh en pleine génération : la réponse est coupée net, sans signal ni moyen de la relancer. Persona : correcteur. | Prompt « Explique en 400 mots… » envoyé, rechargement environ 2 s plus tard. Au rechargement, la réponse s'arrête à « Les index sont généralement organisés sous ». Elle ne bouge plus après 6 s. Le titre reste « New conversation ». Aucun indicateur « interrompue ». Boutons présents : Copy seulement, pas de Régénérer. | Côté serveur, ne pas annuler à la déconnexion, ou finir la génération en tâche de fond. À défaut, marquer le message « interrompu » et proposer « Regenerate » ou « Continue ». Générer le titre aussi après un arrêt ou une déconnexion. |
| 2 | MAJEUR | Aucun bouton « Régénérer » ni « Modifier le message ». Après un Stop ou une coupure, la seule option est de retaper. Persona : Lucas. | Les boutons sous une réponse se limitent à « Copy » (find/DOM). ChatGPT et Claude proposent regenerate, edit et retry. | Ajouter au minimum « Regenerate » sur le dernier message assistant. |
| 3 | MINEUR | Un Stop laisse la réponse tronquée sans marqueur (« … The »). Après rechargement le texte est plus long que ce qui était affiché (« The Birth of the World Wide Web / While »). Écran et base ne sont pas cohérents. Persona : Lucas. | Stop à « …addresses. The ». Après reload, le contenu va jusqu'à « …The Birth of the World Wide Web While ». | Afficher une mention « Stopped » et sauvegarder exactement ce qui a été affiché. |
| 4 | MINEUR | Pas de message quand l'adresse `/chat/<id>` n'existe pas : redirection silencieuse vers l'accueil. Persona : correcteur. | `/chat/n-importe-quoi` redirige vers `/` sans toast ni explication. | Toast ou bandeau « Conversation not found », ou une page 404 simple pour les routes inconnues. |
| 5 | MINEUR | Défilement à l'envoi : si l'utilisateur est remonté dans la conversation, envoyer un message ne ramène pas en bas. Il ne voit ni son message ni la réponse. Persona : Lucas. | J'avais remonté en haut, puis envoyé un message. `scrollTop` restait à 0 pendant que le contenu passait à 3870 px. Le bouton « descendre » était visible. | Scroller vers le bas à chaque envoi par l'utilisateur, quelle que soit la position. |
| 6 | MINEUR | La recherche ne porte que sur les titres. « JWT » donne « No conversation matches your search » alors que le mot est dans le contenu d'une conversation. Persona : Lucas. | Saisie de « SQL » : 1 résultat (titre). Saisie de « JWT » : aucun résultat. | Chercher aussi dans les messages, via un `LIKE` côté API. À défaut, préciser « Search titles » en placeholder. |
| 7 | MINEUR | Zones tactiles sous 44 px sur mobile. Persona : Noa. | À 375 px : « Open menu » 40×40, « New chat » 40×40, « Copy code » 96×24, « Copy » 64×24, bouton « Scroll to latest message » 36×36. | Porter les boutons d'en-tête à 44×44 et ajouter du padding aux boutons Copy. |
| 8 | MINEUR | L'interface reste en anglais pour une utilisatrice hébréophone. Les titres « Good evening », « Message Cortanyx… » et la page À propos ne sont pas traduits. Seuls le contenu et le sens de lecture s'adaptent. La salutation est aussi figée sur « Good evening ». Persona : Noa. | Écran d'accueil mobile entièrement en anglais, sauf le chip « עברית ». | Documenter le choix « interface en anglais ». Option : un sélecteur de langue simple pour le chrome de l'interface. |
| 9 | MINEUR | Quand un titre contient de l'hébreu mêlé à du latin (ex. `Python`), les guillemets de la boîte de suppression sont mal placés dans le texte bidi. Persona : Noa. | Boîte de suppression : `"Python-ב ... "` avec guillemets à des positions incohérentes. | Isoler le titre avec `<bdi>` ou `dir="auto"` dans la boîte de dialogue. |
| 10 | MINEUR | Le `<title>` de l'onglet reste « Cortanyx » sur toutes les pages et ne reflète pas la conversation. Persona : correcteur. | `document.title` = « Cortanyx » sur `/chat/…`, `/about`, `/`. | Mettre `document.title = "<titre> – Cortanyx"`. |
| 11 | MINEUR | Les conversations non titrées s'accumulent en « New conversation » dans la barre latérale (conversations de test des autres agents et du serveur après coupure). Une liste pleine de « New conversation » fait désordre sur mobile. Persona : correcteur. | Tiroir mobile : 9 entrées « New conversation » d'affilée. | Générer le titre à partir du premier message dès l'envoi (côté serveur, sans attendre la fin du stream). |
| 12 | IDÉE | Les lignes de code longues sont coupées visuellement (`get_cu…`) avec défilement horizontal, ce qui est correct, mais rien n'indique qu'on peut défiler. | Bloc JWT, ligne `Depends(get_cu` coupée. | Dégradé ou ombre au bord pour signaler le défilement. |

## Moment wahou
- Le suivi de contexte sur l'exemple FastAPI, le titre généré tout seul, puis le tiroir mobile sombre avec bascule de thème.
- L'hébreu : la zone de saisie qui passe en RTL dès la frappe, et un bloc de code qui reste en LTR dans une réponse RTL. C'est mieux fini que beaucoup de clones.
- Le rail d'icônes quand la barre latérale est repliée : très « vrai produit », proche de ChatGPT.

## Moment où j'aurais quitté l'application
- J'ai rechargé la page pendant une longue réponse. Elle est restée figée à mi-phrase, sans erreur, sans bouton pour relancer. Avec ChatGPT ou Claude, la réponse continue ou propose Retry.
- Si mon premier essai avait été de recharger pendant la génération, j'aurais conclu que l'application « perd mes réponses ».

## Conversations créées et supprimées
- `96519c13-f3c9-420a-95cd-42a003f6b5f2` (renommée « AUDIT test Lucas », épinglée) : supprimée par l'API, statut 204.
- `fde58320-75f4-47ac-b087-79548b1608bb` (« Explique en 400 mots… », coupée par le Refresh) : supprimée par l'API, statut 204.
- `b95b1fb4-3e02-437b-9c0a-e9b45173c909` (conversation hébreue, Noa) : supprimée via le menu de l'interface, avec confirmation. Un second DELETE API a renvoyé 404, donc la suppression était déjà effective.
- Aucune des 6 conversations d'avant l'audit n'a été touchée. Les autres entrées « New conversation », « renamed » et « Test d'affichage et recopie » dans la barre latérale ne sont pas de moi.

## Fin d'audit
- `resize_window` en preset `desktop` appliqué, onglet tab-8 fermé.
- Aucun fichier du projet n'a été modifié, aucun secret affiché.

## Ce qu'il faudrait pour passer à 10
- Corriger le point 1 (coupure par Refresh) et ajouter un bouton Régénérer (point 2), les deux seuls MAJEURS.
- Aligner les détails sur ChatGPT : mention « Stopped », défilement à l'envoi, recherche dans les messages, 404 explicite, zones tactiles à 44 px, titres de page dynamiques.
- Relancer un tour pour vérifier que le tiroir mobile et la barre repliée ne régressent pas après ces changements.
