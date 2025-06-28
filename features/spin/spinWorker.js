const { parentPort, workerData } = require('worker_threads');
const { createCanvas, loadImage } = require('canvas');
const { GifEncoder } = require('@skyra/gifenc');
const { buffer: streamToBuffer } = require('stream/consumers');

const CONFIG = {
    canvasSize: workerData.size || 650,

    frameCounts: {
        spin: 70,
        transition: 25,
    },

    pauseDurationMs: 2000,

    avatarSize: 74,
    wheelScale: 1.2,

    wheelAsset: 'assets/wheel.png',
    loadingFrameCount: 8,
    loadingFrameRate: 2,
    loadingFramePattern: i => `assets/loadwheel_${i + 1}.png`,

    text: {
        fontFamily: 'impact',
        fontWeight: 'bold',
        fontSizeRatio: 0.07,
        offsetYRatio: 0.15,
        color: '#ffffff',
        shadow: true,
    },
};

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

function drawCircleImage(ctx, image, x, y, diameter) {
    const radius = diameter / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, x, y, diameter, diameter);
    ctx.restore();
}

async function loadImages(urls) {
    return Promise.all(urls.map(src => loadImage(src)));
}

function maybeSendProgress(progressSet, frameIndex, actualRenderFrames) {
    const percent = Math.floor((frameIndex / (actualRenderFrames - 1)) * 95);
    const rounded = Math.floor(percent / 5) * 5;
    if (!progressSet.has(rounded)) {
        progressSet.add(rounded);
        parentPort?.postMessage({ progress: rounded });
    }
}

function drawWinnerName(ctx, text, canvasSize, alpha) {
    const {
        fontFamily,
        fontSizeRatio,
        offsetYRatio,
        color,
        shadow,
        fontWeight,
    } = CONFIG.text;

    const fontSize = Math.floor(canvasSize * fontSizeRatio);
    const offsetY = canvasSize * offsetYRatio;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    if (shadow) {
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
    }

    ctx.fillText(text, CONFIG._centerX, CONFIG._centerY + offsetY);
    ctx.restore();
}

async function generateGif(users, winnerIndex) {
    const {
        canvasSize,
        avatarSize,
        frameCounts: { spin: frameCount, transition: transitionFrames },
        pauseDurationMs,
        wheelScale,
        wheelAsset,
        loadingFrameCount,
        loadingFrameRate,
        loadingFramePattern,
    } = CONFIG;

    const renderFrameCount = frameCount + transitionFrames;

    const scaleFactor = canvasSize / 1916;
    const centerX = 1030 * scaleFactor;
    const centerY = 1030 * scaleFactor;

    CONFIG._centerX = centerX;
    CONFIG._centerY = centerY;

    const baseRadius = (1030 / 2) * scaleFactor * wheelScale;
    const radius = baseRadius * 0.8;
    const centerSize = baseRadius * 0.8;

    const encoder = new GifEncoder(canvasSize, canvasSize);
    const stream = encoder.createReadStream();
    encoder.setRepeat(0).setDelay(50).setQuality(30).start();

    const bgImage = await loadImage(wheelAsset);
    const bgCanvas = createCanvas(canvasSize, canvasSize);
    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.drawImage(bgImage, 0, 0, canvasSize, canvasSize);

    const canvas = createCanvas(canvasSize, canvasSize);
    const ctx = canvas.getContext('2d');

    const avatars = await loadImages(users.map(u => u.avatarURL));
    const winnerAvatar = avatars[winnerIndex];
    const winnerName = users[winnerIndex].username || 'Winner';

    const loadingFrames = await loadImages(
        Array.from({ length: loadingFrameCount }, (_, i) =>
            loadingFramePattern(i)
        )
    );

    const anglePerUser = (2 * Math.PI) / users.length;
    const fullSpins = 2;
    const totalAngle = fullSpins * 2 * Math.PI + (winnerIndex * anglePerUser);

    const drawAllAvatars = angleOffset => {
        users.forEach((_, i) => {
            const angle = i * anglePerUser - angleOffset - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle) - avatarSize / 2;
            const y = centerY + radius * Math.sin(angle) - avatarSize / 2;
            drawCircleImage(ctx, avatars[i], x, y, avatarSize);
        });
    };

    const progressSent = new Set();

    // Phase 1: SPINNING
    for (let f = 0; f < frameCount; f++) {
        const progress = f / (frameCount - 1);
        const spinAngle = totalAngle * easeOutCubic(progress);

        ctx.clearRect(0, 0, canvasSize, canvasSize);
        ctx.drawImage(bgCanvas, 0, 0);
        drawAllAvatars(spinAngle);

        const loadingIndex = Math.floor(f / loadingFrameRate) % loadingFrameCount;
        const loadingImage = loadingFrames[loadingIndex];
        if (loadingImage) {
            drawCircleImage(
                ctx,
                loadingImage,
                centerX - centerSize / 2,
                centerY - centerSize / 2,
                centerSize
            );
        }

        encoder.setDelay(50);
        encoder.addFrame(ctx);
        maybeSendProgress(progressSent, f, renderFrameCount);
    }

    // Phase 2: TRANSITION
    for (let i = 0; i < transitionFrames; i++) {
        const alphaWinner = i / (transitionFrames - 1);
        const alphaLoading = 1 - alphaWinner;

        ctx.clearRect(0, 0, canvasSize, canvasSize);
        ctx.drawImage(bgCanvas, 0, 0);
        drawAllAvatars(totalAngle);

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, centerSize / 2, 0, Math.PI * 2);
        ctx.clip();

        const loadingIndex = Math.floor((frameCount + i) / loadingFrameRate) % loadingFrameCount;
        const loadingImage = loadingFrames[loadingIndex];

        if (loadingImage) {
            ctx.globalAlpha = alphaLoading;
            ctx.drawImage(
                loadingImage,
                centerX - centerSize / 2,
                centerY - centerSize / 2,
                centerSize,
                centerSize
            );
        }

        ctx.globalAlpha = alphaWinner;
        ctx.drawImage(
            winnerAvatar,
            centerX - centerSize / 2,
            centerY - centerSize / 2,
            centerSize,
            centerSize
        );

        ctx.restore();
        ctx.globalAlpha = 1;

        drawWinnerName(ctx, winnerName, canvasSize, alphaWinner);

        encoder.setDelay(50);
        encoder.addFrame(ctx);
        maybeSendProgress(progressSent, frameCount + i, renderFrameCount);
    }

    // Phase 3: PAUSE
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.drawImage(bgCanvas, 0, 0);
    drawAllAvatars(totalAngle);

    drawCircleImage(
        ctx,
        winnerAvatar,
        centerX - centerSize / 2,
        centerY - centerSize / 2,
        centerSize
    );

    drawWinnerName(ctx, winnerName, canvasSize, 1);

    encoder.setDelay(pauseDurationMs);
    encoder.addFrame(ctx);

    encoder.finish();
    parentPort?.postMessage({ progress: 100 });
    const resultBuffer = await streamToBuffer(stream);
    return resultBuffer;
}

(async () => {
    try {
        const buffer = await generateGif(workerData.users, workerData.winnerIndex);
        parentPort.postMessage({ buffer });
    } catch (err) {
        parentPort.postMessage({ error: err.message });
    }
})();
