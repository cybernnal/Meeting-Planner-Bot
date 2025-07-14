const { createCanvas, loadImage } = require('canvas');
const dataStore = require('../helpers/dataStore');

async function generateReactionImage(reactionsData) {
    const { allEmojis, reactedUsers } = reactionsData;
    const predefinedEmojis = dataStore.getEmojis();

    const cellHeight = 50;
    const padding = 15;

    const font = 'bold 20px sans-serif';
    const tempCanvas = createCanvas(1, 1);
    const tempContext = tempCanvas.getContext('2d');
    tempContext.font = font;

    let maxUsernameWidth = 0;
    for (const [userId, userData] of reactedUsers.entries()) {
        const textWidth = tempContext.measureText(userData.user.username).width;
        if (textWidth > maxUsernameWidth) {
            maxUsernameWidth = textWidth;
        }
    }

    const userColumnWidth = Math.max(120, maxUsernameWidth + 30);
    const emojiColumnWidth = 120;

    const canvasWidth = userColumnWidth + (emojiColumnWidth * allEmojis.length) + padding * 2;
    const canvasHeight = cellHeight * (reactedUsers.size + 1) + padding * 2;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    const baseBgColor = '#2C2F33';
    const rowEvenColor = '#36393F';
    const rowOddColor = '#2F3136';

    context.fillStyle = baseBgColor;
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    for (let i = 0; i <= reactedUsers.size; i++) {
        const y = padding + i * cellHeight;
        context.fillStyle = (i % 2 === 0) ? rowEvenColor : rowOddColor;
        context.fillRect(padding, y, canvasWidth - 2 * padding, cellHeight);
    }

    const { drawCheckmark, drawCross } = require('./drawingUtils');

    context.textAlign = 'center';
    context.textBaseline = 'middle';

    allEmojis.forEach((emojiName, index) => {
        const x = padding + userColumnWidth + emojiColumnWidth * index + emojiColumnWidth / 2;
        const y = padding + cellHeight / 2;

        context.save();
        context.font = 'bold 18px sans-serif';
        context.fillStyle = '#FFFFFF';
        context.fillText(emojiName, x, y);
        context.restore();
    });

    let rowIndex = 1;
    for (const [userId, userData] of reactedUsers.entries()) {
        context.save();
        context.font = 'bold 20px sans-serif';
        context.fillStyle = '#FFFFFF';
        context.fillText(userData.user.username, padding + userColumnWidth / 2, padding + cellHeight * (rowIndex + 0.5));
        context.restore();

        allEmojis.forEach((emojiName, colIndex) => {
            const hasReacted = userData.emojis.has(emojiName);
            const iconSize = 20;
            const iconX = padding + userColumnWidth + emojiColumnWidth * colIndex + emojiColumnWidth / 2;
            const iconY = padding + cellHeight * (rowIndex + 0.5);

            if (hasReacted) {
                drawCheckmark(context, iconX, iconY, iconSize, '#00FF00');
            } else {
                drawCross(context, iconX, iconY, iconSize, '#FF0000');
            }
        });
        rowIndex++;
    }

    return canvas.toBuffer('image/png');
}

module.exports = { generateReactionImage };