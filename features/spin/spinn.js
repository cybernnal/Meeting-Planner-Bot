const { EmbedBuilder } = require('discord.js');
const { Worker } = require('worker_threads');
const path = require('path');
const { botLog } = require("../../helpers/logger");
const dataStore = require("../../helpers/dataStore");
const { spinRoleId,
	leaderboardChannelId,
	leaderboardMessageId,
	KMC,
	TOXXA
} = require('../../constants');

function makeProgressBar(progress) {
	const totalBlocks = 20;
	const filledBlocks = Math.round((progress / 100) * totalBlocks);
	const bar = '🟩'.repeat(filledBlocks) + '⬜'.repeat(totalBlocks - filledBlocks);
	return `\`${bar}\` **${progress}%**`;
}

function buildSpinEmbed(title, description, color, existingEmbed) {
	return new EmbedBuilder(existingEmbed?.data ?? {})
		.setTitle(title)
		.setDescription(description)
		.setColor(color);
}

async function updateLeaderboardEmbed(client) {
	const channel = await client.channels.fetch(leaderboardChannelId);
	if (!channel || !channel.isTextBased()) return;

	const sortedWinners = Object.entries(dataStore.getSpinWinners())
		.sort(([, a], [, b]) => b - a)
		.slice(0, 10);

	const lines = await Promise.all(
		sortedWinners.map(async ([userId, count], i) => {
			try {
				const member = await channel.guild.members.fetch(userId);
				return `**#${i + 1}** — <@${member.id}> (${count} win${count === 1 ? '' : 's'})`;
			} catch {
				return `**#${i + 1}** — <@${userId}> (${count} win${count === 1 ? '' : 's'})`;
			}
		})
	);

	const embed = new EmbedBuilder()
		.setTitle('<:OreoThisIsFine:1382375954059362304> Wheel Winners Leaderboard <:OreoThisIsFine:1382375954059362304>')
		.setColor('Gold')
		.setDescription(lines.join('\n') || 'No winners yet.')
		.setTimestamp();

	try {
		const message = await channel.messages.fetch(leaderboardMessageId);
		await message.edit({ embeds: [embed] });
	} catch (err) {
		const fallback = await channel.send({ embeds: [embed] });
		console.warn(`Posted new leaderboard message. Update message ID: ${fallback.id}`);
	}
}



async function handleSpinCommand(interaction, client) {
	if (!interaction.isChatInputCommand() || interaction.commandName !== 'spin') return;

	if (!interaction.member.roles.cache.has(spinRoleId)) {
		botLog(`${interaction.user} is trying to spin the wheel without permission`);
		return interaction.reply({ content: '❌ You do not have permission to spin the wheel.', ephemeral: true });
	}

	botLog(`${interaction.user} is spinning the wheel`);

	const initialEmbed = buildSpinEmbed(
		'<:OreoLoading:1382375567940259980> Spinning the wheel...',
		makeProgressBar(0) + '\nGetting ready...',
		'Red'
	);

	await interaction.reply({
		embeds: [initialEmbed]
	});

	const sentMessage = await interaction.fetchReply();

	try {
		const members = await interaction.guild.members.fetch();
		const users = members
			.filter(m => !m.user.bot &&
				m.roles.cache.has(spinRoleId) &&
				m.user.id !== TOXXA)
			.map(m => ({
				id: m.user.id,
				username: m.displayName || m.user.username,
				avatarURL: m.user.displayAvatarURL({ extension: 'png', size: 64 })
			}))
			.slice(0, 10);

		if (!users.length) return;

		const winnerIndex = Math.floor(Math.random() * users.length);
		const winner = users[winnerIndex];

		const worker = new Worker(path.join(__dirname, 'spinWorker.js'), {
			workerData: { users, winnerIndex }
		});

		worker.on('message', async (msg) => {
			if (msg.error) {
				await sentMessage.edit({ content: '❌ Error generating the wheel.', embeds: [] });
				console.log('Worker message:', msg);

				worker.terminate();
				return;
			}

			if (msg.progress !== undefined) {
				const embed = buildSpinEmbed(
					'<:OreoLoading:1382375567940259980> Spinning the wheel...',
					`${makeProgressBar(msg.progress)}`,
					'Yellow',
					sentMessage.embeds?.[0]
				);

				try {
					await sentMessage.edit({ embeds: [embed] });
				} catch (err) {
					console.warn('Failed to update progress:', err.message);
				}
				return;
			}

			try {
				await interaction.channel.send({
					files: [{ attachment: Buffer.from(msg.buffer), name: 'wheel.gif' }]
				});

				if (interaction.channel.id === KMC)
				{
					dataStore.updateSpinWinCount(winner.id);


					await updateLeaderboardEmbed(client);
				}

				await sentMessage.delete().catch(err => {
					console.warn('Failed to delete original message:', err.message);
				});

			} catch (err) {
				console.error('Failed to send final winner message:', err);
				await sentMessage.edit({ content: '❌ Failed to send the result.', embeds: [] });
			}

			worker.terminate();
		});

		worker.on('error', async (err) => {
			console.error(err);
			await sentMessage.edit({ content: 'Worker thread error.', embeds: [] });
			botLog(`Wheel spinning failed, worker thread error`);
		});

	} catch (error) {
		console.error(error);
		await sentMessage.edit({ content: 'Oops! Something went wrong.', embeds: [] });
		botLog(`wheel spinning failed, something went wrong`);
	}
}

module.exports = handleSpinCommand;