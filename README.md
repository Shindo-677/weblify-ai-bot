# Weblify AI — Lua Code Renamer Discord Bot (Node.js)

Discord-only bot. Users run `/rename` with a `.lua` attachment; the bot replies with a refactored Lua file.

## Setup
1. Create a Discord application + bot in the Developer Portal.
2. Enable **Message Content Intent** is not required (slash command only).
3. Copy **Bot Token** and **Application ID**.

## Local Run
\`\`\`bash
cp .env.example .env
npm i
npm run dev
\`\`\`

### Register Slash Commands
On startup the bot registers commands globally by default. If you set `DISCORD_GUILD_ID`, it registers to that guild for instant propagation.

## Deploy (Railway)
- Create a Railway project from GitHub repo.
- Add environment variables from `.env.example`.
- Start command: `npm run start` (Railway will run build if you set it; or set a build step `npm run build`).

## Notes
- AI rename uses `luaparse` for analysis and OpenAI for suggestions (optional).
- If `OPENAI_API_KEY` is not set, a heuristic renamer runs instead.
- Rate limiting: 30 seconds between renames per user.

AI Builder
Webify AI
