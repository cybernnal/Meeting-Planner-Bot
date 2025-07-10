const { createCanvas, loadImage } = require('canvas');
const dataStore = require('../helpers/dataStore');

async function generateReactionImage(reactionsData) {
    const { allEmojis, reactedUsers } = reactionsData;
    const predefinedEmojis = dataStore.getEmojis();

    const cellHeight = 50;
    const padding = 15;

    // Set font to measure text
    const font = 'bold 20px sans-serif';

    // Create a temporary canvas and context to measure text widths
    const tempCanvas = createCanvas(1, 1); // Smallest possible canvas
    const tempContext = tempCanvas.getContext('2d');
    tempContext.font = font;

    let maxUsernameWidth = 0;
    for (const [userId, userData] of reactedUsers.entries()) {
        const textWidth = tempContext.measureText(userData.user.username).width;
        if (textWidth > maxUsernameWidth) {
            maxUsernameWidth = textWidth;
        }
    }

    const userColumnWidth = Math.max(120, maxUsernameWidth + 30); // Ensure a minimum width, add padding
    const emojiColumnWidth = 120; // Fixed width for emoji columns

    const canvasWidth = userColumnWidth + (emojiColumnWidth * allEmojis.length) + padding * 2;
    const canvasHeight = cellHeight * (reactedUsers.size + 1) + padding * 2;

    // Create the canvas
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    // Define colors for alternating rows and columns
    const baseBgColor = '#2C2F33'; // Discord dark mode background color
    const rowEvenColor = '#36393F'; // Slightly lighter gray
    const rowOddColor = '#2F3136';  // Slightly darker gray

    // Draw background
    context.fillStyle = baseBgColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw alternating row backgrounds
    for (let i = 0; i <= reactedUsers.size; i++) { // Include header row (i=0)
        const y = padding + i * cellHeight;
        context.fillStyle = (i % 2 === 0) ? rowEvenColor : rowOddColor;
        context.fillRect(padding, y, canvasWidth - 2 * padding, cellHeight);
    }

    // Function to draw a custom checkmark
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

    // Function to draw a custom cross
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

    // Set common text properties
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Draw header row - Custom Emojis and Unicode Emojis
    allEmojis.forEach((emojiName, index) => {
        const x = padding + userColumnWidth + emojiColumnWidth * index + emojiColumnWidth / 2;
        const y = padding + cellHeight / 2;

        context.save(); // Save context before setting font and fillStyle for each emoji
        context.font = 'bold 18px sans-serif'; // Apply generic font for all emojis
        context.fillStyle = '#FFFFFF'; // Apply white color for all emojis
        context.fillText(emojiName, x, y);
        context.restore(); // Restore context after drawing each emoji
    });

    // Data rows settings
    let rowIndex = 1;
    for (const [userId, userData] of reactedUsers.entries()) {
        // Draw username
        context.save(); // Save context before setting font and fillStyle
        context.font = 'bold 20px sans-serif'; // Explicitly set font for usernames
        context.fillStyle = '#FFFFFF'; // Explicitly set color for usernames
        context.fillText(userData.user.username, padding + userColumnWidth / 2, padding + cellHeight * (rowIndex + 0.5));
        context.restore(); // Restore context after drawing

        // Draw checkmarks/crosses for reactions
        allEmojis.forEach((emojiName, colIndex) => {
            const hasReacted = userData.emojis.has(emojiName);
            const iconSize = 20; // Size of the checkmark/cross
            const iconX = padding + userColumnWidth + emojiColumnWidth * colIndex + emojiColumnWidth / 2;
            const iconY = padding + cellHeight * (rowIndex + 0.5);

            if (hasReacted) {
                drawCheckmark(context, iconX, iconY, iconSize, '#00FF00'); // Green
            } else {
                drawCross(context, iconX, iconY, iconSize, '#FF0000'); // Red
            }
        });
        rowIndex++;
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateReactionImage };