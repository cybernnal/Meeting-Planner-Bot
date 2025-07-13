const { Client, GatewayIntentBits, Events, Collection, EmbedBuilder, AttachmentBuilder } = require("discord.js");
const path = require("path");
const fs = require("fs");

const { token } = require("./config.json");
const { init: initLogger, botLog } = require("./helpers/logger");
const handleMeetingCommand = require("./features/meetings/meet");
const { generateAvailabilityHeatmapImage } = require("./features/meetings/embedUtils");
const handleSpinCommand = require("./features/spin/spinn");
const handleScheduleCommand = require("./features/schedule/schedule.js");
const handleGetReactionsCommand = require("./features/reactions/get_reactions.js");
const dataStore = require("./helpers/dataStore");
const { generateReactionImage } = require("./helpers/reactionImageGenerator");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,       // Required for basic guild info and slash commands
        GatewayIntentBits.GuildMembers, // Required to fetch members for roles and spin command
        GatewayIntentBits.MessageContent, // Required to read message content for filtering
        GatewayIntentBits.GuildMessageReactions, // Required to receive reaction events
    ],
});

// Command Handler
client.commands = new Collection();
const commandHandlers = {
    'spin': handleSpinCommand,
    'meet': handleMeetingCommand,
    'listmeetings': handleMeetingCommand,
    'finishmeeting': handleMeetingCommand,
    'schedule': handleScheduleCommand,
    'schedule_test': handleScheduleCommand,
    'test_schedule': async (interaction) => {
        const embed = new EmbedBuilder()
            .setColor('Green')
            .setDescription(`Test Event\n<t:${Math.floor(Date.now() / 1000)}:F>\n\nThis is a test message.`)
            .setTimestamp();

        const emojis = dataStore.getEmojis();
        const selectedEmojis = ['thumbsup', 'rocket', '6819644']; // Pre-selected emojis for testing

        const publicEmbed = new EmbedBuilder()
            .setColor('Green')
            .setDescription(`\n<t:${Math.floor(Date.now() / 1000)}:F>\n\nThis is a test message.\n\n${selectedEmojis.map(e => emojis.find(em => em.name === e)?.emoji || '').join('\n')}`)
            .setTimestamp();

        const sentMessage = await interaction.channel.send({ embeds: [publicEmbed] });

        for (const emojiName of selectedEmojis) {
            const emoji = emojis.find(em => em.name === emojiName)?.emoji;
            if (emoji) {
                await sentMessage.react(emoji);
            }
        }

        // Save the scheduled event to data.json for testing reaction removal
        dataStore.saveScheduledEvent({
            messageId: sentMessage.id,
            timestamp: Math.floor(Date.now() / 1000),
            date: `${new Date().getDate()}/${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
            time: `${new Date().getHours()}:${new Date().getMinutes()}`,
            originalMessage: 'This is a test message.',
            selectedRoles: [],
            selectedEmojis: selectedEmojis,
        });

        await interaction.reply({ content: 'Test schedule message posted!', ephemeral: true });
    },
    'get_reactions': handleGetReactionsCommand,
    'shutdown': async (interaction) => {
        await interaction.reply({ content: 'Shutting down...', ephemeral: true });
        await botLog('Oreo is being shut down by an admin.');
        client.destroy();
        process.exit(0);
    },
};

for (const [commandName, handler] of Object.entries(commandHandlers)) {
    client.commands.set(commandName, handler);
}

initLogger(client);

client.once(Events.ClientReady, async () => {
    botLog("Oreo has awakened. The judgment shall now commence.");

    
});


client.on(Events.InteractionCreate, async interaction => {
    let handler;

    if (interaction.isChatInputCommand()) {
        handler = client.commands.get(interaction.commandName);
    } else if (interaction.isButton() || interaction.isModalSubmit() || interaction.isStringSelectMenu()) {
        // Route all component interactions for meetings to the meeting handler
        if (interaction.customId.includes('meet') ||
            interaction.customId.startsWith('toggle_') ||
            interaction.customId.startsWith('avail_') ||
            interaction.customId.startsWith('modal_') ||
            interaction.customId.startsWith('list_') ||
            interaction.customId.startsWith('finalize_') ||
            ['confirm_days', 'add_range', 'final_confirm', 'show_top', 'add_modal', 'final_modal', 'remove_availability'].includes(interaction.customId) ||
            interaction.customId.startsWith('remove_avail_')) {
            handler = handleMeetingCommand;
        } else if (interaction.customId === 'scheduleModal' || interaction.customId.startsWith('schedule_toggle_') || interaction.customId === 'confirm_schedule' || interaction.customId.startsWith('schedule_emoji_toggle_') || interaction.customId === 'schedule_final_confirm') {
            handler = handleScheduleCommand;
        }
        // Add other component handlers here if needed (e.g., for spin)
    }

    if (!handler) {
        return;
    }

    try {
        await handler(interaction, client);
    } catch (err) {
        console.error("Interaction handler error:", err);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this interaction!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this interaction!', ephemeral: true });
        }
    }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    // Ignore reactions from the bot itself
    if (user.id === client.user.id) return;

    // When a reaction is received, check if the structure is partial
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }

    // Check if the message is a scheduled event
    console.log('Checking for scheduled event for message ID:', reaction.message.id);
    const scheduledEvent = dataStore.getScheduledEventByMessageId(reaction.message.id);
    console.log('Scheduled event found:', scheduledEvent);

    if (scheduledEvent) {
        const emojis = dataStore.getEmojis();
        console.log('dataStore.getEmojis():', emojis);
        const allowedEmojiNames = scheduledEvent.selectedEmojis;
        console.log('scheduledEvent.selectedEmojis:', allowedEmojiNames);

        let reactedEmojiName;
        if (reaction.emoji.id) { // Custom emoji
            reactedEmojiName = reaction.emoji.name; // Custom emojis use their name
        } else { // Unicode emoji
            // Find the name of the unicode emoji from our predefined list
            const foundEmoji = emojis.find(e => e.emoji === reaction.emoji.name);
            reactedEmojiName = foundEmoji ? foundEmoji.name : null; // Use name if found, else null
        }
        console.log('reactedEmojiName:', reactedEmojiName);
        console.log('reaction.emoji.name (raw):', reaction.emoji.name);
        console.log('reaction.emoji.id (raw):', reaction.emoji.id);

        if (reactedEmojiName === null || !allowedEmojiNames.includes(reactedEmojiName)) {
            console.log(`Comparison result: REMOVING reaction`);
            console.log(`Removing unwanted reaction: ${reactedEmojiName} from message ${reaction.message.id} by user ${user.tag}`);
            try {
                await reaction.remove();
            } catch (error) {
                console.error('Failed to remove reaction:', error);
            }
        } else {
            console.log(`Comparison result: KEEPING reaction`);
            console.log(`Keeping allowed reaction: ${reactedEmojiName} on message ${reaction.message.id} by user ${user.tag}`);
            dataStore.addReaction(reaction.message.id, reactedEmojiName, user.id);
        }
    }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    // Ignore reactions from the bot itself
    if (user.id === client.user.id) return;

    // When a reaction is received, check if the structure is partial
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message:', error);
            return;
        }
    }

    // Check if the message is a scheduled event
    console.log('Checking for scheduled event for message ID:', reaction.message.id);
    const scheduledEvent = dataStore.getScheduledEventByMessageId(reaction.message.id);
    console.log('Scheduled event found:', scheduledEvent);

    if (scheduledEvent) {
        let reactedEmojiName;
        if (reaction.emoji.id) { // Custom emoji
            reactedEmojiName = reaction.emoji.name;
        } else { // Unicode emoji
            const emojis = dataStore.getEmojis();
            const foundEmoji = emojis.find(e => e.emoji === reaction.emoji.name);
            reactedEmojiName = foundEmoji ? foundEmoji.name : null;
        }
        dataStore.removeReaction(reaction.message.id, reactedEmojiName, user.id);
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