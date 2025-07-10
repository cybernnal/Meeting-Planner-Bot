const { REST, SlashCommandBuilder, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');

const commands = [
    new SlashCommandBuilder()
        .setName('spin')
        .setDescription('Spin the wheel for a random winner'),
    new SlashCommandBuilder()
        .setName('meet')
        .setDescription('Create a new meeting to schedule with your team'),
    new SlashCommandBuilder()
        .setName('listmeetings')
        .setDescription('List all active meetings'),
    new SlashCommandBuilder()
        .setName('finishmeeting')
        .setDescription('Finalize a meeting and see the best time slots'),
    new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Schedule an event'),
    new SlashCommandBuilder()
        .setName('shutdown')
        .setDescription('Shutdown the bot'),
    new SlashCommandBuilder()
        .setName('test_schedule')
        .setDescription('Schedule an event for testing'),
    new SlashCommandBuilder()
        .setName('get_reactions')
        .setDescription('Get reactions for a message')
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The ID of the message to get reactions from')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('channel_id')
                .setDescription('The ID of the channel where the message is located (optional)')
                .setRequired(false)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then((data) => console.log(`Successfully registered ${data.length} application commands.`))
    .catch(console.error);