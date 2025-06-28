const { REST, SlashCommandBuilder, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');

const commands = [
	new SlashCommandBuilder()
		.setName('spin')
		.setDescription('Spin the KMC wheel'),
	new SlashCommandBuilder()
		.setName('meet')
		.setDescription('WhenToOreo'),
	new SlashCommandBuilder()
		.setName('listmeetings')
		.setDescription('WhenToOreo list most populated ranges'),
	new SlashCommandBuilder()
		.setName('finishmeeting')
		.setDescription('WhenToOreo finish a meeting and clear the persistant data'),
];

const rest = new REST({ version: '10' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
    .then((data) => console.log(`Successfully registered ${data.length} application commands.`))
    .catch(console.error);