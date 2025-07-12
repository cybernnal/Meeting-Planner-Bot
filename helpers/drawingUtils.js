function drawCheckmark(ctx, x, y, size, color) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size / 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(x - size / 3, y);
    ctx.lineTo(x - size / 10, y + size / 3);
    ctx.lineTo(x + size / 3, y - size / 3);
    ctx.stroke();
    ctx.restore();
}

function drawCross(ctx, x, y, size, color) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size / 8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(x - size / 3, y - size / 3);
    ctx.lineTo(x + size / 3, y + size / 3);
    ctx.moveTo(x + size / 3, y - size / 3);
    ctx.lineTo(x - size / 3, y + size / 3);
    ctx.stroke();
    ctx.restore();
}

function drawHeatmap(ctx, days, slots, availability, dimensions, minutesToTime, timeToMinutes) {
    const { scale, cellHeight, cellWidth, labelWidth, padding, fontSizeIncrease } = dimensions;
    const colors = ["#ffffff", "#ebf5e6", "#d6ebcc", "#c2e0b3",
        "#add699", "#99cc80", "#85c266", "#70b84d",
        "#5cad33", "#47a31a", "#339900"];

    slots.forEach((slot, i) => {
        const y = i * (cellHeight / scale) + (padding / scale);
        if (slot.gap) {
            ctx.fillStyle = "#666";
            days.forEach((_, j) =>
                ctx.fillRect((labelWidth / scale) + j * (cellWidth / scale), y, (cellWidth / scale), (cellHeight / scale))
            );
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 3 / scale;
            ctx.beginPath();
            ctx.moveTo((labelWidth / scale), y + (cellHeight / scale));
            ctx.lineTo((labelWidth + cellWidth * days.length) / scale, y + (cellHeight / scale));
            ctx.stroke();
            return;
        }
        const time = slot.time;
        const isWholeHour = time % 60 === 0;
        const isHalfHour = time % 30 === 0;

        if (i === 0 || isHalfHour || slot.start) {
            ctx.font = `${isWholeHour ? "bold " : ""}${14 + fontSizeIncrease}px sans-serif`;
            ctx.textAlign = "right";
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(minutesToTime(time), (labelWidth - 6) / scale, y + (cellHeight / scale) / 2 - (20 / scale));
        }

        days.forEach((day, j) => {
            const x = (labelWidth / scale) + j * (cellWidth / scale);
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
            ctx.fillRect(x, y, (cellWidth / scale), (cellHeight / scale));
        });
    });

    slots.forEach((slot, i) => {
        const y = i * (cellHeight / scale) + (padding / scale);
        if (slot.gap) return;
        const time = slot.time;
        const lineWidth = (time % 60 === 0 ? 3 : time % 30 === 0 ? 2 : 1) / scale;
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo((labelWidth / scale), y);
        ctx.lineTo((labelWidth + cellWidth * days.length) / scale, y);
        ctx.stroke();

        if (slot.end) {
            const sy = y + (cellHeight / scale);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 3 / scale;
            ctx.beginPath();
            ctx.moveTo((labelWidth / scale), sy);
            ctx.lineTo((labelWidth + cellWidth * days.length) / scale, sy);
            ctx.stroke();

            ctx.textAlign = "right";
            ctx.fillStyle = "#FFFFFF";
            const endTime = time + 15;
            ctx.font = `${endTime % 60 === 0 ? "bold " : ""}${14 + fontSizeIncrease}px sans-serif`;
            ctx.fillText(minutesToTime(endTime), (labelWidth - 6) / scale, sy - (5 / scale) - (10 / scale) + (14 / scale));
            ctx.font = `${13 + fontSizeIncrease}px sans-serif`;
        }
    });

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3 / scale;
    for (let j = 1; j <= days.length; j++) {
        const x = (labelWidth / scale) + j * (cellWidth / scale);
        ctx.beginPath();
        ctx.moveTo(x, (padding / scale));
        ctx.lineTo(x, (padding + slots.length * cellHeight) / scale);
        ctx.stroke();
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4 / scale;
    ctx.beginPath();
    ctx.moveTo((labelWidth / scale), (padding / scale));
    ctx.lineTo((labelWidth + cellWidth * days.length) / scale, (padding / scale));
    ctx.lineTo((labelWidth + cellWidth * days.length) / scale, (padding + slots.length * cellHeight) / scale);
    ctx.lineTo((labelWidth / scale), (padding + slots.length * cellHeight) / scale);
    ctx.closePath();
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${14 + fontSizeIncrease}px sans-serif`;
    days.forEach((day, j) => {
        const x = (labelWidth / scale) + j * (cellWidth / scale) + (cellWidth / scale) / 2;
        ctx.fillText(day, x, (padding / scale) / 2 + (4 / scale));
    });
}

async function drawTopRanges(ctx, days, ranges, availability, guild, dimensions, timeToMinutes, drawUserList, formatUserId) {
    const { scale, width, height, padding, heatmapWidth, topRangesSectionWidth, fontSizeIncrease } = dimensions;
    const topRangesX = (heatmapWidth + (width - heatmapWidth - topRangesSectionWidth) / 2) / scale;
    const topRangesY = padding / scale;
    let topRangesSectionHeight;

    const titleFontSize = 16 + fontSizeIncrease;
    const rangeTitleFontSize = 14 + fontSizeIncrease;
    const userListFontSize = 13 + fontSizeIncrease;
    const userListLineHeight = 17 + fontSizeIncrease;
    const userListIconSize = 8 + fontSizeIncrease;

    const results = [];
    for (const day of days) {
        for (const range of ranges) {
            const rs = timeToMinutes(range.start), re = timeToMinutes(range.end);
            const availList = [];
            const notList = [];
            const allUserIds = new Set(Object.keys(availability || {}));

            for (const uid of allUserIds) {
                const userDays = availability[uid];
                if (userDays && userDays[day]) {
                    const overlaps = userDays[day].some(([us, ue]) => {
                        const usMin = timeToMinutes(us);
                        const ueMin = timeToMinutes(ue);
                        return !(ueMin <= rs || usMin >= re);
                    });
                    if (overlaps) {
                        availList.push(uid);
                    } else {
                        notList.push(uid);
                    }
                } else {
                    notList.push(uid);
                }
            }
            results.push({ day, start: range.start, end: range.end, avail: availList, notAvail: notList });
        }
    }

    const top = results.filter(res => res.avail.length > 0).slice(0, 4);

    let currentYForCalculation = topRangesY + (40 / scale); // Start after the title

    if (top.length === 0) {
        currentYForCalculation += userListLineHeight; // For "No responses yet."
    } else {
        const rangeEntryPadding = 10 / scale;

        for (const res of top) {
            ctx.font = `bold ${rangeTitleFontSize}px sans-serif`; // Set font for dry run
            currentYForCalculation += userListLineHeight; // For range title
            currentYForCalculation += userListLineHeight; // For "Available:"
            currentYForCalculation = await drawUserList(ctx, res.avail, topRangesX + (20 / scale), currentYForCalculation, (topRangesSectionWidth - 25) / scale, userListLineHeight, userListIconSize, drawCheckmark, "#00FF00", guild, true);

            currentYForCalculation += userListLineHeight; // For "Not Available:"
            currentYForCalculation = await drawUserList(ctx, res.notAvail, topRangesX + (20 / scale), currentYForCalculation, (topRangesSectionWidth - 25) / scale, userListLineHeight, userListIconSize, drawCross, "#FF0000", guild, true);

            if (res !== top[top.length - 1]) {
                currentYForCalculation += rangeEntryPadding;
            }
        }
    }

    topRangesSectionHeight = Math.max(150 / scale, currentYForCalculation - topRangesY + (padding / scale)); // Minimum 150px, plus padding

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4 / scale;
    ctx.fillStyle = "#505357"; // Even lighter background
    ctx.fillRect(topRangesX, topRangesY, (topRangesSectionWidth / scale), topRangesSectionHeight);
    ctx.strokeRect(topRangesX, topRangesY, (topRangesSectionWidth / scale), topRangesSectionHeight);

    ctx.font = `bold ${titleFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Top 4 Time Ranges", topRangesX + (topRangesSectionWidth / scale) / 2, (padding / scale) / 2);

    let currentY = topRangesY + (40 / scale);
    const userListStartX = topRangesX + (20 / scale);
    const userListMaxWidth = (topRangesSectionWidth - 25) / scale;

    ctx.textAlign = "left";

    if (top.length === 0) {
        ctx.font = `${userListFontSize}px sans-serif`;
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText("No responses yet.", userListStartX, currentY);
    } else {
        const rangeEntryPadding = 10 / scale;

        for (const res of top) {
            ctx.font = `bold ${rangeTitleFontSize}px sans-serif`;
            ctx.fillStyle = "#FFFFFF";
            const totalUsers = Object.keys(availability || {}).length;
            ctx.fillText(`${res.day} ${res.start}–${res.end} (${res.avail.length}/${totalUsers})`, userListStartX, currentY);
            currentY += userListLineHeight;

            ctx.font = `${userListFontSize}px sans-serif`;
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText("Available:", userListStartX, currentY);
            ctx.fillRect(userListStartX, currentY + 6, ctx.measureText("Available:").width, 1);
            currentY = await drawUserList(ctx, res.avail, userListStartX, currentY + userListLineHeight, userListMaxWidth, userListLineHeight, userListIconSize, drawCheckmark, "#00FF00", guild);

            ctx.fillText("Not Available:", userListStartX, currentY);
            ctx.fillRect(userListStartX, currentY + 6, ctx.measureText("Not Available:").width, 1);
            currentY = await drawUserList(ctx, res.notAvail, userListStartX, currentY + userListLineHeight, userListMaxWidth, userListLineHeight, userListIconSize, drawCross, "#FF0000", guild);

            if (res !== top[top.length - 1]) {
                currentY += rangeEntryPadding;
            }
        }
    }
}

module.exports = {
    drawCheckmark,
    drawCross,
    drawHeatmap,
    drawTopRanges
};