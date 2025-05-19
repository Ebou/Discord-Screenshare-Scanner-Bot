# Discord Bot for Screenshare.lol API Scanning

This bot scans all members in a Discord guild against the screenshare.lol API with proper rate limiting.

## Features

- Scans all members in a guild against the screenshare.lol API
- Implements rate limiting (5 requests per second) to avoid API rate limits
- Provides detailed reports of any detections found
- Automatically stops when rate limits are hit

## Setup

1. Clone this repository
2. Create a `.env` file with the following variables:
   \`\`\`
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_id
   SCREENSHARE_API_KEY=your_screenshare_api_key
   \`\`\`
3. Install dependencies:
   \`\`\`
   npm install
   \`\`\`
4. Run the bot:
   \`\`\`
   node index.js
   \`\`\`

## Usage

Once the bot is running and added to your server, use the `/scan` command to start scanning all members in the guild.

The bot will:
1. Fetch all members in the guild
2. Check each member against the screenshare.lol API at a rate of 5 per second
3. Provide a summary of results
4. Generate a detailed JSON report for any detections found

## Requirements

- Node.js 16.9.0 or higher
- Discord.js v14
- A Discord bot token with the following permissions:
  - `bot` scope
  - `applications.commands` scope
  - `Read Messages/View Channels` permission
  - `Send Messages` permission
  - `Server Members Intent` enabled in the Discord Developer Portal

## Rate Limiting

The bot is configured to make 5 requests per second to avoid hitting the screenshare.lol API rate limits. If a rate limit is hit, the bot will stop scanning and report how many members were checked before the limit was reached.
