# Discord-Screenshare-Scanner-Bot

This Discord bot scans all members in your server against the screenshare.lol API to identify potential detections. Here's what it does:

## Core Functionality

- **Automated Member Scanning**: Checks all Discord IDs in your server against the screenshare.lol database
- **Smart Rate Limiting**: Processes 5 members per second to prevent API rate limits
- **Auto-Stop Protection**: Automatically stops when rate limits are detected to prevent API lockouts
- **Detailed Reporting**: Provides summary statistics and detailed JSON reports of any detections


## How It Works

When an administrator uses the `/scan` command, the bot:

1. Fetches all members in the server
2. Systematically checks each member ID against the screenshare.lol API
3. Collects and organizes any detection data found
4. Generates a comprehensive report showing confidence scores and detection reasons
5. Provides both a summary in Discord and a detailed JSON file for further analysis


The bot is designed for server administrators who need to efficiently check their member base while respecting API limitations.
