import { Client, GatewayIntentBits, Events, SlashCommandBuilder } from "discord.js"
import { REST } from "@discordjs/rest"
import { Routes } from "discord-api-types/v10"
import dotenv from "dotenv"
import fetch from "node-fetch"

dotenv.config()

// confgi
const TOKEN = process.env.DISCORD_TOKEN
const CLIENT_ID = process.env.CLIENT_ID
const API_KEY = process.env.SCREENSHARE_API_KEY
const API_ENDPOINT = "https://screenshare.lol/api/search"
const RATE_LIMIT = 5 // request

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
})

const commands = [
  new SlashCommandBuilder()
    .setName("scan")
    .setDescription("Scan all members in the guild using screenshare.lol API")
    .toJSON(),
]


const rest = new REST({ version: "10" }).setToken(TOKEN)

client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user.tag}`)

  try {
    console.log("Started refreshing application (/) commands.")

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands })

    console.log("Successfully reloaded application (/) commands.")
  } catch (error) {
    console.error(error)
  }
})

class RequestQueue {
  constructor(rateLimit) {
    this.queue = []
    this.processing = false
    this.rateLimit = rateLimit
    this.results = {
      checked: 0,
      detected: [],
      errors: [],
      rateLimitHit: false,
    }
  }

  add(memberId) {
    this.queue.push(memberId)
    if (!this.processing) {
      this.process()
    }
  }

  async updateProgress(interaction, totalMembers) {

    if (this.results.checked % 50 !== 0) return

    const progressEmbed = {
      color: 0x0099ff,
      title: "🔄 Scan in Progress",
      description: `Scanning members: ${this.results.checked}/${totalMembers}`,
      fields: [
        {
          name: "Progress",
          value: `${Math.round((this.results.checked / totalMembers) * 100)}%`,
          inline: true,
        },
        {
          name: "Detections",
          value: `${this.results.detected.length} found`,
          inline: true,
        },
        {
          name: "Status",
          value: this.results.rateLimitHit ? "⚠️ Rate limited" : "✅ Running",
          inline: true,
        },
      ],
      footer: {
        text: "Screenshare Scanner Bot",
      },
      timestamp: new Date().toISOString(),
    }

    try {
      await interaction.editReply({ embeds: [progressEmbed] })
    } catch (error) {
      console.error("Error updating progress:", error)
    }
  }

  async process(interaction, totalMembers) {
    this.processing = true

    while (this.queue.length > 0 && !this.results.rateLimitHit) {
      const batch = this.queue.splice(0, this.rateLimit)
      const promises = batch.map((id) => this.checkMember(id))

      await Promise.all(promises)

      if (interaction && totalMembers) {
        await this.updateProgress(interaction, totalMembers)
      }

      // wait 1 second -- can be changeeeed
      if (this.queue.length > 0 && !this.results.rateLimitHit) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    this.processing = false
    return this.results
  }

  async checkMember(memberId) {
    try {
      const response = await fetch(`${API_ENDPOINT}?discord_id=${memberId}&api_key=${API_KEY}`)
      const data = await response.json()

      this.results.checked++

      // check if we hit a rate limit
      if (!data.success && data.error && data.error.toLowerCase().includes("rate limit")) {
        console.log(`Rate limit hit after checking ${this.results.checked} members`)
        this.results.rateLimitHit = true
        return
      }

      // if the API find something
      if (data.success && data.data && (data.data.user_data?.length > 0 || data.data.ticket_data?.length > 0)) {
        this.results.detected.push({
          id: memberId,
          data: data.data,
        })
        console.log(`Detection found for member ${memberId}`)
      }
    } catch (error) {
      console.error(`Error checking member ${memberId}:`, error.message)
      this.results.errors.push({
        id: memberId,
        error: error.message,
      })

      // check if the error is related to the rate limiting (filter string "rate limit")
      if (error.message.toLowerCase().includes("rate limit")) {
        this.results.rateLimitHit = true
      }
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isCommand()) return

  const { commandName } = interaction

  if (commandName === "scan") {
    await interaction.deferReply({ ephemeral: true })

    try {
      // check if user has admin permissions
      if (!interaction.member.permissions.has("Administrator")) {
        const noPermEmbed = {
          color: 0x0099ff,
          title: "❌ Permission Denied",
          description: "You need Administrator permissions to use this command.",
          footer: {
            text: "Screenshare Scanner Bot",
          },
          timestamp: new Date().toISOString(),
        }
        await interaction.editReply({ embeds: [noPermEmbed] })
        return
      }

      const guild = interaction.guild

      const startEmbed = {
        color: 0x0099ff,
        title: "🔍 Scan Initiated",
        description: "Starting scan of all members. This may take some time...",
        footer: {
          text: "Screenshare Scanner Bot",
        },
        timestamp: new Date().toISOString(),
      }
      await interaction.editReply({ embeds: [startEmbed] })

      // fetch all members
      await guild.members.fetch()
      const members = Array.from(guild.members.cache.values())
      const memberIds = members.map((member) => member.id)

      console.log(`Found ${memberIds.length} members to check`)

      const processingEmbed = {
        color: 0x0099ff,
        title: "⏳ Processing Members",
        description: `Found ${memberIds.length} members to check.`,
        fields: [
          {
            name: "Rate Limit",
            value: "Processing 5 members per second",
            inline: true,
          },
          {
            name: "Estimated Time",
            value: `~${Math.ceil(memberIds.length / 5 / 60)} minutes`,
            inline: true,
          },
        ],
        footer: {
          text: "Screenshare Scanner Bot",
        },
        timestamp: new Date().toISOString(),
      }
      await interaction.editReply({ embeds: [processingEmbed] })

      const queue = new RequestQueue(RATE_LIMIT)
      memberIds.forEach((id) => queue.add(id))

      // process the queue
      const results = await queue.process(interaction, memberIds.length)

      // create results embed
      const resultsEmbed = {
        color: 0x0099ff,
        title: "✅ Scan Completed",
        description: results.rateLimitHit
          ? "⚠️ Scan was stopped early due to rate limits being hit."
          : "Scan completed successfully.",
        thumbnail: {
          url: "https://images-ext-1.discordapp.net/external/Z4SoQNv7nzjXULKUdaGa4QBBb0WNUDoEBtvugdf3rk8/https/screenshare.lol/Blue_and_White_Initial_Brand_Logo_1.png",
        },
        fields: [
          {
            name: "📊 Statistics",
            value: `• Members Checked: ${results.checked}/${memberIds.length}\n• Detections Found: ${results.detected.length}\n• Errors Encountered: ${results.errors.length}`,
          },
        ],
        footer: {
          text: "Screenshare Scanner Bot",
        },
        timestamp: new Date().toISOString(),
      }

      // add detected members field if any were found
      if (results.detected.length > 0) {
        // limit to 10 for embed field
        let detectedMembersText = ""
        const displayLimit = Math.min(results.detected.length, 10)

        for (let i = 0; i < displayLimit; i++) {
          const detection = results.detected[i]
          const member = guild.members.cache.get(detection.id)
          const username = member ? member.user.tag : detection.id
          detectedMembersText += `• ${username} (Confidence: ${detection.data.confidence_score || "N/A"}%)\n`
        }

        if (results.detected.length > 10) {
          detectedMembersText += `• ... and ${results.detected.length - 10} more`
        }

        resultsEmbed.fields.push({
          name: "🚨 Detected Members",
          value: detectedMembersText,
        })
      }

      await interaction.editReply({ embeds: [resultsEmbed] })

      // Create a detailed log file for the server admin
      if (results.detected.length > 0) {
        const detailedResults = JSON.stringify(results.detected, null, 2)

        const detailsEmbed = {
          color: 0x0099ff,
          title: "📋 Detailed Report",
          description: "Here is a detailed report of all detections:",
          footer: {
            text: "Screenshare Scanner Bot",
          },
          timestamp: new Date().toISOString(),
        }

        await interaction.followUp({
          embeds: [detailsEmbed],
          files: [
            {
              attachment: Buffer.from(detailedResults),
              name: "detection_results.json",
            },
          ],
          ephemeral: true,
        })

       
        if (results.detected.length > 5) {
          const summaryEmbed = {
            color: 0xff5733, 
            title: "⚠️ Multiple Detections Found",
            description: `${results.detected.length} members were flagged in your server.`,
            fields: [
              {
                name: "Next Steps",
                value:
                  "1. Review the detailed JSON report\n2. Investigate flagged members\n3. Take appropriate action based on confidence scores",
              },
              {
                name: "Confidence Breakdown",
                value: generateConfidenceBreakdown(results.detected),
              },
            ],
            footer: {
              text: "Screenshare Scanner Bot",
            },
            timestamp: new Date().toISOString(),
          }

          await interaction.followUp({
            embeds: [summaryEmbed],
            ephemeral: true,
          })
        }
      }
    } catch (error) {
      console.error("Error during scan:", error)

      const errorEmbed = {
        color: 0xff0000,
        title: "❌ Error",
        description: `An error occurred during the scan: ${error.message}`,
        footer: {
          text: "Screenshare Scanner Bot",
        },
        timestamp: new Date().toISOString(),
      }

      await interaction.editReply({ embeds: [errorEmbed] })
    }
  }
})


function generateConfidenceBreakdown(detections) {
  const confidenceBuckets = {
    high: 0, // 80-100%
    medium: 0, // 50-79%
    low: 0, // 0-49%
  }

  detections.forEach((detection) => {
    const score = detection.data.confidence_score || 0
    if (score >= 80) confidenceBuckets.high++
    else if (score >= 50) confidenceBuckets.medium++
    else confidenceBuckets.low++
  })

  return `• High (80-100%): ${confidenceBuckets.high}\n• Medium (50-79%): ${confidenceBuckets.medium}\n• Low (0-49%): ${confidenceBuckets.low}`
}

client.login(TOKEN)
