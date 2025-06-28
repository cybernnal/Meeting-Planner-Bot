const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder,
    AttachmentBuilder,
    StringSelectMenuBuilder
} = require("discord.js");

const dataStore = require("../../helpers/dataStore");
const { runQueue } = require("./queueHandler");
const { botLog } = require("../../helpers/logger");
const meetingManager = require("./meetingManager");
const { MEET_AUTHORIZED_ROLE_IDS } = require('../../constants');

const {
    DAYS,
    getDayButtons,
    getControlRow,
    getConfirmDaysRow,
    getFinalConfirmRow,
    getAvailabilityButtons,
    timeToMinutes,
    roundTimeString,
    generateAvailabilityHeatmapImage
} = require("./embedUtils");

dataStore.loadData();

const sessions = new Map();


async function handleMeetingCommand(interaction, client) {
    const userId = interaction.user.id;

    // /meet command: start a new meeting setup
    if (interaction.isChatInputCommand() && interaction.commandName === 'meet') {
        sessions.set(userId, {
            selectedDays: new Set(DAYS),
            ranges: []
        });
        const session = sessions.get(userId);
        session.owner = userId;
        session.channelId = interaction.channel.id;
        const embed = new EmbedBuilder()
            .setTitle('Select Days')
            .setDescription(`Selected Days: ${[...session.selectedDays].join(', ')}. Press Confirm Days to continue.`)
            .setColor(0x3498db);
        await interaction.reply({
            embeds: [embed],
            components: [...getDayButtons(new Set(DAYS)), getConfirmDaysRow()],
            flags: 64
        });
        await interaction.fetchReply();
        return;
    }

    // Toggle day selection button
    if (interaction.isButton() && interaction.customId.startsWith('toggle_')) {
        const day = interaction.customId.split('_')[1];
        const session = sessions.get(userId);
        if (!session) return;
        if (session.selectedDays.has(day)) {
            session.selectedDays.delete(day);
        } else {
            session.selectedDays.add(day);
        }
        const embed = new EmbedBuilder()
            .setTitle('Select Days')
            .setDescription(session.selectedDays.size > 0
                ? `Selected Days: ${[...session.selectedDays].join(', ')}`
                : 'No days selected! Please select at least one.')
            .setColor(session.selectedDays.size > 0 ? 0x3498db : 0xe74c3c);
        return interaction.update({
            embeds: [embed],
            components: [...getDayButtons(session.selectedDays), getConfirmDaysRow()]
        });
    }

    // Confirm selected days
    if (interaction.isButton() && interaction.customId === 'confirm_days') {
        const session = sessions.get(userId);
        if (!session || session.selectedDays.size === 0) {
            return interaction.reply({ content: 'Select at least one day.', flags: 64 });
        }
        const embed = new EmbedBuilder()
            .setTitle('Add Time Ranges')
            .setDescription(`Selected Days: ${[...session.selectedDays].join(', ')}`)
            .setColor(0x3498db);
        return interaction.update({
            embeds: [embed],
            components: [getControlRow(), getFinalConfirmRow()]
        });
    }

    // Add time range button
    if (interaction.isButton() && interaction.customId === 'add_range') {
        const session = sessions.get(userId);
        if (!session || session.selectedDays.size === 0) {
            return interaction.reply({ content: 'You must select at least one day before adding a range.', flags: 64 });
        }
        const modal = new ModalBuilder().setCustomId('add_modal').setTitle('Add Time Range');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('start').setLabel('Start Time (HH:MM)').setStyle(TextInputStyle.Short).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('end').setLabel('End Time (HH:MM)').setStyle(TextInputStyle.Short).setRequired(true)
            )
        );
        return interaction.showModal(modal);
    }

    // Final confirm button to set title/description
    if (interaction.isButton() && interaction.customId === 'final_confirm') {
        const session = sessions.get(userId);
        if (!session || session.selectedDays.size === 0 || session.ranges.length === 0) {
            return interaction.reply({ content: 'Select days and add at least one time range.', flags: 64 });
        }
        const modal = new ModalBuilder().setCustomId('final_modal').setTitle('Set Meeting Title/Description');
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('title').setLabel('Meeting Title').setStyle(TextInputStyle.Short).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('desc').setLabel('Meeting Description').setStyle(TextInputStyle.Paragraph).setRequired(true)
            )
        );
        return interaction.showModal(modal);
    }

    // Modal submit for adding time range
    if (interaction.isModalSubmit() && interaction.customId === 'add_modal') {
        const session = sessions.get(userId);
        if (!session || session.selectedDays.size === 0) return;
        const startRaw = interaction.fields.getTextInputValue('start');
        const endRaw = interaction.fields.getTextInputValue('end');
        const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!regex.test(startRaw) || !regex.test(endRaw)) {
            return interaction.reply({ content: 'Invalid time format. Use HH:MM (24h).', flags: 64 });
        }
        const start = roundTimeString(startRaw);
        const end = roundTimeString(endRaw);
        const s = timeToMinutes(start), e = timeToMinutes(end);
        if (e <= s) {
            return interaction.reply({ content: 'End must be after start.', flags: 64 });
        }
        for (const r of session.ranges) {
            const rs = timeToMinutes(r.start), re = timeToMinutes(r.end);
            if (s < re && e > rs) {
                return interaction.reply({ content: 'The time range overlaps with an existing range.', flags: 64 });
            }
        }
        session.ranges.push({ start, end });
        // Update embed with added ranges
        const rangeLines = session.ranges.map(r => `- ${r.start}–${r.end}`).join('\n');
        const embed = new EmbedBuilder()
            .setTitle('Add Time Ranges')
            .setDescription(`Selected Days: ${[...session.selectedDays].join(', ')}\nTime Ranges:\n${rangeLines}`)
            .setColor(0x3498db);
        return interaction.update({
            embeds: [embed],
            components: [getControlRow(), getFinalConfirmRow()]
        });
    }

    // Modal submission for final meeting creation
    if (interaction.isModalSubmit() && interaction.customId === 'final_modal') {
        const session = sessions.get(userId);
        if (!session) return;
        const embedTitle = interaction.fields.getTextInputValue('title');
        const embedDesc = interaction.fields.getTextInputValue('desc');
        const { selectedDays, ranges, owner, channelId } = session;
        const buffer = await generateAvailabilityHeatmapImage([...selectedDays], ranges, {});
        const attachment = new AttachmentBuilder(buffer, { name: 'heatmap.png' });
        const embed = new EmbedBuilder()
            .setTitle(embedTitle)
            .setDescription(embedDesc)
            .setImage('attachment://heatmap.png')
            .setColor(0x2ecc71);
        const msg = await client.channels.cache.get(channelId).send({
            embeds: [embed],
            files: [attachment],
            components: [...getAvailabilityButtons(), new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('show_top').setLabel('Top Ranges').setStyle(ButtonStyle.Secondary)
            )]
        });
        const record = {
            owner: owner,
            selectedDays: [...selectedDays],
            ranges,
            userAvailability: {},
            embedTitle,
            embedDesc,
            channelId: channelId
        };
        dataStore.addMeeting(msg.id, record);
        await interaction.deferUpdate();
        sessions.delete(userId);
        await botLog(`User <@${userId}> created meeting ${msg.id}`);
        return;
    }

    // Button to input availability for a day
    if (interaction.isButton() && interaction.customId.startsWith('avail_')) {
        const day = interaction.customId.split('_')[1];
        const msgId = interaction.message.id;
        const meeting = dataStore.getMeeting(msgId);
        if (!meeting) {
            return interaction.reply({ content: 'Meeting not found or data corrupted.', flags: 64 });
        }
        const modal = new ModalBuilder().setCustomId(`modal_${msgId}_${day}`).setTitle(`${day}`);
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('start').setLabel('Start Time (HH:MM)').setStyle(TextInputStyle.Short).setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId('end').setLabel('End Time (HH:MM)').setStyle(TextInputStyle.Short).setRequired(true)
            )
        );
        return interaction.showModal(modal);
    }

    // Modal submit for availability
    if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_')) {
        const parts = interaction.customId.split('_');
        const msgId = parts[1];
        const day = parts.slice(2).join('_');
        const meeting = dataStore.getMeeting(msgId);
        if (!meeting) {
            return interaction.reply({ content: 'Meeting not found or data corrupted.', flags: 64 });
        }
        const startRaw = interaction.fields.getTextInputValue('start');
        const endRaw = interaction.fields.getTextInputValue('end');
        const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!regex.test(startRaw) || !regex.test(endRaw)) {
            return interaction.reply({ content: 'Invalid time format. Use HH:MM (24h).', flags: 64 });
        }
        const start = roundTimeString(startRaw);
        const end = roundTimeString(endRaw);
        const s = timeToMinutes(start), e = timeToMinutes(end);
        if (e <= s) {
            return interaction.reply({ content: 'End must be after start.', flags: 64 });
        }
        await runQueue(msgId, async () => {
            meeting.userAvailability[userId] = meeting.userAvailability[userId] || {};
            if (!meeting.userAvailability[userId][day]) {
                meeting.userAvailability[userId][day] = [];
            }
            for (const [us, ue] of meeting.userAvailability[userId][day]) {
                const usMin = timeToMinutes(us), ueMin = timeToMinutes(ue);
                if (s < ueMin && e > usMin) {
                    return interaction.reply({ content: 'That range overlaps with one you already submitted.', flags: 64 });
                }
            }
            meeting.userAvailability[userId][day].push([start, end]);
            dataStore.updateMeeting(msgId, meeting);
            await interaction.deferUpdate();

            const buf = await generateAvailabilityHeatmapImage(
                meeting.selectedDays,
                meeting.ranges,
                meeting.userAvailability
            );
            const att = new AttachmentBuilder(buf, { name: 'heatmap.png' });
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setDescription(`Updated: ${new Date().toLocaleString('en-GB', { timeZoneName: 'short' })}`)
                .setImage('attachment://heatmap.png');
            await interaction.message.edit({
                embeds: [updatedEmbed],
                files: [att]
            });
            await botLog(`User <@${userId}> added availability for meeting ${msgId}`);
        });
        return;
    }

    // Show Top 4 populated ranges
    if (interaction.isButton() && interaction.customId === 'show_top') {
        return meetingManager.showTopRanges(interaction.message.id, interaction);
    }

    // /listmeetings command
    if (interaction.isChatInputCommand() && interaction.commandName === 'listmeetings') {
        const meetings = dataStore.getAllMeetings();
        const meetingIds = Object.keys(meetings);
        if (meetingIds.length === 0) {
            return interaction.reply({ content: 'No active meetings found.', flags: 64 });
        }
        const page = 1;
        const perPage = 10;
        const totalPages = Math.ceil(meetingIds.length / perPage);
        const pageIds = meetingIds.slice(0, perPage);
        const descLines = pageIds.map((mid, i) => {
            const rec = meetings[mid];
            const title = rec.embedTitle || `Meeting (${mid})`;
            return `**${i + 1}.** ${title} - Owner: <@${rec.owner}>`;
        });
        const embed = new EmbedBuilder()
            .setTitle(`Meetings (Page ${page}/${totalPages})`)
            .setDescription(descLines.join('\n'))
            .setColor(0x2ecc71);
        const select = new StringSelectMenuBuilder()
            .setCustomId('list_select_1')
            .setPlaceholder('Select a meeting to repost')
            .addOptions(pageIds.map(mid => {
                const rec = meetings[mid];
                return {
                    label: rec.embedTitle?.substring(0, 95) || `Meeting ${mid}`,
                    value: mid
                };
            }));
        const row1 = new ActionRowBuilder().addComponents(select);
        const rows = [row1];
        if (totalPages > 1) {
            const navRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('list_next_1').setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
            );
            rows.push(navRow);
        }
        return interaction.reply({
            embeds: [embed],
            components: rows,
            flags: 64
        });
    }

    // Pagination for /listmeetings
    if (interaction.isButton() && (interaction.customId.startsWith('list_prev_') || interaction.customId.startsWith('list_next_'))) {
        const parts = interaction.customId.split('_');
        const dir = parts[1];
        const pg = parseInt(parts[2]);
        const meetings = dataStore.getAllMeetings();
        const meetingIds = Object.keys(meetings);
        const perPage = 10;
        const totalPages = Math.ceil(meetingIds.length / perPage);
        const page = dir === 'prev' ? pg - 1 : pg + 1;
        const startIdx = (page - 1) * perPage;
        const pageIds = meetingIds.slice(startIdx, startIdx + perPage);
        const descLines = pageIds.map((mid, i) => {
            const rec = meetings[mid];
            const title = rec.embedTitle || `Meeting (${mid})`;
            return `**${startIdx + i + 1}.** ${title} - Owner: <@${rec.owner}>`;
        });
        const embed = new EmbedBuilder()
            .setTitle(`Meetings (Page ${page}/${totalPages})`)
            .setDescription(descLines.join('\n'))
            .setColor(0x2ecc71);
        const select = new StringSelectMenuBuilder()
            .setCustomId(`list_select_${page}`)
            .setPlaceholder('Select a meeting to repost')
            .addOptions(pageIds.map(mid => {
                const rec = meetings[mid];
                return {
                    label: rec.embedTitle?.substring(0, 95) || `Meeting ${mid}`,
                    value: mid
                };
            }));
        const selectRow = new ActionRowBuilder().addComponents(select);
        const navRow = new ActionRowBuilder();
        if (page > 1) {
            navRow.addComponents(
                new ButtonBuilder().setCustomId(`list_prev_${page}`).setLabel('⬅️ Previous').setStyle(ButtonStyle.Secondary)
            );
        }
        if (page < totalPages) {
            navRow.addComponents(
                new ButtonBuilder().setCustomId(`list_next_${page}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
            );
        }
        const rows2 = [selectRow];
        if (navRow.components.length > 0) rows2.push(navRow);
        return interaction.update({ embeds: [embed], components: rows2 });
    }

    // Repost a selected meeting
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('list_select_')) {
        const selectedId = interaction.values[0];
        const record = dataStore.getMeeting(selectedId);
        if (!record) {
            return interaction.reply({ content: 'Selected meeting not found.', flags: 64 });
        }
        await runQueue(selectedId, async () => {
            if (!dataStore.getMeeting(selectedId)) {
                return interaction.reply({ content: 'That meeting was already removed or finalized.', flags: 64 });
            }
            try {
                if (record.channelId) {
                    const channel = await client.channels.fetch(record.channelId);
                    const oldMsg = await channel.messages.fetch(selectedId);
                    await oldMsg.delete();
                }
            } catch (err) {
                console.warn('Failed to delete old meeting message:', err);
            }
            const buffer = await generateAvailabilityHeatmapImage(record.selectedDays, record.ranges, record.userAvailability);
            const attachment = new AttachmentBuilder(buffer, { name: 'heatmap.png' });
            const embed = new EmbedBuilder()
                .setTitle(record.embedTitle || 'Weekly Availability')
                .setDescription(record.embedDesc || `Reposted: ${new Date().toLocaleString('en-GB', { timeZoneName: 'short' })}`)
                .setImage('attachment://heatmap.png')
                .setColor(0x2ecc71);
            const newMsg = await interaction.channel.send({
                embeds: [embed],
                files: [attachment],
                components: [...getAvailabilityButtons(), new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('show_top').setLabel('Top Ranges').setStyle(ButtonStyle.Secondary)
                )]
            });
            record.channelId = interaction.channel.id;
            dataStore.addMeeting(newMsg.id, record);
            dataStore.deleteMeeting(selectedId);
            await interaction.deferUpdate();
            await botLog(`User <@${userId}> moved meeting ${selectedId} to ${newMsg.id}`);
        });
        return;
    }

    // /finishmeeting command
    if (interaction.isChatInputCommand() && interaction.commandName === 'finishmeeting') {
        const userRoles = interaction.member.roles.cache.map(r => r.id);
        const meetings = Object.entries(dataStore.getAllMeetings()).filter(([_, m]) =>
            m.owner === userId || userRoles.some(role => MEET_AUTHORIZED_ROLE_IDS.includes(role))
        );
        if (meetings.length === 0) {
            return interaction.reply({ content: 'You have no meetings you can finalize.', flags: 64 });
        }
        const page = 1;
        const perPage = 25;
        const totalPages = Math.ceil(meetings.length / perPage);
        const slice = meetings.slice(0, perPage);
        const options = slice.map(([id, m]) => ({
            label: m.embedTitle?.substring(0, 95) || `Meeting ${id}`,
            value: id
        }));
        const embed = new EmbedBuilder()
            .setTitle(`Finalize Meetings (Page ${page}/${totalPages})`)
            .setDescription(slice.map(([id, m], i) =>
                `**${i + 1}.** ${m.embedTitle || 'No title'} - Owner: <@${m.owner}>`).join('\n'))
            .setColor(0xE74C3C);
        const menu = new StringSelectMenuBuilder()
            .setCustomId(`finalize_menu_${page}`)
            .setPlaceholder('Select a meeting to finalize')
            .addOptions(options);
        const rows3 = [new ActionRowBuilder().addComponents(menu)];
        const nav = new ActionRowBuilder();
        if (totalPages > 1) {
            nav.addComponents(
                new ButtonBuilder().setCustomId(`finalize_next_${page}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
            );
            rows3.push(nav);
        }
        return interaction.reply({ embeds: [embed], components: rows3, flags: 64 });
    }

    // Pagination for finalize menu
    if (interaction.isButton() && (interaction.customId.startsWith('finalize_prev_') || interaction.customId.startsWith('finalize_next_'))) {
        const parts = interaction.customId.split('_');
        const dir = parts[1];
        const pg = parseInt(parts[2]);
        const userRoles = interaction.member.roles.cache.map(r => r.id);
        const meetings = Object.entries(dataStore.getAllMeetings()).filter(([_, m]) =>
            m.owner === userId || userRoles.some(role => MEET_AUTHORIZED_ROLE_IDS.includes(role))
        );
        const perPage = 25;
        const totalPages = Math.ceil(meetings.length / perPage);
        const page = dir === 'prev' ? pg - 1 : pg + 1;
        const startIdx = (page - 1) * perPage;
        const slice = meetings.slice(startIdx, startIdx + perPage);
        const options2 = slice.map(([id, m]) => ({
            label: m.embedTitle?.substring(0, 95) || `Meeting ${id}`,
            value: id
        }));
        const embed2 = new EmbedBuilder()
            .setTitle(`Finalize Meetings (Page ${page}/${totalPages})`)
            .setDescription(slice.map(([id, m], i) =>
                `**${startIdx + i + 1}.** ${m.embedTitle || 'No title'} - Owner: <@${m.owner}>`).join('\n'))
            .setColor(0xE74C3C);
        const menu2 = new StringSelectMenuBuilder()
            .setCustomId(`finalize_menu_${page}`)
            .setPlaceholder('Select a meeting to finalize')
            .addOptions(options2);
        const rows4 = [new ActionRowBuilder().addComponents(menu2)];
        const nav2 = new ActionRowBuilder();
        if (page > 1) {
            nav2.addComponents(
                new ButtonBuilder().setCustomId(`finalize_prev_${page}`).setLabel('⬅️ Prev').setStyle(ButtonStyle.Secondary)
            );
        }
        if (page < totalPages) {
            nav2.addComponents(
                new ButtonBuilder().setCustomId(`finalize_next_${page}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
            );
        }
        if (nav2.components.length) rows4.push(nav2);
        return interaction.update({ embeds: [embed2], components: rows4 });
    }

    // Finalize selected meeting
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('finalize_menu_')) {
        const meetingId = interaction.values[0];
        await meetingManager.finalizeMeeting(meetingId, interaction);
        return meetingManager.showTopRanges(meetingId, interaction);
    }
}

module.exports = handleMeetingCommand;