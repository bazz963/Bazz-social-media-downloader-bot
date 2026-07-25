const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');

// ================= CONFIGURATION =================
const BOT_TOKEN = 'YOUR_TELEGRAM_BOT_TOKEN_HERE';
const ADMIN_ID = 7667145353; // Replace with your numeric Telegram User ID

// REQUIRED CHANNELS & GROUPS (Bot MUST be Admin in both!)
const REQUIRED_CHANNEL = '@bazzstore963'; // e.g., '@BazzUpdates'
const REQUIRED_GROUP = '@bazzxmadybug';     // e.g., '@BazzChat'

// Links for the Join Buttons (use https://t.me/yourusername or invite links)
const CHANNEL_LINK = 'https://t.me/bazzstore963';
const GROUP_LINK = 'https://t.me/bazzxmadybug';

const START_PHOTO_URL = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80';
const USERS_FILE = './users.json';

// Social Media & Music API endpoints
const SOCIAL_DOWNLOADER_API = 'https://api.example.com/download?url=';
const MUSIC_SEARCH_API = 'https://api.example.com/music?q=';
// =================================================

const bot = new Telegraf(BOT_TOKEN);

// User Tracking Persistence
let users = new Set();

if (fs.existsSync(USERS_FILE)) {
  try {
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    users = new Set(data);
  } catch (err) {
    console.error('Error reading users file:', err);
  }
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify([...users], null, 2));
}

function isAdmin(ctx) {
  return ctx.from && ctx.from.id === ADMIN_ID;
}

// Helper: Check if user is a member of a channel/group
async function checkMembership(ctx, targetChat) {
  try {
    const member = await ctx.telegram.getChatMember(targetChat, ctx.from.id);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (err) {
    console.error(`Error checking membership for ${targetChat}:`, err.message);
    // If bot isn't admin or channel username is invalid, default to true to prevent blocking users
    return true; 
  }
}

// Middleware: Verify Force Join Status before allowing any action
async function verifyForceJoin(ctx) {
  if (ctx.from && ctx.from.id) {
    // Track user
    if (!users.has(ctx.from.id)) {
      users.add(ctx.from.id);
      saveUsers();
    }

    // Skip force join check for Admin
    if (isAdmin(ctx)) return true;

    const isChannelMember = await checkMembership(ctx, REQUIRED_CHANNEL);
    const isGroupMember = await checkMembership(ctx, REQUIRED_GROUP);

    if (!isChannelMember || !isGroupMember) {
      const forceJoinText = 
`⚠️ <b>Must Join Channels to Use This Bot!</b>

To access the downloader features, please join our official Channel and Group below, then click <b>Verify</b>:`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.url('📢 Join Channel', CHANNEL_LINK),
          Markup.button.url('💬 Join Group', GROUP_LINK)
        ],
        [
          Markup.button.callback('✅ Verify / Try Again', 'verify_join')
        ]
      ]);

      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('❌ You have not joined both chat/group yet!', { show_alert: true });
      } else {
        await ctx.reply(forceJoinText, { parse_mode: 'HTML', ...keyboard });
      }
      return false;
    }
  }
  return true;
}

// Handle Verify Button Click
bot.action('verify_join', async (ctx) => {
  const passed = await verifyForceJoin(ctx);
  if (passed) {
    await ctx.answerCbQuery('✅ Verification successful! You can now use the bot.');
    await ctx.deleteMessage().catch(() => {});
    await ctx.reply('🎉 <b>Welcome!</b> Send me any link or use <code>/music &lt;song name&gt;</code> to start downloading.', { parse_mode: 'HTML' });
  }
});

// ================= COMMAND HANDLERS =================

// /start Command
bot.start(async (ctx) => {
  const allowed = await verifyForceJoin(ctx);
  if (!allowed) return;

  const startMessage = 
`<tg-emoji emoji-id="5427168083074628963">💎</tg-emoji> <tg-emoji emoji-id="6120638764021716510">⚡</tg-emoji> <b>BAZZ SOCIAL MEDIA DOWNLOADER</b> <tg-emoji emoji-id="5427168083074628963">💎</tg-emoji> <tg-emoji emoji-id="6120638764021716510">⚡</tg-emoji>
<i>World's Best Social Media & Music Downloader Bot</i>

━━━━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="6086954744268460848">🔥</tg-emoji> ✨ <b>How to Use:</b>
• <tg-emoji emoji-id="6095843123252957701">⚡️</tg-emoji> <b>Videos:</b> Simply send any social media video link directly to the chat. You will receive the HD video without watermark!
• <tg-emoji emoji-id="6096140450953957819">☄️</tg-emoji> <tg-emoji emoji-id="6095957657145840116">👑</tg-emoji> <b>Music:</b> Type <code>/music &lt;song name&gt;</code> (e.g., <code>/music Sidhu Moose Wala</code>) to search and download high-quality audio tracks.

🔥 <b>Features:</b>
• Ultra HD Video Quality
• No Watermark
• Lightning Fast Downloads
• Free & Premium Experience
━━━━━━━━━━━━━━━━━━━━━━
<tg-emoji emoji-id="6120674721487918156">😒</tg-emoji> <b>Developer:</b> BazzHacker963`;

  try {
    await ctx.replyWithPhoto(START_PHOTO_URL, {
      caption: startMessage,
      parse_mode: 'HTML'
    });
  } catch (error) {
    await ctx.reply(startMessage, { parse_mode: 'HTML' });
  }
});

