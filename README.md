# 🐺 Wolfy Stats Bot

Bot Discord de statistiques Wolfy — inspiré de DapperBot.  
Affiche le profil, les stats, le classement et compare les joueurs directement depuis Discord.

---

## ⚡ Commandes

| Commande | Description |
|---|---|
| `/profil <pseudo>` | Fiche complète : lauriers, winrate, parties, camps, historique |
| `/stats <pseudo>` | Stats rapides en une ligne |
| `/classement [top]` | Top joueurs par lauriers |
| `/comparer <joueur1> <joueur2>` | Comparaison côte à côte |
| `/lier <pseudo>` | Lie ton Discord à ton pseudo Wolfy |

---

## 🚀 Installation

### 1. Prérequis

- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **Un bot Discord** — [discord.com/developers/applications](https://discord.com/developers/applications)

### 2. Créer le bot Discord

1. Va sur [discord.com/developers/applications](https://discord.com/developers/applications)
2. Clique **New Application** → donne un nom
3. Onglet **Bot** → clique **Add Bot** → copie le **Token**
4. Onglet **General Information** → copie l'**Application ID** (= CLIENT_ID)
5. Onglet **OAuth2 → URL Generator** :
   - Scopes : `bot` + `applications.commands`
   - Permissions : `Send Messages`, `Embed Links`, `Use Slash Commands`
6. Copie l'URL générée et invite le bot sur ton serveur

### 3. Installer les dépendances

```bash
npm install
```

### 4. Configurer

```bash
cp .env.example .env
```

Remplis `.env` :

```env
DISCORD_TOKEN=ton_token_ici
CLIENT_ID=ton_client_id_ici
GUILD_ID=ton_guild_id_ici   # ID de ton serveur Discord
```

> **Comment trouver le GUILD_ID ?** Active le mode développeur dans Discord (Paramètres → Avancé), puis fais clic droit sur ton serveur → *Copier l'ID*.

### 5. Lancer

```bash
npm start
```

Tu devrais voir :
```
✅ /profil
✅ /stats
✅ /classement
✅ /comparer
✅ /lier
🔄 Déploiement des slash commands...
✅ Commandes déployées !
🐺 WolfyBot#1234 connecté !
```

---

## 📁 Structure

```
wolfy-stats-bot/
├── src/
│   ├── index.js              # Démarrage du bot
│   ├── wolfy.js              # Scraper / client Wolfy
│   └── commands/
│       ├── profil.js         # Fiche complète
│       ├── stats.js          # Stats rapides
│       ├── classement.js     # Leaderboard
│       ├── comparer.js       # Comparaison 2 joueurs
│       └── lier.js           # Liaison compte Discord↔Wolfy
├── data/
│   └── links.json            # Pseudos liés (auto-créé)
├── .env.example
├── .env                      # À créer (non versionné)
└── package.json
```

---

## ⚠️ Note importante sur les données Wolfy

Wolfy n'a pas d'API publique officielle.  
Ce bot essaie plusieurs méthodes pour récupérer les stats :

1. **Endpoints API internes** que Wolfy utilise pour son site web
2. **Scraping HTML** de la page profil publique en fallback

Selon les mises à jour de Wolfy, certaines données peuvent être indisponibles ou partielles.  
Si un profil affiche *"données partielles"*, c'est normal — le profil existe mais Wolfy a restreint l'accès.

---

## 🛠 Développement

```bash
# Lancement avec rechargement automatique (Node 18+)
npm run dev
```

Pour ajouter une commande, crée un fichier dans `src/commands/` qui exporte :
- `data` : un `SlashCommandBuilder`
- `execute(interaction)` : la fonction handler

Elle sera chargée et déployée automatiquement au prochain démarrage.
