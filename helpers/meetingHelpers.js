const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { timeToMinutes } = require("../features/meetings/embedUtils");

// Helper function to create a day selection embed
function createDaySelectionEmbed(selectedDays, hasSelectedDays) {
    return new EmbedBuilder()
        .setTitle('Select Days')
        .setDescription(hasSelectedDays
            ? `Selected Days: ${[...selectedDays].join(', ')}. Press Confirm Days to continue.`
            : 'No days selected! Please select at least one.')
        .setColor(hasSelectedDays ? 0x3498db : 0xe74c3c);
}

// Helper function to create a time range embed
function createTimeRangeEmbed(selectedDays, ranges) {
    const rangeLines = ranges.map(r => `- ${r.start}–${r.end}`).join('\n');
    return new EmbedBuilder()
        .setTitle('Add Time Ranges')
        .setDescription(`Selected Days: ${[...selectedDays].join(', ')}\nTime Ranges:\n${rangeLines}`)
        .setColor(0x3498db);
}

// Helper function to validate time format
function isValidTimeFormat(time) {
    const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$|^24:00$/;
    return regex.test(time);
}

// Helper function to check for time range overlaps
function hasTimeRangeOverlap(newStart, newEnd, existingRanges) {
    const newStartMin = timeToMinutes(newStart);
    const newEndMin = timeToMinutes(newEnd);

    for (const r of existingRanges) {
        const existingStart = Array.isArray(r) ? r[0] : r.start;
        const existingEnd = Array.isArray(r) ? r[1] : r.end;
        const existingStartMin = timeToMinutes(existingStart);
        const existingEndMin = timeToMinutes(existingEnd);
        if (newStartMin < existingEndMin && newEndMin > existingStartMin) {
            return true;
        }
    }
    return false;
}

// Generic pagination helper
function getPaginationComponents(meetingsData, currentPage, perPage, customIdPrefix, embedTitlePrefix, selectMenuPlaceholder, isFinalize = false) {
    const totalPages = Math.ceil(meetingsData.length / perPage);
    const startIdx = (currentPage - 1) * perPage;
    const slice = meetingsData.slice(startIdx, startIdx + perPage);

    const descLines = slice.map(([id, m], i) => {
        const title = m.embedTitle || `Meeting (${id})`;
        return `**${startIdx + i + 1}.** ${title} - Owner: <@${m.owner}>`;
    });

    const embed = new EmbedBuilder()
        .setTitle(`${embedTitlePrefix} (Page ${currentPage}/${totalPages})`)
        .setDescription(descLines.join('\n'))
        .setColor(isFinalize ? 0xE74C3C : 0x2ecc71);

    const options = slice.map(([id, m]) => ({
        label: m.embedTitle?.substring(0, 95) || `Meeting ${id}`,
        value: id
    }));

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`${customIdPrefix}_select_${currentPage}`)
        .setPlaceholder(selectMenuPlaceholder)
        .addOptions(options);

    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const rows = [selectRow];

    const navRow = new ActionRowBuilder();
    if (currentPage > 1) {
        navRow.addComponents(
            new ButtonBuilder().setCustomId(`${customIdPrefix}_prev_${currentPage}`).setLabel('⬅️ Previous').setStyle(ButtonStyle.Secondary)
        );
    }
    if (currentPage < totalPages) {
        navRow.addComponents(
            new ButtonBuilder().setCustomId(`${customIdPrefix}_next_${currentPage}`).setLabel('Next ➡️').setStyle(ButtonStyle.Secondary)
        );
    }
    if (navRow.components.length > 0) {
        rows.push(navRow);
    }

    return { embeds: [embed], components: rows };
}

module.exports = {
    createDaySelectionEmbed,
    createTimeRangeEmbed,
    isValidTimeFormat,
    hasTimeRangeOverlap,
    getPaginationComponents
};