// /music Command
bot.command('music', async (ctx) => {
  const allowed = await verifyForceJoin(ctx);
  if (!allowed) return;

  const query = ctx.message.text.split(' ').slice(1).join(' ');

  if (!query) {
    return ctx.reply('⚠️ Please provide a song name.\n\n<b>Example:</b> <code>/music Sidhu Moose Wala</code>', { parse_mode: 'HTML' });
  }

  const loadingMsg = await ctx.reply(`🔎 Searching music for: <b>${query}</b>...`, { parse_mode: 'HTML' });

  try {
    const response = await axios.get(`${MUSIC_SEARCH_API}${encodeURIComponent(query)}`);
    const data = response.data;

    if (data && data.audioUrl) {
      await ctx.replyWithAudio({ url: data.audioUrl }, {
        title: data.title || query,
        performer: data.performer || 'Bazz Music'
      });
    } else {
      await ctx.reply(`❌ No audio results found for "${query}".`);
    }
  } catch (error) {
    console.error('Music download error:', error.message);
    await ctx.reply('❌ Unable to process music request right now.');
  } finally {
    ctx.deleteMessage(loadingMsg.message_id).catch(() => {});
  }
});

// Admin Command: /listusers
bot.command('listusers', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ Unauthorized access.');
  }

  const userList = [...users];
  let text = `📊 <b>Total Bot Users:</b> ${userList.length}\n\n<b>User IDs:</b>\n`;
  
  if (userList.length === 0) {
    text += 'No users registered yet.';
  } else {
    text += userList.map((id, index) => `${index + 1}. <code>${id}</code>`).join('\n');
  }

  await ctx.reply(text, { parse_mode: 'HTML' });
});

// Admin Command: /broadcast <message>
bot.command('broadcast', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('⛔ Unauthorized access.');
  }

  const broadcastText = ctx.message.text.split(' ').slice(1).join(' ');

  if (!broadcastText) {
    return ctx.reply('⚠️ Please enter a message to broadcast.\n\n<b>Example:</b> <code>/broadcast Hello everyone!</code>', { parse_mode: 'HTML' });
  }

  await ctx.reply(`📢 Starting broadcast to ${users.size} users...`);
  
  let successCount = 0;
  let failCount = 0;

  for (const userId of users) {
    try {
      await bot.telegram.sendMessage(userId, `📢 <b>ANNOUNCEMENT</b>\n\n${broadcastText}`, { parse_mode: 'HTML' });
      successCount++;
    } catch (err) {
      failCount++;
    }
  }

  await ctx.reply(`✅ <b>Broadcast Completed!</b>\n\n• Successful: ${successCount}\n• Failed/Blocked: ${failCount}`, { parse_mode: 'HTML' });
});

// Link Handler: Auto-detect social media URLs
bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  if (text.startsWith('http://') || text.startsWith('https://')) {
    const allowed = await verifyForceJoin(ctx);
    if (!allowed) return;

    const loadingMsg = await ctx.reply('🔄 Processing your link... Fetching HD video without watermark.');

    try {
      const response = await axios.get(`${SOCIAL_DOWNLOADER_API}${encodeURIComponent(text)}`);
      const data = response.data;

      if (data && data.videoUrl) {
        await ctx.replyWithVideo({ url: data.videoUrl }, {
          caption: '✨ <b>Downloaded by BAZZ SOCIAL MEDIA DOWNLOADER</b>\n<tg-emoji emoji-id="6120674721487918156">😒</tg-emoji> <b>Developer:</b> BazzHacker963',
          parse_mode: 'HTML'
        });
      } else {
        await ctx.reply('❌ Could not extract video from this link.');
      }
    } catch (error) {
      console.error('Download error:', error.message);
      await ctx.reply('❌ Failed to download media.');
    } finally {
      ctx.deleteMessage(loadingMsg.message_id).catch(() => {});
    }
  }
});

// Launch Bot
bot.launch().then(() => {
  console.log('🚀 BAZZ Social Media Downloader Bot is live!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
