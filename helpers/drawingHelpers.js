const { drawCheckmark, drawCross } = require("./drawingUtils");

async function drawUserList(ctx, userIds, startX, startY, maxWidth, lineHeight, iconSize, drawIcon, iconColor, guild, dryRun = false) {
    ctx.textAlign = "left"; // Ensure left alignment for user names
    let currentX = startX;
    let currentY = startY;
    let rowWidth = 0;

    for (const userId of userIds) {
        let displayName = userId; // Fallback to ID
        if (!dryRun) {
            if (guild && guild.members && typeof guild.members.fetch === 'function') {
                try {
                    const member = await guild.members.fetch(userId);
                    displayName = member.displayName || member.user.username;
                } catch (error) {
                    console.error(`Could not fetch member for ID ${userId}:`, error);
                }
            }
        }
        
        const formattedName = formatUserId(displayName);
        const userTag = formattedName; // Display name directly

        const userTagWidth = ctx.measureText(userTag).width;

        const elementWidth = iconSize + 2 + userTagWidth + 5; 

        if (rowWidth + elementWidth > maxWidth && rowWidth !== 0) {
            currentX = startX; 
            currentY += lineHeight;
            rowWidth = 0;
        }

        if (!dryRun) {
            drawIcon(ctx, currentX + iconSize / 2, currentY - iconSize / 4, iconSize, iconColor);
            ctx.fillText(userTag, currentX + iconSize + 2, currentY);
        }
        currentX += elementWidth;
        rowWidth += elementWidth;
    }
    return currentY + lineHeight;
}

function formatUserId(userId) {
    const maxLen = 13;
    if (userId.length > maxLen) {
        return userId.substring(0, maxLen - 3) + '...'; // -3 for "..."
    }
    return userId;
}

module.exports = {
    drawUserList,
    formatUserId
};