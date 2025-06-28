const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

const { botLog } = require("../../helpers/logger");
const { timeToMinutes, generateAvailabilityHeatmapImage } = require("./embedUtils");
const { runQueue } = require("./queueHandler");
const dataStore = require("../../helpers/dataStore");

async function showTopRanges(messageId, interaction, sendAsReply = 1) {
    const meeting = dataStore.getMeeting(messageId);
    if (!meeting) {
        const response = { content: 'Meeting not found or data corrupted.', flags: 64 };
        return sendAsReply ? interaction.reply(response) : interaction.channel.send(response);
    }

    const results = [];
    for (const day of meeting.selectedDays) {
        for (const range of meeting.ranges) {
            const rs = timeToMinutes(range.start), re = timeToMinutes(range.end);
            const availList = [];
            const notList = [];
            for (const [uid, days] of Object.entries(meeting.userAvailability || {})) {
                if (!days[day]) continue;
                const overlaps = days[day].some(([us, ue]) => {
                    const usMin = timeToMinutes(us), ueMin = timeToMinutes(ue);
                    return !(ueMin <= rs || usMin >= re);
                });
                if (overlaps) availList.push(uid);
                else notList.push(uid);
            }
            results.push({ day, start: range.start, end: range.end, avail: availList, notAvail: notList });
        }
    }

    results.sort((a, b) => b.avail.length - a.avail.length);
    const top = results.slice(0, 4);
    const topEmbed = new EmbedBuilder().setTitle('Top 4 Time Ranges').setColor(0x3498db);

    if (top.length === 0) {
        topEmbed.setDescription('No responses yet.');
    } else {
        for (const res of top) {
            const availMentions = res.avail.map(id => `<@${id}>`).join(', ') || 'None';
            const notMentions = res.notAvail.map(id => `<@${id}>`).join(', ') || 'None';
            topEmbed.addFields({
                name: `\`${res.day} ${res.start}–${res.end}\``,
                value: `✅ ${availMentions}\n❌ ${notMentions}`
            });
        }
    }

    const payload = { embeds: [topEmbed]};
    return sendAsReply ? interaction.reply(payload) : interaction.channel.send(payload);
}

async function finalizeMeeting(meetingId, interaction) {
    await interaction.deferUpdate();
    await runQueue(meetingId, async () => {
        const meeting = dataStore.getMeeting(meetingId);
        if (!meeting) {
            return interaction.reply({ content: 'This meeting has already been finalized or deleted.', flags: 64 });
        }
        const buf = await generateAvailabilityHeatmapImage(meeting.selectedDays, meeting.ranges, meeting.userAvailability);
        const att = new AttachmentBuilder(buf, { name: 'heatmap.png' });
        const embedFinal = new EmbedBuilder()
            .setTitle(`Final Availability - ${meeting.embedTitle || ''}`)
            .setDescription(`Finalized on: ${new Date().toLocaleString('en-GB', { timeZoneName: 'short' })}`)
            .setImage('attachment://heatmap.png')
            .setColor(0x2ecc71);
        await interaction.channel.send({ embeds: [embedFinal], files: [att] });
        await showTopRanges(meetingId, interaction, 0);
        dataStore.deleteMeeting(meetingId);
        await botLog(`User <@${interaction.user.id}> finalized meeting ${meetingId}`);
    });
}

module.exports = {
    showTopRanges,
    finalizeMeeting
};