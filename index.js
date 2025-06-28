const { Client, GatewayIntentBits, Events } = require("discord.js");

const { token } = require("./config.json");
const { init: initLogger, botLog } = require("./helpers/logger");
const handleMeetingCommand = require("./features/meetings/meet");
const handleSpinCommand = require("./features/spin/spinn");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,                  // Basic guild structure & slash commands
        GatewayIntentBits.GuildMembers,            // Needed to access member roles and fetch users
        GatewayIntentBits.GuildMessages,           // If the bot sends or listens to messages
        GatewayIntentBits.MessageContent,          // Required if you plan to read message content (optional for you)
        GatewayIntentBits.GuildMessageReactions,   // Optional: if you handle reactions
    ],
});

initLogger(client);

client.once(Events.ClientReady, () => {
    botLog("Oreo has awakened. The judgment shall now commence.");
});

client.on(Events.InteractionCreate, async interaction => {

    try {
        if (interaction.commandName === "spin") {
            return handleSpinCommand(interaction, client);
        } else {
            return handleMeetingCommand(interaction, client);
        }
    } catch (err) {
        console.error("Command error:", err);
        if (!interaction.replied) {
            interaction.reply({ content: "There was an error.", ephemeral: true });
        }
    }
});

client.login(token);


process.on('SIGINT', async () => {
    try {
        await botLog('🌙 Oreo retreats into the shadows. Judgment paused (SIGINT).');
    } catch (err) {
        console.error('Failed to log SIGINT shutdown:', err);
    }
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    try {
        await botLog('🌒 Oreo has been silenced. The hunt ends for now (SIGTERM).');
    } catch (err) {
        console.error('Failed to log SIGTERM shutdown:', err);
    }
    client.destroy();
    process.exit(0);
});

process.on('uncaughtException', async (err) => {
    console.error('Uncaught Exception:', err);
    try {
        await botLog(`Oreo has tripped on its own tail. Fatal error:\n\`\`\`${err.stack || err.message}\`\`\``);
    } catch (logErr) {
        console.error('Failed to log crash:', logErr);
    }
    client.destroy();
    process.exit(1);
});
