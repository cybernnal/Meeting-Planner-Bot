const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const Canvas = require("canvas");
const { drawHeatmap, drawTopRanges } = require("../../helpers/drawingUtils");
const { drawUserList, formatUserId } = require("../../helpers/drawingHelpers");

const DAYS = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

function getDayButtons(selectedDays) {
    const rows = [new ActionRowBuilder(), new ActionRowBuilder()];
    DAYS.forEach((day, idx) => {
        const selected = selectedDays.has(day);
        const btn = new ButtonBuilder()
            .setCustomId(`toggle_${day}`)
            .setLabel(day)
            .setStyle(selected ? ButtonStyle.Success : ButtonStyle.Danger);
        rows[idx < 4 ? 0 : 1].addComponents(btn);
    });
    return rows;
}

function getControlRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("add_range")
            .setLabel("Add Time Range")
            .setStyle(ButtonStyle.Primary)
    );
}

function getConfirmDaysRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("confirm_days")
            .setLabel("Confirm Days")
            .setStyle(ButtonStyle.Primary)
    );
}

function getFinalConfirmRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("final_confirm")
            .setLabel("Confirm")
            .setStyle(ButtonStyle.Success)
    );
}

function getAvailabilityButtons(selectedDays) {
    const rows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    selectedDays.forEach((day) => {
        if (buttonCount === 5) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }
        const btn = new ButtonBuilder()
            .setCustomId(`avail_${day}`)
            .setLabel(day)
            .setStyle(ButtonStyle.Primary);
        currentRow.addComponents(btn);
        buttonCount++;
    });

    if (buttonCount > 0) {
        rows.push(currentRow);
    }
    return rows;
}

function timeToMinutes(t) {
    if (t === '24:00') return 1440;
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTime(mins) {
    if (mins === 1440) return '24:00';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function roundTimeString(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const roundedMinutes = Math.round(totalMinutes / 15) * 15;
    const h = Math.floor(roundedMinutes / 60);
    const m = roundedMinutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

async function generateAvailabilityHeatmapImage(days, ranges, availability, guild) {
    const scale = 2;
    const cellHeight = 20 * scale;
    const cellWidth = 100 * scale;
    const labelWidth = 60 * scale;
    const padding = 30 * scale;
    const rightPad = 30 * scale;
    const MAX_CANVAS_WIDTH = 1200 * scale;

    if (!days.length || !ranges.length) {
        return Canvas.createCanvas(100 * scale, 100 * scale).toBuffer("image/png");
    }

    const slots = [];
    ranges.forEach(({ start, end }, idx) => {
        const s = timeToMinutes(start), e = timeToMinutes(end);
        for (let t = s; t < e; t += 15) {
            slots.push({ time: t, start: t === s, end: t + 15 === e });
        }
        if (idx < ranges.length - 1) {
            slots.push({ gap: true });
        }
    });

    const heatmapWidth = labelWidth + cellWidth * days.length;
    const topRangesSectionWidth = 250 * scale;
    const width = heatmapWidth + padding + topRangesSectionWidth + rightPad;
    const height = padding + slots.length * cellHeight + padding;

    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.scale(scale, scale);
    ctx.fillStyle = "#2C2F33";
    ctx.fillRect(0, 0, width / scale, height / scale);
    ctx.font = "14px sans-serif";
    ctx.textBaseline = "middle";

    const dimensions = { scale, cellHeight, cellWidth, labelWidth, padding, height, width, heatmapWidth, topRangesSectionWidth };
    drawHeatmap(ctx, days, slots, availability, dimensions, minutesToTime, timeToMinutes);
    await drawTopRanges(ctx, days, ranges, availability, guild, dimensions, timeToMinutes, drawUserList, formatUserId);

    return canvas.toBuffer("image/png");
}

function createDaySelectionEmbed(selectedDays, showConfirm) {    const embed = new EmbedBuilder()        .setTitle("Select Days for Meeting")        .setDescription("Toggle days you want to include in the meeting availability.")        .setColor(0x0099ff);    return embed;}function createTimeRangeEmbed(selectedDays, ranges) {    const embed = new EmbedBuilder()        .setTitle("Add Time Ranges")        .setDescription("Add time ranges for the selected days.")        .setColor(0x0099ff);    if (ranges.length > 0) {        let description = "Current Ranges:\n";        ranges.forEach(range => {            description += `- ${range.start} - ${range.end}\n`;        });        embed.setDescription(description);    }    return embed;}module.exports = {    getDayButtons,    getControlRow,    getConfirmDaysRow,    getFinalConfirmRow,    getAvailabilityButtons,    timeToMinutes,    minutesToTime,    roundTimeString,    generateAvailabilityHeatmapImage,    createDaySelectionEmbed,    createTimeRangeEmbed};