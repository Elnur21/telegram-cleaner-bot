import "dotenv/config";
import { Bot, GrammyError, HttpError } from "grammy";
import http from "http";

const { BOT_TOKEN, SAFE_USER_IDS } = process.env;

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN env variable is required");
}

const safelist = new Set(
  (SAFE_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id)),
);

const bot = new Bot(BOT_TOKEN);
const adminCache = new Map();
const ADMIN_CACHE_TTL_MS = 60_000;

async function isAdmin(ctx) {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return false;

  const now = Date.now();
  let entry = adminCache.get(chatId);

  if (!entry || now - entry.timestamp > ADMIN_CACHE_TTL_MS) {
    const admins = await ctx.api.getChatAdministrators(chatId);
    entry = {
      timestamp: now,
      ids: new Set(admins.map((admin) => admin.user.id)),
    };
    adminCache.set(chatId, entry);
  }

  return entry.ids.has(userId);
}

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text ?? "";
  const userId = ctx.from?.id;

  if (!text.trimStart().startsWith("!")) return;
  if (!userId) return;
  if (safelist.has(userId)) return;
//   if (!(await isAdmin(ctx))) return;

  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error("Failed to delete message", error);
  }
});

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});

console.log("Bot is running...");
console.log("Safe user IDs:", safelist);
bot.start();

// HTTP API server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("hello");
});

server.listen(5000, () => {
  console.log("HTTP API server running on port 5000");
});


