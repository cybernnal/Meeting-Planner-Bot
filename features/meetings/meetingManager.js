const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

const { botLog } = require("../../helpers/logger");
const { generateAvailabilityHeatmapImage } = require("./embedUtils");
const { runQueue } = require("./queueHandler");
const dataStore = require("../../helpers/dataStore");

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
        
        dataStore.deleteMeeting(meetingId);
        await botLog(`User <@${interaction.user.id}> finalized meeting ${meetingId}`);
    });
}

module.exports = {
    finalizeMeeting
};

