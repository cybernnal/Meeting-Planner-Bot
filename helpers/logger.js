let clientRef = null;

const { LOG_CHANNEL_ID } = require('../constants');
const { guildId } = require('../config.json');
function init(client) {
    clientRef = client;
}

async function botLog(message, channelId = null, messageId = null) {    if (!clientRef) {        console.log("[BOTLOG]", message);        return;    }    try {        const channel = await clientRef.channels.fetch(LOG_CHANNEL_ID);        if (channel && channel.isTextBased()) {            let logMessage = `📝 🎡 ${message}`;            if (channelId && messageId) {                const messageLink = `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;                logMessage += `\nLink: ${messageLink}`;            } else if (channelId) {                const channelLink = `https.discord.com/channels/${guildId}/${channelId}`;                logMessage += `\nChannel: ${channelLink}`;            }            await channel.send(logMessage);        }    } catch (err) {        console.error("Failed to send bot log:", err);    }    console.log(message);}

module.exports = {
    init,
    botLog
};