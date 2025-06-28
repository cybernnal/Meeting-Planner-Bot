const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../data.json");

let data = { meetings: {}, spinWinners: {} };
const availabilities = new Map();

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
            if (!data.meetings) {
                data.meetings = {};
            }
            for (const [msgId, meeting] of Object.entries(data.meetings)) {
                availabilities.set(msgId, meeting);
            }
        } catch (err) {
            console.error("Error reading data file:", err);
        }
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (err) {
        console.error("Error saving data file:", err);
    }
}

function getMeeting(id) {
    return availabilities.get(id);
}

function getAllMeetingIds() {
    return Object.keys(data.meetings);
}

function getAllMeetings() {
    return data.meetings;
}

function addMeeting(id, record) {
    data.meetings[id] = record;
    availabilities.set(id, record);
    saveData();
}

function updateMeeting(id, record) {
    data.meetings[id] = record;
    availabilities.set(id, record);
    saveData();
}

function deleteMeeting(id) {
    delete data.meetings[id];
    availabilities.delete(id);
    saveData();
}

function getDataByKey(key) {
    loadData();
    return data[key] || null;
}

function setDataByKey(key, value) {
    loadData();
    data[key] = value;
    saveData();
}

function updateSpinWinCount(userId) {
    loadData();
    if (!data.spinWinners) data.spinWinners = {};
    data.spinWinners[userId] = (data.spinWinners[userId] || 0) + 1;
    saveData();
}

function getSpinWinners() {
    loadData();
    return data.spinWinners || {};
}

module.exports = {
    getMeeting,
    updateMeeting,
    deleteMeeting,
    getDataByKey,
    setDataByKey,
    updateSpinWinCount,
    getSpinWinners,
    loadData,
    addMeeting,
    getAllMeetingIds,
    getAllMeetings
};