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

async function drawTopRanges(ctx, days, ranges, availability, guild, dimensions, timeToMinutes, minutesToTime, drawUserList, formatUserId) {
    const { scale, width, padding, heatmapWidth, fontSizeIncrease } = dimensions;
    let { topRangesSectionWidth } = dimensions;

    const titleFontSize = 16 + fontSizeIncrease;
    const rangeTitleFontSize = 14 + fontSizeIncrease;
    const userListFontSize = 13 + fontSizeIncrease;
    const userListLineHeight = 17 + fontSizeIncrease;
    const userListIconSize = 8 + fontSizeIncrease;

    let allOptimalRanges = [];
    for (const day of days) {
        const optimalRangesForDay = findOptimalOverlapRanges(day, ranges, availability, timeToMinutes, minutesToTime);
        allOptimalRanges = allOptimalRanges.concat(optimalRangesForDay);
    }

    // Sort all optimal ranges by the number of available users (descending)
    // and then by duration (descending) to get the best overall ranges
    allOptimalRanges.sort((a, b) => {
        if (b.avail.length !== a.avail.length) {
            return b.avail.length - a.avail.length;
        }
        return b.duration - a.duration;
    });

    const top = allOptimalRanges.slice(0, 4);

    let maxTextWidth = 0;
    if (top.length > 0) {
        ctx.font = `bold ${rangeTitleFontSize}px sans-serif`;
        top.forEach(res => {
            const totalUsers = Object.keys(availability || {}).length;
            const text = `${res.day} ${res.start}–${res.end} (${res.avail.length}/${totalUsers})`;
            maxTextWidth = Math.max(maxTextWidth, ctx.measureText(text).width);
        });
    }

    const horizontalPadding = 40; 
    const minWidth = 250; 
    topRangesSectionWidth = Math.max(minWidth, topRangesSectionWidth, maxTextWidth + horizontalPadding);

    const topRangesX = (heatmapWidth + (width - heatmapWidth - topRangesSectionWidth) / 2) / scale;
    const topRangesY = padding / scale;

    let currentYForCalculation = topRangesY + (40 / scale);
    if (top.length === 0) {
        currentYForCalculation += userListLineHeight;
    } else {
        const rangeEntryPadding = 10 / scale;
        for (const res of top) {
            currentYForCalculation += userListLineHeight * 2; 
            currentYForCalculation = await drawUserList(ctx, res.avail, 0, currentYForCalculation, 0, userListLineHeight, 0, null, null, guild, true);
            currentYForCalculation += userListLineHeight; 
            currentYForCalculation = await drawUserList(ctx, res.notAvail, 0, currentYForCalculation, 0, userListLineHeight, 0, null, null, guild, true);
            if (res !== top[top.length - 1]) currentYForCalculation += rangeEntryPadding;
        }
    }

    const topRangesSectionHeight = Math.max(150 / scale, currentYForCalculation - topRangesY + (padding / scale));

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 4 / scale;
    ctx.fillStyle = "#505357";
    ctx.fillRect(topRangesX, topRangesY, topRangesSectionWidth / scale, topRangesSectionHeight);
    ctx.strokeRect(topRangesX, topRangesY, topRangesSectionWidth / scale, topRangesSectionHeight);

    ctx.font = `bold ${titleFontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Top 4 Time Ranges", topRangesX + (topRangesSectionWidth / scale) / 2, (padding / scale) / 2);

    let currentY = topRangesY + (40 / scale);
    const userListStartX = topRangesX + (20 / scale);
    const userListMaxWidth = (topRangesSectionWidth - 40) / scale;

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
            res.notAvail = Object.keys(availability || {}).filter(userId => !res.avail.includes(userId));
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







function findOptimalOverlapRanges(day, meetingRanges, userAvailability, timeToMinutes, minutesToTime) {
    const allIntervals = []; // Store all 15-minute intervals with their availability count

    // Step 1: Calculate availability for each 15-minute interval within meeting ranges
    for (const [meetingStartStr, meetingEndStr] of meetingRanges) {
        const meetingStartMin = timeToMinutes(meetingStartStr);
        const meetingEndMin = timeToMinutes(meetingEndStr);

        for (let min = meetingStartMin; min < meetingEndMin; min += 15) {
            const intervalStart = min;
            const intervalEnd = min + 15;
            let availableUsersCount = 0;
            const usersInThisInterval = new Set();

            for (const userId in userAvailability) {
                const userDayAvailability = userAvailability[userId]?.[day];
                if (userDayAvailability) {
                    for (const [userStartStr, userEndStr] of userDayAvailability) {
                        const userStartMin = timeToMinutes(userStartStr);
                        const userEndMin = timeToMinutes(userEndStr);

                        // Check for overlap between user availability and the current 15-min interval
                        if (Math.max(userStartMin, intervalStart) < Math.min(userEndMin, intervalEnd)) {
                            availableUsersCount++;
                            usersInThisInterval.add(userId);
                        }
                    }
                }
            }

            if (availableUsersCount > 0) {
                allIntervals.push({
                    startMin: intervalStart,
                    endMin: intervalEnd,
                    count: availableUsersCount,
                    users: Array.from(usersInThisInterval)
                });
            }
        }
    }

    // Sort intervals by count (descending) to prioritize higher availability
    allIntervals.sort((a, b) => b.count - a.count);

    const optimalRanges = [];
    const processedIntervals = new Set(); // To keep track of intervals already merged

    for (const interval of allIntervals) {
        const intervalKey = `${interval.startMin}-${interval.endMin}`;
        if (processedIntervals.has(intervalKey)) {
            continue; // Skip if already processed as part of a larger range
        }

        let currentRangeStart = interval.startMin;
        let currentRangeEnd = interval.endMin;
        let currentRangeUsers = new Set(interval.users);
        let currentRangeCount = interval.count; // The count of the current interval, which is the peak for this merge

        // Attempt to merge with adjacent intervals that have the same peak count
        // Look forward
        for (let i = interval.endMin; i < 1440; i += 15) {
            const nextInterval = allIntervals.find(
                (int) => int.startMin === i && int.count === currentRangeCount && !processedIntervals.has(`${int.startMin}-${int.endMin}`)
            );
            if (nextInterval) {
                currentRangeEnd = nextInterval.endMin;
                nextInterval.users.forEach(user => currentRangeUsers.add(user));
                processedIntervals.add(`${nextInterval.startMin}-${nextInterval.endMin}`);
            } else {
                break;
            }
        }

        // Look backward
        for (let i = interval.startMin - 15; i >= 0; i -= 15) {
            const prevInterval = allIntervals.find(
                (int) => int.endMin === i + 15 && int.count === currentRangeCount && !processedIntervals.has(`${int.startMin}-${int.endMin}`)
            );
            if (prevInterval) {
                currentRangeStart = prevInterval.startMin;
                prevInterval.users.forEach(user => currentRangeUsers.add(user));
                processedIntervals.add(`${prevInterval.startMin}-${prevInterval.endMin}`);
            } else {
                break;
            }
        }

        const availUsers = Array.from(currentRangeUsers);
        const notAvailUsers = Object.keys(userAvailability || {}).filter(userId => !availUsers.includes(userId));

        optimalRanges.push({
            day: day,
            start: minutesToTime(currentRangeStart),
            end: minutesToTime(currentRangeEnd),
            avail: availUsers,
            notAvail: notAvailUsers,
            count: availUsers.length,
            duration: currentRangeEnd - currentRangeStart
        });
        processedIntervals.add(intervalKey); // Mark the initial interval as processed
    }

    // Final sort by count (descending), then duration (descending)
    optimalRanges.sort((a, b) => {
        if (b.count !== a.count) {
            return b.count - a.count;
        }
        return b.duration - a.duration;
    });

    return optimalRanges;
}

module.exports = {
    drawCheckmark,
    drawCross,
    drawHeatmap,
    drawTopRanges,
    findOptimalOverlapRanges // Export the new function
};