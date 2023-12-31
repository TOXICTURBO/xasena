const { Image, Message, Sticker, Video } = require("./lib/Messages");
let fs = require("fs");
let config = require("./config");
const path = require("path");
const {
  socket,
  multiauth,
  cachestore,
  jidbcast,
  xasena,
  logs,
  addons, 
  format,
  greet, 
} = require("./x-asena");
fs.readdirSync(__dirname + "/assets/database/").forEach((db) => {
  if (path.extname(db).toLowerCase() == ".js") {
    require(__dirname + "/assets/database/" + db);
  }
});
 
async function Xasena() {
  const { state, saveCreds } = await multiauth(__dirname + "/session");
  let conn = socket({
    logger: logs,
    browser: xasena.macOS("Desktop"),
    syncFullHistory: true,
    version: [2, 2323, 4],
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: cachestore(state.keys, logs),
    },
    generateHighQualityLinkPreview: true,
    shouldIgnoreJid: (jid) => jidbcast(jid),
  });
  conn.ev.on("connection.update", async (s) => {
    const { connection, lastDisconnect } = s;
    if (connection === "connecting") {
      console.log("X-Asena");
      console.log("ℹ️ Connecting to WhatsApp... Please Wait.");
    }
    if (connection === "open") {
      console.log("✅ Login Successful!");
      console.log("Syncing Database");
      config.DATABASE.sync();
      conn.ev.on("creds.update", saveCreds);

      console.log("⬇️  Installing Plugins...");
      fs.readdirSync(__dirname + "/plugins").forEach((plugin) => {
        if (path.extname(plugin).toLowerCase() == ".js") {
          require(__dirname + "/plugins/" + plugin);
        }
      });
      console.log("✅ Plugins Installed!");

      let str = `\`\`\`X-asena connected \nversion : ${
        require(__dirname + "/package.json").version
      }\nTotal Plugins : ${addons.commands.length}\nWorktype: ${
        config.WORK_TYPE
      }\`\`\``;
      conn.sendMessage(conn.user.id, { text: str });
      conn.ev.on("group-participants.update", async (data) => {
        greet(data, conn);
      });
      conn.ev.on("messages.upsert", async (m) => {
        if (m.type !== "notify") return;
        let msg = await format(JSON.parse(JSON.stringify(m.messages[0])), conn);
        if (!msg) return;
        let text_msg = msg.body;
        if (text_msg && config.LOGS)
          console.log(
            `At : ${
              msg.from.endsWith("@g.us")
                ? (await conn.groupMetadata(msg.from)).subject
                : msg.from
            }\nFrom : ${msg.sender}\nMessage:${text_msg}`
          );
        addons.commands.map(async (command) => {
          if (
            command.fromMe &&
            !config.SUDO.split(",").includes(
              msg.sender.split("@")[0] || !msg.isSelf
            )
          ) {
            return;
          }

          let comman = text_msg
            ? text_msg[0].toLowerCase() + text_msg.slice(1).trim()
            : "";
          msg.prefix = new RegExp(config.HANDLERS).test(text_msg)
            ? text_msg[0].toLowerCase()
            : ",";

          let whats;
          switch (true) {
            case command.pattern && command.pattern.test(comman):
              let match;
              try {
                match = text_msg
                  .replace(new RegExp(command.pattern, "i"), "")
                  .trim();
              } catch {
                match = false;
              }
              whats = new Message(conn, msg);
              command.function(whats, match, msg, conn);
              break;

            case text_msg && command.on === "text":
              whats = new Message(conn, msg);
              command.function(whats, text_msg, msg, conn, m);
              break;

            case command.on === "image" || command.on === "photo":
              if (msg.type === "imageMessage") {
                whats = new Image(conn, msg);
                command.function(whats, text_msg, msg, conn, m);
              }
              break;

            case command.on === "sticker":
              if (msg.type === "stickerMessage") {
                whats = new Sticker(conn, msg);
                command.function(whats, msg, conn, m);
              }
              break;
            case command.on === "video":
              if (msg.type === "videoMessage") {
                whats = new Video(conn, msg);
                command.function(whats, msg, conn, m);
              }
              break;

            default:
              break;
          }
        });
      });
    }
    if (connection === "close") {
      console.log(s);
      console.log("Connection closed with bot.");
      Xasena().catch((err) => console.log(err));
    } else {
    }
  });
}
setTimeout(() => {
  Xasena();
}, 6000);
