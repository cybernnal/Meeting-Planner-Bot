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
const { MEET_AUTHORIZED_ROLE_IDS } = require('../../constants');
const meetingManager = require('./meetingManager');

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const {
    getDayButtons,
    getControlRow,
    getConfirmDaysRow,
    getFinalConfirmRow,
    getAvailabilityButtons,
    generateAvailabilityHeatmapImage,
    timeToMinutes,
    roundTimeString,
    createDaySelectionEmbed,
    createTimeRangeEmbed,
    createRemoveAvailabilityView,
    getTimeRangeSelectMenu
} = require("./embedUtils");

const { getMeeting, createMeeting, endMeeting, clearMeetings, setMeetingInterval, getMeetingByChannel, validateAndProcessTimeInput, getPaginationComponents } = require("../../helpers/meetingHelpers");

const sessions = new Map();
const availabilitySessions = new Map();

async function handleMeetCommand(interaction) {
    const userId = interaction.user.id;
    sessions.set(userId, {
        selectedDays: new Set(DAYS),
        ranges: [],
        selectedRangeIndex: -1
    });
    const session = sessions.get(userId);
    session.owner = userId;
    session.channelId = interaction.channel.id;
    const embed = createDaySelectionEmbed(session.selectedDays, true);
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({
        embeds: [embed],
        components: [...getDayButtons(session.selectedDays), getConfirmDaysRow()],
    });
}

async function handleDayToggleButton(interaction) {
    const userId = interaction.user.id;
    const day = interaction.customId.split('_')[1];
    const session = sessions.get(userId);
    if (!session) return;
    if (session.selectedDays.has(day)) {
        session.selectedDays.delete(day);
    } else {
        session.selectedDays.add(day);
    }
    const embed = createDaySelectionEmbed(session.selectedDays, session.selectedDays.size > 0);
    return interaction.update({
        embeds: [embed],
        components: [...getDayButtons(session.selectedDays), getConfirmDaysRow()]
    });
}

async function handleConfirmDaysButton(interaction) {
    const userId = interaction.user.id;
    const session = sessions.get(userId);
    if (!session || session.selectedDays.size === 0) {
        return interaction.followUp({ content: 'Select at least one day.', ephemeral: true });
    }
    const embed = createTimeRangeEmbed(session.selectedDays, session.ranges, session.selectedRangeIndex);
    const components = [getControlRow(session.ranges, session.selectedRangeIndex), getFinalConfirmRow()];
    components.unshift(getTimeRangeSelectMenu(session.ranges, session.selectedRangeIndex));
    return interaction.update({
        embeds: [embed],
        components: components
    });
}

