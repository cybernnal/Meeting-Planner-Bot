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
    console.log('Attempting to load data from:', DATA_FILE);
    if (fs.existsSync(DATA_FILE)) {
        try {
            const fileContent = fs.readFileSync(DATA_FILE, "utf8");
            data = JSON.parse(fileContent);
            if (!data.meetings) data.meetings = {};
            if (!data.spinWinners) data.spinWinners = {};
            if (!data.scheduledEvents) data.scheduledEvents = [];
            console.log('Data loaded successfully:', JSON.stringify(data, null, 2));
        } catch (err) {
            console.error("Error reading or parsing data file:", err);
            data = { meetings: {}, spinWinners: {}, scheduledEvents: [] };
        }
    } else {
        console.log('Data file does not exist, initializing with default data.');
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
        console.log('Data saved successfully:', JSON.stringify(data, null, 2));
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
    console.log('Searching for scheduled event with message ID:', messageId);
    console.log('Current scheduledEvents array:', JSON.stringify(data.scheduledEvents, null, 2));
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