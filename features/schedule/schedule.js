const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { parseAndValidateDateTime } = require('../../helpers/dateUtils');
const dataStore = require('../../helpers/dataStore');

const rolesToPing = [
    { label: 'Role 1', value: '1381080365502042202' },
    { label: 'Role 2', value: 'ROLE_ID_2' },
];

const scheduleState = new Map();



async function handleScheduleCommand(interaction, client) {
    const emojis = dataStore.getEmojis();

    if (interaction.isChatInputCommand() && (interaction.commandName === 'schedule' || interaction.commandName === 'schedule_test')) {
        
        const modal = new ModalBuilder()
            .setCustomId('scheduleModal')
            .setTitle('Schedule an Event');

        const today = new Date();
        const dateInput = new TextInputBuilder()
            .setCustomId('dateInput')
            .setLabel('Date (DD/MM or DD/MM/YY)')
            .setStyle(TextInputStyle.Short)
            .setValue(interaction.commandName === 'schedule_test' ? `${today.getDate()}/${today.getMonth() + 1}` : '');

        const timeInput = new TextInputBuilder()
            .setCustomId('timeInput')
            .setLabel('Time (HH:MM)')
            .setStyle(TextInputStyle.Short)
            .setValue(interaction.commandName === 'schedule_test' ? '22:30' : '');

        const messageInput = new TextInputBuilder()
            .setCustomId('messageInput')
            .setLabel('Special Message')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(interaction.commandName === 'schedule_test' ? 'This is a test message.' : '');

        const firstActionRow = new ActionRowBuilder().addComponents(dateInput);
        const secondActionRow = new ActionRowBuilder().addComponents(timeInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(messageInput);

        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

        await interaction.showModal(modal);
    } else if (interaction.isModalSubmit() && interaction.customId === 'scheduleModal') {
        
        const dateString = interaction.fields.getTextInputValue('dateInput');
        const time = interaction.fields.getTextInputValue('timeInput');
        const message = interaction.fields.getTextInputValue('messageInput');

        const dateTimeResult = parseAndValidateDateTime(dateString, time);

        if (dateTimeResult.error) {
            return interaction.reply({ content: dateTimeResult.error, ephemeral: true });
        }

        const { date, timestamp, day, month, year } = dateTimeResult;

        const embed = new EmbedBuilder()
            .setTitle('Event Scheduled')
            .setColor('Green')
            .setDescription(`The event is scheduled for <t:${timestamp}:F>\n\n${message}`)
            .setTimestamp();

        const roleButtons = rolesToPing.map(role =>
            new ButtonBuilder()
                .setCustomId(`schedule_toggle_${role.value}`)
                .setLabel(role.label)
                .setStyle(ButtonStyle.Primary)
        );

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_schedule')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(...roleButtons, confirmButton);

        await interaction.deferReply({ ephemeral: true });
        const reply = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });
        scheduleState.set(interaction.user.id, { messageId: reply.id, selectedRoles: [], originalMessage: message, timestamp, selectedEmojis: [], day: day, month: month, year: year, time: time });
        

    } else if (interaction.isButton()) {
        const { customId } = interaction;
        
        let state = scheduleState.get(interaction.user.id);
        

        if (!state) {

            return;
        }

        if (customId.startsWith('schedule_toggle_')) {
            const roleId = customId.substring(customId.indexOf('schedule_toggle_') + 'schedule_toggle_'.length);

            if (state.selectedRoles.includes(roleId)) {
                state.selectedRoles = state.selectedRoles.filter(r => r !== roleId);
            } else {
                state.selectedRoles.push(roleId);
            }

            // Update the map with the modified state
            scheduleState.set(interaction.user.id, state);
            

            const newEmbed = new EmbedBuilder(interaction.message.embeds[0]);
            if (state.selectedRoles.length > 0) {
                if (newEmbed.data.fields?.find(f => f.name === 'Selected Roles')) {
                    newEmbed.data.fields.find(f => f.name === 'Selected Roles').value = state.selectedRoles.map(r => `<@&${r}>`).join(', ');
                } else {
                    newEmbed.addFields({ name: 'Selected Roles', value: state.selectedRoles.map(r => `<@&${r}>`).join(', ') });
                }
            } else {
                newEmbed.data.fields = newEmbed.data.fields?.filter(f => f.name !== 'Selected Roles');
            }

            const updatedRoleButtons = rolesToPing.map(role =>
                new ButtonBuilder()
                    .setCustomId(`schedule_toggle_${role.value}`)
                    .setLabel(role.label)
                    .setStyle(state.selectedRoles.includes(role.value) ? ButtonStyle.Success : ButtonStyle.Primary)
            );

            const updatedConfirmButton = new ButtonBuilder()
                .setCustomId('confirm_schedule')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success);

            const updatedRow = new ActionRowBuilder().addComponents(...updatedRoleButtons, updatedConfirmButton);

            await interaction.update({ embeds: [newEmbed], components: [updatedRow] });

        } else if (customId === 'confirm_schedule') {
            
            const { selectedRoles, originalMessage, timestamp } = state;

            const newEmbed = new EmbedBuilder(interaction.message.embeds[0]);
            newEmbed.setDescription(`Select emojis for the event:\n<t:${timestamp}:F>\n\n${originalMessage}`);

            const emojiButtons = emojis.map(emoji =>
                new ButtonBuilder()
                    .setCustomId(`schedule_emoji_toggle_${emoji.name}`)
                    .setLabel(`${emoji.name} ${emoji.emoji}`)
                    .setStyle(ButtonStyle.Primary)
            );

            const finalConfirmButton = new ButtonBuilder()
                .setCustomId('schedule_final_confirm')
                .setLabel('Final Confirm')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(...emojiButtons, finalConfirmButton);

            await interaction.update({ embeds: [newEmbed], components: [row] });

        } else if (customId.startsWith('schedule_emoji_toggle_')) {
            const emojiName = customId.substring(customId.indexOf('schedule_emoji_toggle_') + 'schedule_emoji_toggle_'.length);
            let state = scheduleState.get(interaction.user.id);

            if (!state) {
    
                return;
            }

            if (state.selectedEmojis.includes(emojiName)) {
                state.selectedEmojis = state.selectedEmojis.filter(e => e !== emojiName);
                
            } else {
                state.selectedEmojis.push(emojiName);
                
            }

            scheduleState.set(interaction.user.id, state);
            

            const newEmbed = new EmbedBuilder(interaction.message.embeds[0]);            let emojiDescription = state.selectedEmojis.map(e => { const foundEmoji = emojis.find(em => em.name === e); return foundEmoji ? `${foundEmoji.name} ${foundEmoji.emoji}` : ''; }).join('\n');
            const existingEmojiField = newEmbed.data.fields?.find(f => f.name === 'Selected Emojis');
            if (emojiDescription) {
                if (existingEmojiField) {
                    existingEmojiField.value = emojiDescription;
                } else {
                    newEmbed.addFields({ name: 'Selected Emojis', value: emojiDescription });
                }
            } else {
                newEmbed.data.fields = newEmbed.data.fields?.filter(f => f.name !== 'Selected Emojis');
            }

            const updatedEmojiButtons = emojis.map(emoji =>
                new ButtonBuilder()
                    .setCustomId(`schedule_emoji_toggle_${emoji.name}`)
                    .setLabel(`${emoji.name} ${emoji.emoji}`)
                    .setStyle(state.selectedEmojis.includes(emoji.name) ? ButtonStyle.Success : ButtonStyle.Primary)
            );

            const updatedFinalConfirmButton = new ButtonBuilder()
                .setCustomId('schedule_final_confirm')
                .setLabel('Final Confirm')
                .setStyle(ButtonStyle.Success);

            const updatedRow = new ActionRowBuilder().addComponents(...updatedEmojiButtons, updatedFinalConfirmButton);

            await interaction.update({ embeds: [newEmbed], components: [updatedRow] });

        } else if (customId === 'schedule_final_confirm') {
            
            const { selectedRoles, originalMessage, timestamp, selectedEmojis, day, month, year, time } = state;
            const rolePings = selectedRoles.map(r => `<@&${r}>`).join(' ');
            const emojiList = selectedEmojis.map(e => { 
                const foundEmoji = emojis.find(em => em.name === e); 
                return foundEmoji ? `${foundEmoji.name} ${foundEmoji.emoji}` : ''; 
            }).join('\n');

            const publicEmbed = new EmbedBuilder()
                .setColor('Green')
                .setDescription(`${rolePings}\n<t:${timestamp}:F>\n\n${originalMessage}\n\n${emojiList}`)
                .setTimestamp();

            const sentMessage = await interaction.channel.send({ embeds: [publicEmbed] });

            // Save the scheduled event to data.json
            dataStore.saveScheduledEvent({
                messageId: sentMessage.id,
                timestamp: timestamp,
                date: `${parseInt(day, 10)}/${parseInt(month, 10)}/${parseInt(year, 10)}`,
                time: time,
                originalMessage: originalMessage,
                selectedRoles: selectedRoles,
                selectedEmojis: selectedEmojis,
            });

            for (const emojiName of selectedEmojis) {
                const emoji = emojis.find(em => em.name === emojiName)?.emoji;
                if (emoji) {
                    await sentMessage.react(emoji);
                }
            }

            await interaction.update({ content: 'Event confirmed!', embeds: [], components: [] });
            scheduleState.delete(interaction.user.id);
            
        }
    }
}

module.exports = handleScheduleCommand;