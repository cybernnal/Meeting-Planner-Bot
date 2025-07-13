const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data.json");

let data = { meetings: {}, spinWinners: {}, scheduledEvents: [] };

const emojis = [
    { name: 'thumbsup', emoji: '👍' },
    { name: 'thumbsdown', emoji: '👎' },
    { name: 'rocket', emoji: '🚀' },
    { name: 'star', emoji: '⭐' },
    { name: '6819644', emoji: '<:6819644:1392574718191730729>'},
];

function getEmojis() {
    return emojis;
}

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const fileContent = fs.readFileSync(DATA_FILE, "utf8");
            if (fileContent) {
                data = JSON.parse(fileContent);
            } else {
                // File is empty, initialize with default data and save.
                data = { meetings: {}, spinWinners: {}, scheduledEvents: [] };
                saveData();
            }
            if (!data.meetings) data.meetings = {};
            if (!data.spinWinners) data.spinWinners = {};
            if (!data.scheduledEvents) data.scheduledEvents = [];
        } catch (err) {
            console.error("Error reading or parsing data file:", err);
            data = { meetings: {}, spinWinners: {}, scheduledEvents: [] };
        }
    } else {
        // File doesn't exist, create it with default data.
        saveData();
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
        console.error("Error saving data file:", err);
    }
}

// Load data on module initialization
loadData();

function getMeeting(id) {
    return data.meetings[id];
}

function getAllMeetings() {
    return data.meetings;
}

function addMeeting(id, record) {
    data.meetings[id] = record;
    saveData();
}

function updateMeeting(id, record) {
    data.meetings[id] = record;
    saveData();
}

function deleteMeeting(id) {
    delete data.meetings[id];
    saveData();
}

function updateSpinWinCount(userId) {
    data.spinWinners[userId] = (data.spinWinners[userId] || 0) + 1;
    saveData();
}

function getSpinWinners() {
    return data.spinWinners || {};
}

function getScheduledEventByMessageId(messageId) {
    return data.scheduledEvents.find(event => event.messageId === messageId);
}

function saveScheduledEvent(eventData) {
    eventData.reactions = {}; // Initialize reactions object
    data.scheduledEvents.push(eventData);
    saveData();
}

function addReaction(messageId, emojiIdentifier, userId) {
    const event = getScheduledEventByMessageId(messageId);
    if (event) {
        if (!event.reactions[emojiIdentifier]) {
            event.reactions[emojiIdentifier] = [];
        }
        if (!event.reactions[emojiIdentifier].includes(userId)) {
            event.reactions[emojiIdentifier].push(userId);
            saveData();
        }
    }
}

function removeReaction(messageId, emojiIdentifier, userId) {
    const event = getScheduledEventByMessageId(messageId);
    if (event && event.reactions[emojiIdentifier]) {
        event.reactions[emojiIdentifier] = event.reactions[emojiIdentifier].filter(id => id !== userId);
        if (event.reactions[emojiIdentifier].length === 0) {
            delete event.reactions[emojiIdentifier];
        }
        saveData();
    }
}

function getReactions(messageId) {
    const event = getScheduledEventByMessageId(messageId);
    return event ? event.reactions : {};
}

module.exports = {
    getMeeting,
    updateMeeting,
    deleteMeeting,
    updateSpinWinCount,
    getSpinWinners,
    addMeeting,
    getAllMeetings,
    saveScheduledEvent,
    getScheduledEventByMessageId,
    getEmojis,
    addReaction,
    removeReaction,
    getReactions,
};