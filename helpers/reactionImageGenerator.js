const { createCanvas, loadImage } = require('canvas');
const dataStore = require('../helpers/dataStore');

async function generateReactionImage(reactionsData) {
    const { allEmojis, reactedUsers } = reactionsData;
    const predefinedEmojis = dataStore.getEmojis();

    const cellHeight = 50;
    const padding = 15;

    // Calculate max width for usernames
    context.font = 'bold 20px sans-serif, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji';
    let maxUsernameWidth = 0;
    for (const [userId, userData] of reactedUsers.entries()) {
        const textWidth = context.measureText(userData.user.username).width;
        if (textWidth > maxUsernameWidth) {
            maxUsernameWidth = textWidth;
        }
    }

    const userColumnWidth = Math.max(120, maxUsernameWidth + 30); // Ensure a minimum width, add padding
    const emojiColumnWidth = 120; // Fixed width for emoji columns

    const canvasWidth = userColumnWidth + (emojiColumnWidth * allEmojis.length) + padding * 2;
    const canvasHeight = cellHeight * (reactedUsers.size + 1) + padding * 2;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    // Define colors for alternating rows and columns
    const baseBgColor = '#2C2F33'; // Discord dark mode background color
    const rowEvenColor = '#36393F'; // Slightly lighter gray
    const rowOddColor = '#2F3136';  // Slightly darker gray
    const userColumnColor = '#3A3D42'; // Distinct color for the user column

    // Fill overall background
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

    context.font = 'bold 18px sans-serif, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji'; // Larger and bold for header
    context.fillStyle = '#FFFFFF'; // White text
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Draw header row
    context.fillText('User', padding + userColumnWidth / 2, padding + cellHeight / 2);
    allEmojis.forEach((emojiName, index) => {
        context.fillText(emojiName, padding + userColumnWidth + emojiColumnWidth * index + emojiColumnWidth / 2, padding + cellHeight / 2);
    });

    // Draw data rows
    let rowIndex = 1;
    for (const [userId, userData] of reactedUsers.entries()) {
            context.font = 'bold 20px sans-serif, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji'; // Bold and larger for usernames
    context.fillStyle = '#FFFFFF'; // White text
    context.fillText(userData.user.username, padding + userColumnWidth / 2, padding + cellHeight * (rowIndex + 0.5));
    allEmojis.forEach((emojiName, colIndex) => {
        const hasReacted = userData.emojis.has(emojiName);
        context.fillStyle = hasReacted ? '#00FF00' : '#FF0000'; // Green for ✅, Red for ❌
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