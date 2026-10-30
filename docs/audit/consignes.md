# Consignes officielles du projet (source : `~/Desktop/פרויקט-גמר.pdf`, John Bryce)

Traduction fidèle de l'énoncé en hébreu « Full Stack Web Developer Project — Database | Python | REST API | React | GenAI ».
Chaque exigence a un identifiant. Les agents d'audit s'y réfèrent (ex. « C-07 : CONFORME »).

## Général
- **C-01** Construire son propre site de type ChatGPT, qui permet à l'utilisateur de mener une conversation continue avec le chat.

## Infrastructure (une option au choix)
- **C-02** Option A (choisie) : un serveur Python qui expose une **REST API** avec **FastAPI** (ou Flask), et un client **React** qui est un site **SPA** communiquant avec cette REST API.
  (Option B non retenue : un projet Flask MPA unique.)
- **C-03** Le système doit contenir une base de données **MySQL**.

## Description du système
L'interface montrée dans l'énoncé est indicative : toute autre interface **esthétique** qui répond au cahier des charges est acceptée.

### Page d'accueil
- **C-04** Elle permet à l'utilisateur de converser avec le chat ; l'utilisateur peut démarrer une conversation.
- **C-05** La conversation est affichée sur la page : les messages de l'utilisateur d'un côté, ceux du chat de l'autre côté.
- **C-06** L'utilisateur peut continuer la même conversation.
- **C-07** Le chat doit continuer à répondre à **la même conversation exactement, dans le même contexte**, et toute la conversation reste affichée sur la page.
- **C-08** Un **bouton** permet de démarrer une **nouvelle conversation**.

### Points d'attention
- **C-09** Après un **Refresh** de la page, il n'est pas obligatoire de réafficher la conversation : on peut repartir d'une conversation vide. (Réafficher est autorisé.)
- **C-10** L'appel à l'**API OpenAI** se fait **côté serveur**, jamais côté client.
- **C-11** La **clé API** est stockée dans un fichier **`.env` côté serveur**. Aucune clé côté client.
- **C-12** Le fichier **`requirements.txt`** côté serveur, avec les installations Python nécessaires, est **obligatoire**.

### Page « À propos »
- **C-13** Elle contient des détails **sur le système et sur le développeur**.

### Menu principal
- **C-14** Il permet de **naviguer entre la page d'accueil et la page « À propos »**.

### Base de données
- **C-15** Les conversations doivent être **enregistrées dans la base**.
- **C-16** La base est conçue pour que quiconque regarde les données puisse voir **si un message a été écrit par l'utilisateur ou par le chat**.
- **C-17** … et puisse **distinguer une conversation d'une autre** (par exemple un identifiant unique de conversation).

## Mise sur GitHub
- **C-18** Le code du projet est sur **GitHub**.
- **C-19** Le **lien** GitHub est indiqué dans le fichier **`README.md`** à la racine du projet.
- **C-20** Le fichier **`.env` n'est pas envoyé** sur GitHub, et il est indiqué dans le **`.gitignore`**.

## Rendu
- **C-21** Le projet est dans un dossier qui porte le **nom complet de l'étudiant en anglais** (`MordehaiLevy`), et qui contient **trois dossiers** :
  - `Database` : la base de données (**export** fait correctement) ;
  - `Backend` : le projet serveur ;
  - `Frontend` : le projet client.
- **C-22** La collection **Postman** est **exportée** et enregistrée dans le dossier du **serveur**.
- **C-23** Le dossier **`env`** (environnement virtuel Python) est **supprimé** du projet serveur.
- **C-24** Le dossier **`node_modules`** est **supprimé** du projet client.
- **C-25** Un **seul fichier zip** du dossier principal est envoyé dans l'onglet de remise des devoirs du site du cours.

## Comment le vérifier ici
- Rendu : `./make_submission.sh` crée `MordehaiLevy.zip` ; l'inspecter avec `unzip -l MordehaiLevy.zip`.
- GitHub : `gh repo view mordehailevy/cortanyx`, et `gh api repos/mordehailevy/cortanyx/git/trees/main?recursive=1`.
- Base : `mysql -u root chatgpt_clone -e "SELECT * FROM v_conversation_messages LIMIT 5"`.