async function handleAddRangeButton(interaction) {
    const userId = interaction.user.id;
    const session = sessions.get(userId);
    if (!session || session.selectedDays.size === 0) {
        return interaction.followUp({ content: 'You must select at least one day before adding a range.', ephemeral: true });
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

async function handleFinalConfirmButton(interaction) {
    const userId = interaction.user.id;
    const session = sessions.get(userId);
    if (!session || session.selectedDays.size === 0 || session.ranges.length === 0) {
        return interaction.followUp({ content: 'Select days and add at least one time range.', ephemeral: true });
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

async function handleAddModalSubmit(interaction) {
    await interaction.deferUpdate();
    const userId = interaction.user.id;
    const session = sessions.get(userId);
    if (!session || session.selectedDays.size === 0) return;
    const startRaw = interaction.fields.getTextInputValue('start');
    const endRaw = interaction.fields.getTextInputValue('end');

    const processedTimes = await validateAndProcessTimeInput(interaction, startRaw, endRaw, session.ranges);
    if (!processedTimes) return;
    const { start, end, s, e } = processedTimes;

    session.ranges.push([start, end]);
    session.selectedRangeIndex = -1;
    const embed = createTimeRangeEmbed(session.selectedDays, session.ranges, session.selectedRangeIndex);
    const components = [getControlRow(session.ranges, session.selectedRangeIndex), getFinalConfirmRow()];
    components.unshift(getTimeRangeSelectMenu(session.ranges, session.selectedRangeIndex));
    await interaction.editReply({
        embeds: [embed],
        components: components
    });
}

async function handleTimeRangeSelect(interaction) {
    const userId = interaction.user.id;
    const session = sessions.get(userId);
    if (!session) return;

    const selectedIndex = parseInt(interaction.values[0]);
    session.selectedRangeIndex = selectedIndex;

    const embed = createTimeRangeEmbed(session.selectedDays, session.ranges, session.selectedRangeIndex);
    const components = [getControlRow(session.ranges, session.selectedRangeIndex), getFinalConfirmRow()];
    if (session.ranges.length > 0) {
        components.unshift(getTimeRangeSelectMenu(session.ranges, session.selectedRangeIndex));
    }
    await interaction.update({
        embeds: [embed],
        components: components
    });
}

async function handleDeleteRangeButton(interaction) {
    await interaction.deferUpdate();
    const userId = interaction.user.id;
    const session = sessions.get(userId);
    if (!session || session.selectedRangeIndex === -1) {
        return interaction.followUp({ content: 'No range selected to delete.', ephemeral: true });
    }

    session.ranges.splice(session.selectedRangeIndex, 1);
    session.selectedRangeIndex = -1;

    const embed = createTimeRangeEmbed(session.selectedDays, session.ranges, session.selectedRangeIndex);
    const components = [getControlRow(session.ranges, session.selectedRangeIndex), getFinalConfirmRow()];
    components.unshift(getTimeRangeSelectMenu(session.ranges, session.selectedRangeIndex));
    try {
        await interaction.editReply({
            embeds: [embed],
            components: components
        });
    } catch (error) {
        console.error("Failed to edit reply in handleDeleteRangeButton:", error);
        await interaction.followUp({ content: "An error occurred while deleting the range.", ephemeral: true });
    }
}

async function handleFinalModalSubmit(interaction, client) {
    await interaction.deferUpdate();
    const userId = interaction.user.id;
    const session = sessions.get(userId);
    if (!session) return;

    const embedTitle = interaction.fields.getTextInputValue('title');
    const embedDesc = interaction.fields.getTextInputValue('desc');
    const { selectedDays, ranges, owner, channelId } = session;

    const buffer = await generateAvailabilityHeatmapImage([...selectedDays], ranges, {}, interaction.guild);
    const attachment = new AttachmentBuilder(buffer, { name: 'heatmap.png' });

    const embed = new EmbedBuilder()
        .setTitle(embedTitle)
        .setDescription(embedDesc)
        .setImage('attachment://heatmap.png')
        .setColor(0x2ecc71);

    const msg = await client.channels.cache.get(channelId).send({
        embeds: [embed],
        files: [attachment],
        components: [...getAvailabilityButtons(selectedDays)]
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
    sessions.delete(userId);
}

async function handleAvailabilityButton(interaction) {
    const day = interaction.customId.split('_')[1];
    const msgId = interaction.message.id;
    const meeting = dataStore.getMeeting(msgId);
    if (!meeting) {
        return interaction.followUp({ content: 'Meeting not found or data corrupted.', ephemeral: true });
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

async function handleAvailabilityModalSubmit(interaction) {
    await interaction.deferUpdate();
    const userId = interaction.user.id;
    const parts = interaction.customId.split('_');
    const msgId = parts[1];
    const day = parts.slice(2).join('_');
    const meeting = dataStore.getMeeting(msgId);
    if (!meeting) {
        return interaction.followUp({ content: 'Meeting not found or data corrupted.', ephemeral: true });
    }
    const startRaw = interaction.fields.getTextInputValue('start');
    const endRaw = interaction.fields.getTextInputValue('end');

    const processedTimes = await validateAndProcessTimeInput(interaction, startRaw, endRaw, meeting.userAvailability[userId]?.[day] || [], 0);
    if (!processedTimes) return;
    const { start, end, s, e } = processedTimes;

    await runQueue(msgId, async () => {
        meeting.userAvailability[userId] = meeting.userAvailability[userId] || {};
        if (!meeting.userAvailability[userId][day]) {
            meeting.userAvailability[userId][day] = [];
        }
        
        meeting.userAvailability[userId][day].push([start, end]);
        dataStore.updateMeeting(msgId, meeting);

        const buf = await generateAvailabilityHeatmapImage(
            meeting.selectedDays,
            meeting.ranges,
            meeting.userAvailability,
            interaction.guild
        );
        const att = new AttachmentBuilder(buf, { name: 'heatmap.png' });
        const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setDescription(`Updated: ${new Date().toLocaleString('en-GB', { timeZoneName: 'short' })}`)
            .setImage('attachment://heatmap.png');
        await interaction.message.edit({
            embeds: [updatedEmbed],
            files: [att]
        });
        await botLog(`User <@${userId}> added availability for meeting `, interaction.channelId ,msgId);
    });
}

async function handleListMeetingsCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const meetings = dataStore.getAllMeetings();
    const meetingIds = Object.keys(meetings);
    if (meetingIds.length === 0) {
        return interaction.editReply({ content: 'No active meetings found.' });
    }
    const { embeds, components } = getPaginationComponents(
        Object.entries(meetings),
        1,
        10,
        'list',
        'Meetings',
        'Select a meeting to repost'
    );
    return interaction.editReply({ embeds, components });
}

async function handleListMeetingsPagination(interaction) {
    const parts = interaction.customId.split('_');
    const dir = parts[1];
    const pg = parseInt(parts[2]);
    const meetings = dataStore.getAllMeetings();
    const currentPage = dir === 'prev' ? pg - 1 : pg + 1;
    const { embeds, components } = getPaginationComponents(
        Object.entries(meetings),
        currentPage,
        10,
        'list',
        'Meetings',
        'Select a meeting to repost'
    );
    return interaction.update({ embeds, components });
}

async function handleListMeetingsSelect(interaction, client) {
    const userId = interaction.user.id;
    const selectedId = interaction.values[0];
    const record = dataStore.getMeeting(selectedId);
    if (!record) {
        return interaction.followUp({ content: 'Selected meeting not found.', ephemeral: true });
    }
    await runQueue(selectedId, async () => {
        if (!dataStore.getMeeting(selectedId)) {
            return interaction.followUp({ content: 'That meeting was already removed or finalized.', ephemeral: true });
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
        const buffer = await generateAvailabilityHeatmapImage(record.selectedDays, record.ranges, record.userAvailability, interaction.guild);
        const attachment = new AttachmentBuilder(buffer, { name: 'heatmap.png' });
        const embed = new EmbedBuilder()
            .setTitle(record.embedTitle || 'Weekly Availability')
            .setDescription(record.embedDesc || `Reposted: ${new Date().toLocaleString('en-GB', { timeZoneName: 'short' })}`)
            .setImage('attachment://heatmap.png')
            .setColor(0x2ecc71);
        const newMsg = await interaction.channel.send({
            embeds: [embed],
            files: [attachment],
            components: [...getAvailabilityButtons(record.selectedDays)]
        });
        record.channelId = interaction.channel.id;
        dataStore.addMeeting(newMsg.id, record);
        dataStore.deleteMeeting(selectedId);
        await interaction.deferUpdate();
        await botLog(`User <@${userId}> moved meeting ${selectedId} to ${newMsg.id}`);
    });
}

async function handleFinishMeetingCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const userId = interaction.user.id;
    const userRoles = interaction.member.roles.cache.map(r => r.id);
    const meetings = Object.entries(dataStore.getAllMeetings()).filter(([_, m]) =>
        m.owner === userId || userRoles.some(role => MEET_AUTHORIZED_ROLE_IDS.includes(role))
    );
    if (meetings.length === 0) {
        return interaction.editReply({ content: 'You have no meetings you can finalize.' });
    }
    const { embeds, components } = getPaginationComponents(
        meetings,
        1,
        25,
        'finalize',
        'Finalize Meetings',
        'Select a meeting to finalize',
        true
    );
    return interaction.editReply({ embeds, components });
}

async function handleFinishMeetingPagination(interaction) {
    const userId = interaction.user.id;
    const parts = interaction.customId.split('_');
    const dir = parts[1];
    const pg = parseInt(parts[2]);
    const userRoles = interaction.member.roles.cache.map(r => r.id);
    const meetings = Object.entries(dataStore.getAllMeetings()).filter(([_, m]) =>
        m.owner === userId || userRoles.some(role => MEET_AUTHORIZED_ROLE_IDS.includes(role))
    );
    const currentPage = dir === 'prev' ? pg - 1 : pg + 1;
    const { embeds, components } = getPaginationComponents(
        meetings,
        currentPage,
        25,
        'finalize',
        'Finalize Meetings',
        'Select a meeting to finalize',
        true
    );
    return interaction.update({ embeds, components });
}

async function handleFinishMeetingSelect(interaction) {
    const meetingId = interaction.values[0];
    return meetingManager.finalizeMeeting(meetingId, interaction);
}

async function handleRemoveAvailabilityButton(interaction) {
    const userId = interaction.user.id;
    const msgId = interaction.message.id;
    const meeting = dataStore.getMeeting(msgId);

    if (!meeting || !meeting.userAvailability[userId]) {
        return interaction.reply({ content: "You have no availability to remove.", ephemeral: true });
    }

    availabilitySessions.set(userId, {
        page: 1,
        pageSize: 10,
        selectedIndex: -1,
        meetingId: msgId
    });

    const { embed, components } = createRemoveAvailabilityView(meeting.userAvailability[userId], 1, 10);
    await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

async function handleRemoveAvailabilitySelect(interaction) {
    const userId = interaction.user.id;
    const session = availabilitySessions.get(userId);
    if (!session) return;

    const selectedIndex = parseInt(interaction.values[0]);
    session.selectedIndex = selectedIndex;

    const meeting = dataStore.getMeeting(session.meetingId);
    if (!meeting) return;

    const allRanges = [];
    for (const day in meeting.userAvailability[userId]) {
        meeting.userAvailability[userId][day].forEach(range => {
            allRanges.push({ day, range });
        });
    }
    const selectedRange = allRanges[selectedIndex];
    const selectedRangeText = selectedRange ? `${selectedRange.day}: ${selectedRange.range[0]} - ${selectedRange.range[1]}` : null;

    const { embed, components } = createRemoveAvailabilityView(meeting.userAvailability[userId], session.page, session.pageSize, selectedIndex, selectedRangeText);
    await interaction.update({ embeds: [embed], components });
}

async function handleRemoveAvailabilityPagination(interaction) {
    const userId = interaction.user.id;
    const session = availabilitySessions.get(userId);
    if (!session) return;

    const direction = interaction.customId.split('_')[2];
    const currentPage = session.page;
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

    session.page = newPage;
    session.selectedIndex = -1;

    const meeting = dataStore.getMeeting(session.meetingId);
    if (!meeting) return;

    const { embed, components } = createRemoveAvailabilityView(meeting.userAvailability[userId], newPage, session.pageSize);
    await interaction.update({ embeds: [embed], components });
}

async function handleRemoveAvailabilityDelete(interaction, client) {
    const userId = interaction.user.id;
    const session = availabilitySessions.get(userId);
    if (!session || session.selectedIndex === -1) return;

    const meeting = dataStore.getMeeting(session.meetingId);
    if (!meeting) {
        await interaction.update({ content: "The meeting could not be found. It may have been finalized or deleted.", components: [], embeds: [] });
        return;
    }

    const allRanges = [];
    for (const day in meeting.userAvailability[userId]) {
        meeting.userAvailability[userId][day].forEach(range => {
            allRanges.push({ day, range });
        });
    }

    const itemToRemove = allRanges[session.selectedIndex];
    if (!itemToRemove) {
        const { embed, components } = createRemoveAvailabilityView(meeting.userAvailability[userId], session.page, session.pageSize);
        await interaction.update({ embeds: [embed], components });
        return;
    }
    const day = itemToRemove.day;
    const rangeToRemove = itemToRemove.range;

    meeting.userAvailability[userId][day] = meeting.userAvailability[userId][day].filter(r => r[0] !== rangeToRemove[0] || r[1] !== rangeToRemove[1]);

    if (meeting.userAvailability[userId][day].length === 0) {
        delete meeting.userAvailability[userId][day];
    }

    dataStore.updateMeeting(session.meetingId, meeting);
    session.selectedIndex = -1;

    const { embed, components } = createRemoveAvailabilityView(meeting.userAvailability[userId], session.page, session.pageSize);
    await interaction.update({ embeds: [embed], components });

    try {
        const channel = await client.channels.fetch(meeting.channelId);
        const message = await channel.messages.fetch(session.meetingId);

        const buf = await generateAvailabilityHeatmapImage(
            meeting.selectedDays,
            meeting.ranges,
            meeting.userAvailability,
            interaction.guild
        );
        const att = new AttachmentBuilder(buf, { name: 'heatmap.png' });
        const updatedEmbed = EmbedBuilder.from(message.embeds[0])
            .setDescription(`Updated: ${new Date().toLocaleString('en-GB', { timeZoneName: 'short' })}`)
            .setImage('attachment://heatmap.png');

        await message.edit({
            embeds: [updatedEmbed],
            files: [att]
        });
    } catch (error) {
        console.error("Failed to update the original meeting message:", error);
        await interaction.followUp({ content: "Could not update the meeting heatmap. The message may have been deleted.", ephemeral: true });
    }
}

async function handleRemoveAvailabilityDone(interaction) {
    const userId = interaction.user.id;
    availabilitySessions.delete(userId);
    await interaction.update({ content: "Your changes have been saved. You can dismiss this message now.", embeds: [], components: [] });
}

async function handleMeetingCommand(interaction, client) {
    const userId = interaction.user.id;

    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'meet') {
            return handleMeetCommand(interaction);
        }
        if (interaction.commandName === 'listmeetings') {
            return handleListMeetingsCommand(interaction);
        }
        if (interaction.commandName === 'finishmeeting') {
            return handleFinishMeetingCommand(interaction);
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId.startsWith('toggle_')) {
            return handleDayToggleButton(interaction);
        }
        if (interaction.customId === 'confirm_days') {
            return handleConfirmDaysButton(interaction);
        }
        if (interaction.customId === 'add_range') {
            return handleAddRangeButton(interaction);
        }
        if (interaction.customId === 'final_confirm') {
            return handleFinalConfirmButton(interaction);
        }
        if (interaction.customId.startsWith('avail_')) {
            return handleAvailabilityButton(interaction);
        }
        if (interaction.customId.startsWith('list_prev_') || interaction.customId.startsWith('list_next_')) {
            return handleListMeetingsPagination(interaction);
        }
        if (interaction.customId.startsWith('finalize_prev_') || interaction.customId.startsWith('finalize_next_')) {
            return handleFinishMeetingPagination(interaction);
        }
        if (interaction.customId === 'remove_availability') {
            return handleRemoveAvailabilityButton(interaction);
        }
        if (interaction.customId.startsWith('remove_avail_prev_') || interaction.customId.startsWith('remove_avail_next_')) {
            return handleRemoveAvailabilityPagination(interaction);
        }
        if (interaction.customId.startsWith('remove_avail_delete_')) {
            return handleRemoveAvailabilityDelete(interaction, client);
        }
        if (interaction.customId === 'remove_avail_done') {
            return handleRemoveAvailabilityDone(interaction);
        }
        if (interaction.customId === 'delete_range') {
            return handleDeleteRangeButton(interaction);
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'add_modal') {
            return handleAddModalSubmit(interaction);
        }
        if (interaction.customId === 'final_modal') {
            return handleFinalModalSubmit(interaction, client);
        }
        if (interaction.customId.startsWith('modal_')) {
            return handleAvailabilityModalSubmit(interaction);
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('list_select_')) {
            return handleListMeetingsSelect(interaction, client);
        }
        if (interaction.customId.startsWith('finalize_menu_')) {
            return handleFinishMeetingSelect(interaction);
        }
        if (interaction.customId.startsWith('remove_avail_select_')) {
            return handleRemoveAvailabilitySelect(interaction);
        }
        if (interaction.customId === 'select_range') {
            return handleTimeRangeSelect(interaction);
        }
    }
}

module.exports = handleMeetingCommand;