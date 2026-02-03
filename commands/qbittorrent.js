const { cmd } = require('../command'); // Adjust this import based on your bot's structure
const fs = require('fs');
const path = require('path');
const Qbittorrent = require('qbittorrent-api');

// --- CONFIGURATION ---
const qbit = new Qbittorrent({
    host: 'localhost',
    port: 8080,
    username: 'YochMovies',      // Change to your qBittorrent username
    password: 'Yochmovies123' // Change to your qBittorrent password
});
// ---------------------

cmd({
    pattern: "leech",
    react: "⬇️",
    desc: "Download a torrent and send it to WhatsApp",
    category: "downloader",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        const magnet = args[0];
        if (!magnet) return reply("Please provide a magnet link or URL.");

        // 1. Login to qBittorrent
        await qbit.login();
        reply("✅ Login successful. Adding torrent...");

        // 2. Add the Torrent
        await qbit.addTorrent(magnet);
        
        // 3. Wait/Poll for completion
        // We need to find the torrent hash to track it. 
        // Since we just added it, it's likely the most recent one or we filter by active.
        // For simplicity, we assume the user sends one link at a time.
        
        reply("⏳ Torrent added. Waiting for download to finish... (This may take a while)");

        let isDownloading = true;
        let torrentHash = null;

        // Loop to check status every 5 seconds
        while (isDownloading) {
            const torrents = await qbit.torrentsInfo({ filter: 'all' });
            // Find the torrent (logic: assume it's the one currently downloading or check magnet match)
            // Simplified: We grab the most recently added torrent
            const targetTorrent = torrents.sort((a, b) => b.added_on - a.added_on)[0];
            torrentHash = targetTorrent.hash;

            if (targetTorrent.progress === 1) {
                isDownloading = false;
                reply(`✅ Download Complete: ${targetTorrent.name}\nUploading to WhatsApp...`);
                
                // 4. Send the file
                // targetTorrent.content_path is where the file is on your disk
                // WARNING: If it's a folder, this will fail. This only works for single files.
                
                const filePath = targetTorrent.content_path;
                
                // Check if file exists and is not a directory
                if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
                     await conn.sendMessage(from, { 
                        document: { url: filePath }, 
                        mimetype: "application/octet-stream",
                        fileName: targetTorrent.name
                    }, { quoted: mek });
                } else {
                    reply("⚠️ Error: The torrent is a folder, not a single file. I cannot send folders yet.");
                }

                // Optional: Delete from qBittorrent after sending
                // await qbit.deleteTorrents([torrentHash], true);
            }

            // Wait 5 seconds before checking again
            await new Promise(r => setTimeout(r, 5000));
        }

    } catch (e) {
        console.log(e);
        reply(`Error: ${e.message}`);
    }
});
