# 🤖 Meeting Planner Bot

A Discord bot for efficiently scheduling meetings using interactive commands and embeds — with a fun `/spin` command included for community engagement.

---

## 📦 Features

- 📆 **Create and manage meetings** directly in Discord
- ⏰ **Add time ranges**, share availability, and finalize group schedules
- 🔒 **User-isolated sessions** — multiple users can manage separate meetings without conflict
- 📋 **Embed-based UI** with buttons, dropdowns, and modals
- 🎡 **Fun `/spin` command** for giveaways or memes (includes visual spin results)

---

## 🧩 Commands

### `/meeting`

Create a new meeting session.

#### Usage:
```bash
/meeting
```

➡️ This will:
- Prompt the user to enter a meeting title
- Generate a control embed with interactive buttons
- Allow adding available time ranges (e.g. 09:00-11:00)
- Invite other participants to input their availability

---

### `/finishmeeting`

Finalize a meeting and calculate the most compatible time slot based on all participants.

#### Usage:
```bash
/finishmeeting
```

➡️ Will:
- Display the most common overlapping time ranges
- Lock the session to prevent further edits

---

### `/listmeetings`

List all current meetings you are managing or participating in.

#### Usage:
```bash
/listmeetings
```

➡️ Shows:
- Titles of ongoing meetings
- Quick-access buttons repost each

---

### `/spin`

🎡 A meme/fun command that randomly selects a winner from a specified role (e.g. "SpinMaster").

#### Usage:
```bash
/spin
```

➡️ Randomly:
- Selects a non-bot user with the designated role
- Visually displays a “spin wheel” result using custom artwork
- Updates a leaderboard of past winners

📸 Artwork by yoshi draw

---

## 🔐 Configuration

Some hardcoded values are stored in:

### `constants.js`

| Key                     | Description                                                                 |
|------------------------|-----------------------------------------------------------------------------|
| `LOG_CHANNEL_ID`        | The channel where bot logs (like startup or errors) are sent.              |
| `spinRoleId`            | The role ID that grants permission to use the `/spin` command.             |
| `leaderboardChannelId`  | The ID of the channel where the spin leaderboard embed is posted.          |
| `leaderboardMessageId`  | The message ID of the leaderboard embed to update.                         |
| `KMC`                   | The channel ID where spins actually count toward the leaderboard. Mainly used for testing — will be converted to an array. |
| `TOXXA`                 | A user ID excluded from spin results (for meme purposes).                  |
| `MEET_AUTHORIZED_ROLE_IDS` | An array of role IDs allowed to delete any meeting, not just their own.      |

---

## 💾 Data Storage

All persistent data (meetings, spin results) is stored in:

### `data.json`

Accessed via:
- `dataStore.js` for structured read/write
- Shared across features to ensure consistency

---

## 🛠️ Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example config file:
   ```bash
   cp config.example.json config.json
   ```
3. Edit config.json with your actual credentials:   
   ```json
   {
      "token": "YOUR_DISCORD_BOT_TOKEN",
      "clientId": "YOUR_BOT_CLIENT_ID",
      "guildId": "YOUR_GUILD_ID"
   }
   ```
4. Export the slash commands to your Discord server:
   ```bash
   node commands.js
   ```

5. Run the bot:
   ```bash
   node index.js
   ```

---

## 📁 Folder Structure

```
features/
├── meetings/
│   ├── meet.js
│   ├── meetingManager.js
│   ├── embedUtils.js
│   └── queueHandler.js
├── spin/
│   ├── spinn.js
│   └── spinWorker.js
helpers/
├── dataStore.js
└── logger.js

```

---

## 🔮 Upcoming

- A slimmed-down version of this bot **without the `/spin` command**
- Inline constant descriptions
- Possibly migrating to a persistent database

---
