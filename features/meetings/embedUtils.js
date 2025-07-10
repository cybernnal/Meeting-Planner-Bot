const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const Canvas = require("canvas");

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

function getAvailabilityButtons() {
    const rows = [new ActionRowBuilder(), new ActionRowBuilder()];
    DAYS.forEach((day, idx) => {
        const btn = new ButtonBuilder()
            .setCustomId(`avail_${day}`)
            .setLabel(day)
            .setStyle(ButtonStyle.Primary);
        rows[idx < 4 ? 0 : 1].addComponents(btn);
    });
    return rows;
}

function timeToMinutes(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTime(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function roundTimeString(timeStr) {
    if (timeStr === '23:59') return '23:59';
    const [h, m] = timeStr.split(":").map(Number);
    const mins = h * 60 + m;
    let rounded = Math.round(mins / 15) * 15;
    if (rounded >= 1440) rounded = 1439;
    return minutesToTime(rounded);
}

function generateAvailabilityHeatmapImage(days, ranges, availability) {
    const cellHeight = 20;
    const cellWidth = 100;
    const labelWidth = 60;
    const padding = 30;
    const rightPad = 30;

    if (!days.length || !ranges.length) {
        return Canvas.createCanvas(100, 100).toBuffer("image/png");
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

    const width = labelWidth + cellWidth * days.length + rightPad;
    const height = padding + slots.length * cellHeight + padding;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.font = "14px sans-serif";
    ctx.textBaseline = "middle";

    const colors = ["#ffffff", "#ebf5e6", "#d6ebcc", "#c2e0b3",
        "#add699", "#99cc80", "#85c266", "#70b84d",
        "#5cad33", "#47a31a", "#339900"];

    // Draw cells
    slots.forEach((slot, i) => {
        const y = i * cellHeight + padding;
        if (slot.gap) {
            ctx.fillStyle = "#666";
            days.forEach((_, j) =>
                ctx.fillRect(labelWidth + j * cellWidth, y, cellWidth, cellHeight)
            );
            return;
        }
        const time = slot.time;
        const isHalf = time % 30 === 0;
        if (i === 0 || isHalf || slot.start) {
            ctx.font = time % 60 === 0 ? "bold 14px sans-serif" : "13px sans-serif";
            ctx.textAlign = "right";
            ctx.fillStyle = "#000";
            ctx.fillText(minutesToTime(time), labelWidth - 6, y + cellHeight / 2);
        }
        days.forEach((day, j) => {
            const x = labelWidth + j * cellWidth;
            const count = Object.values(availability || {}).filter(u =>
                u[day]?.some(([us, ue]) => {
                    const usMin = timeToMinutes(us);
                    const ueMin = timeToMinutes(ue);
                    return time >= usMin && time < ueMin;
                })
            ).length;
            const total = Object.keys(availability || {}).length;
            const ratio = total ? count / total : 0;
            const index = total ? Math.floor(ratio * colors.length) : 0;
            const color = colors[Math.min(index, colors.length - 1)];
            ctx.fillStyle = color;
            ctx.fillRect(x, y, cellWidth, cellHeight);
        });
    });

    // Horizontal lines
    slots.forEach((slot, i) => {
        const y = i * cellHeight + padding;
        if (slot.gap) return;
        const time = slot.time;
        const lineWidth = time % 60 === 0 ? 3 : time % 30 === 0 ? 2 : 1;
        ctx.strokeStyle = "#666";
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(labelWidth, y);
        ctx.lineTo(labelWidth + cellWidth * days.length, y);
        ctx.stroke();
        if (slot.end) {
            const sy = y + cellHeight;
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(labelWidth, sy);
            ctx.lineTo(labelWidth + cellWidth * days.length, sy);
            ctx.stroke();
            ctx.textAlign = "right";
            ctx.fillStyle = "#000";
            ctx.fillText(minutesToTime(time + 15), labelWidth - 6, sy - cellHeight / 2 + 1);
        }
    });

    // Vertical lines between days
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 3;
    for (let j = 1; j <= days.length; j++) {
        const x = labelWidth + j * cellWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
    }

    // Outer border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(labelWidth, padding);
    ctx.lineTo(labelWidth + cellWidth * days.length, padding);
    ctx.lineTo(labelWidth + cellWidth * days.length, height - padding);
    ctx.lineTo(labelWidth, height - padding);
    ctx.closePath();
    ctx.stroke();

    // Day labels
    ctx.textAlign = "center";
    ctx.fillStyle = "#000";
    days.forEach((day, j) => {
        const x = labelWidth + j * cellWidth + cellWidth / 2;
        ctx.fillText(day, x, padding / 2 + 4);
    });

    return canvas.toBuffer("image/png");
}


module.exports = {
    getDayButtons,
    getControlRow,
    getConfirmDaysRow,
    getFinalConfirmRow,
    getAvailabilityButtons,
    timeToMinutes,
    minutesToTime,
    roundTimeString,
    generateAvailabilityHeatmapImage
};