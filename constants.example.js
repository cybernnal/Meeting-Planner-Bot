// constants.example.js
// Copy this file to constants.js and replace the values with real Discord IDs

module.exports = {
  LOG_CHANNEL_ID: "YOUR_LOG_CHANNEL_ID", // The channel where bot logs (like startup or errors) are sent.

  spinRoleId: "YOUR_SPIN_ROLE_ID", // The role ID that grants permission to use the /spin command.

  leaderboardChannelId: "YOUR_LEADERBOARD_CHANNEL_ID", // The ID of the channel where the spin leaderboard embed is posted.

  leaderboardMessageId: "YOUR_LEADERBOARD_MESSAGE_ID", // The message ID of the leaderboard embed to update.

  KMC: "YOUR_KMC_CHANNEL_ID", // The channel ID where spins actually count toward the leaderboard. Mainly used for testing — may be an array later.

  TOXXA: "USER_ID_TO_EXCLUDE", // A user ID excluded from spin results (for meme purposes).

  MEET_AUTHORIZED_ROLE_IDS: [ // An array of role IDs allowed to delete any meeting, not just their own.
    "ROLE_ID_1",
    "ROLE_ID_2"
  ]
};