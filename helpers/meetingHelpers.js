const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const { timeToMinutes, roundTimeString } = require("../features/meetings/embedUtils");

 

function isValidTimeFormat(time) {
    const regex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$|^24:00$/;
    return regex.test(time);
}

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

async function validateAndProcessTimeInput(interaction, startRaw, endRaw, existingRanges, minDuration = 30) {
    if (!isValidTimeFormat(startRaw) || !isValidTimeFormat(endRaw) || (endRaw === '24:00' && startRaw === '24:00')) {
        await interaction.followUp({ content: 'Invalid time format. Use HH:MM (24h).', ephemeral: true });
        return null;
    }

    const start = roundTimeString(startRaw);
    const end = roundTimeString(endRaw);

    if (startRaw !== start || endRaw !== end) {
        await interaction.followUp({ content: `Times rounded to nearest quarter hour: ${startRaw} -> ${start}, ${endRaw} -> ${end}`, ephemeral: true });
    }

    const s = timeToMinutes(start), e = timeToMinutes(end);
    if (e <= s && !(e === 1440 && s === 0)) {
        await interaction.followUp({ content: 'End must be after start.', ephemeral: true });
        return null;
    }
    if ((e - s) < minDuration && !(e === 1440 && s === 0)) {
        await interaction.followUp({ content: `Time range must be at least ${minDuration} minutes.`, ephemeral: true });
        return null;
    }
    if (hasTimeRangeOverlap(start, end, existingRanges)) {
        await interaction.followUp({ content: 'The time range overlaps with an existing range.', ephemeral: true });
        return null;
    }
    return { start, end, s, e };
}

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
    isValidTimeFormat,
    hasTimeRangeOverlap,
    validateAndProcessTimeInput,
    getPaginationComponents
};