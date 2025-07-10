const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { botLog } = require('../../helpers/logger');
const { generateReactionImage } = require('../../helpers/reactionImageGenerator');
const emojiData = require('unicode-emoji-json');

async function handleGetReactionsCommand(interaction) {
    if (!interaction.isChatInputCommand() || interaction.commandName !== 'get_reactions') return;

    const messageId = interaction.options.getString('message_id');
    const channelId = interaction.options.getString('channel_id');

    try {
        await interaction.deferReply({ ephemeral: true });

        let targetChannel;
        if (channelId) {
            targetChannel = await interaction.client.channels.fetch(channelId);
            if (!targetChannel || !targetChannel.isTextBased()) {
                await interaction.editReply({ content: 'Invalid channel ID provided.', ephemeral: true });
                return;
            }
        } else {
            targetChannel = interaction.channel;
        }

        // Permission Check
        const me = interaction.guild.members.cache.get(interaction.client.user.id);
        const permissionsInChannel = targetChannel.permissionsFor(me);

        if (!permissionsInChannel.has('ViewChannel')) {
            await interaction.editReply({ content: `I don't have permission to view the channel <#${targetChannel.id}>. Please grant me 'View Channel' permission.`, ephemeral: true });
            return;
        }
        if (!permissionsInChannel.has('ReadMessageHistory')) {
            await interaction.editReply({ content: `I don't have permission to read message history in <#${targetChannel.id}>. Please grant me 'Read Message History' permission.`, ephemeral: true });
            return;
        }
        if (!permissionsInChannel.has('AttachFiles')) {
            await interaction.editReply({ content: `I don't have permission to attach files in <#${targetChannel.id}>. Please grant me 'Attach Files' permission.`, ephemeral: true });
            return;
        }

        const message = await targetChannel.messages.fetch(messageId);
        const reactions = message.reactions.cache;

        if (reactions.size === 0) {
            return interaction.reply({ content: 'No reactions found on this message.', ephemeral: true });
        }

        const reactedUsers = new Map(); // Map to store users who reacted
        const predefinedEmojis = require('../../helpers/dataStore').getEmojis();

        for (const reaction of reactions.values()) {
            const users = await reaction.users.fetch();
            let emojiName;
            if (reaction.emoji.id) { // Custom emoji
                emojiName = reaction.emoji.name;
            } else { // Unicode emoji
                const unicodeChar = reaction.emoji.name;
                const emojiInfo = Object.values(emojiData).find(e => e.emoji === unicodeChar);
                emojiName = emojiInfo ? emojiInfo.name.replace(/_/g, ' ') : unicodeChar; // Replace underscores with spaces
            }

            for (const user of users.values()) {
                if (!user.bot) { // Ignore bot's own reactions
                    if (!reactedUsers.has(user.id)) {
                        reactedUsers.set(user.id, { user: user, emojis: new Set() });
                    }
                    reactedUsers.get(user.id).emojis.add(emojiName);
                }
            }
        }

        // Get all unique emojis reacted to the message, using their names
        const allEmojis = Array.from(new Set(Array.from(reactions.values()).map(r => {
            if (r.emoji.id) {
                return r.emoji.name;
            } else {
                const unicodeChar = r.emoji.name;
                const emojiInfo = Object.values(emojiData).find(e => e.emoji === unicodeChar);
                return emojiInfo ? emojiInfo.name.replace(/_/g, ' ') : unicodeChar;
            }
        })));

        const imageBuffer = await generateReactionImage({ allEmojis, reactedUsers });
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'reactions.png' });

        await interaction.editReply({ files: [attachment], ephemeral: true });
        botLog(`Successfully generated reaction image for message ID: ${messageId}`, targetChannel.id, messageId);

    } catch (error) {
        botLog(`Error generating reaction image for message ID: ${messageId}. Error: ${error.message}`, targetChannel ? targetChannel.id : null, messageId);
        console.error('Error fetching message reactions:', error);
        await interaction.editReply({ content: 'Could not find the message or fetch its reactions. Please ensure the ID is correct and I have permission to view the message and its reactions.', ephemeral: true });
    }
}

module.exports = handleGetReactionsCommand;