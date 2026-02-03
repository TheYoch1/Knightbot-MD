const { cmd } = require('../command');
const { exec } = require('child_process');
const fs = require('fs');

// --- CONFIGURATION ---
// IMPORTANT: Use double backslashes (\\) for Windows paths
const QBT_PATH = "C:\\Users\\yosef\\qbt.exe"; 
// ---------------------

cmd({
    pattern: "qbt",
    react: "🧲",
    desc: "Download via qbt CLI and send to WhatsApp",
    category: "downloader",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        const link = args[0];
        if (!link) return reply("Please give me a magnet link.");

        reply("🤖 Telling qBittorrent to start downloading...");

        // 1. ADD THE TORRENT
        // We use 'exec' to run the command just like you did in PowerShell
        exec(`"${QBT_PATH}" torrent add "${link}"`, async (error, stdout, stderr) => {
            if (error) {
                return reply(`❌ Failed to add torrent: ${stderr || error.message}`);
            }

            reply("✅ Added! Monitoring download progress...");
            
            // 2. MONITOR PROGRESS (Polling)
            // We check the status every 5 seconds
            let isDownloading = true;
            
            while (isDownloading) {
                await new Promise(r => setTimeout(r, 5000)); // Wait 5 seconds

                // Run 'qbt torrent list' and get the output as JSON so we can read it
                exec(`"${QBT_PATH}" torrent list --format json`, async (e, out, err) => {
                    if (e) return; // Skip errors during polling

                    try {
                        const torrents = JSON.parse(out);
                        // Find the torrent we just added (usually the newest one)
                        // We sort by 'added_on' to get the latest
                        const latest = torrents.sort((a, b) => b.added_on - a.added_on)[0];

                        if (latest && latest.progress === 1) { // 1 means 100%
                            isDownloading = false; // Stop the loop
                            
                            reply(`📦 Download Complete: ${latest.name}\nSending file...`);

                            // 3. SEND THE FILE
                            const filePath = latest.content_path;
                            
                            // Check if it's a file or folder
                            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                                await conn.sendMessage(from, { 
                                    document: { url: filePath }, 
                                    mimetype: "application/octet-stream",
                                    fileName: latest.name
                                }, { quoted: mek });
                            } else {
                                reply(`⚠️ Download finished, but it's a folder: ${latest.name}. I can only send single files.`);
                            }
                        }
                    } catch (parseError) {
                        console.log("JSON Parse Error: ", parseError);
                    }
                });
            }
        });

    } catch (e) {
        reply("Error: " + e.message);
    }
});
