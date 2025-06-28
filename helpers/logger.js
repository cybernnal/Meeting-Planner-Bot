let clientRef = null;

const { LOG_CHANNEL_ID } = require('../constants');
function init(client) {
    clientRef = client;
}

async function botLog(message) {
    if (!clientRef) {
        console.log("[BOTLOG]", message);
        return;
    }
    try {
        const channel = await clientRef.channels.fetch(LOG_CHANNEL_ID);
        if (channel && channel.isTextBased()) {
            await channel.send(`📝 🎡 ${message}`);
        }
    } catch (err) {
        console.error("Failed to send bot log:", err);
    }
    console.log(message);
}

module.exports = {
    init,
    botLog
};