import axios from "axios";
import cheerio from "cheerio";
import fs from "fs-extra";
import archiver from "archiver";
import path from "path";
import os from "os";

export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: "أدخل رابط الموقع في ?url=" });

    const tempDir = path.join(os.tmpdir(), "scraper");
    await fs.ensureDir(tempDir);

    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const files = new Set();

    files.add({ name: "index.html", content: html });

    $("link[href], script[src], img[src]").each((_, el) => {
      const attr = $(el).attr("href") || $(el).attr("src");
      if (!attr) return;
      const abs = new URL(attr, url).href;
      files.add(abs);
    });

    const zipPath = path.join(os.tmpdir(), "taeh.zip");
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);

    for (const file of files) {
      if (typeof file === "object") {
        archive.append(file.content, { name: file.name });
      } else {
        try {
          const response = await axios.get(file, { responseType: "arraybuffer" });
          const name = file.split("/").pop().split("?")[0] || "file";
          archive.append(response.data, { name });
        } catch {
          console.log("فشل تحميل:", file);
        }
      }
    }

    await archive.finalize();

    output.on("close", async () => {
      const zipData = await fs.readFile(zipPath);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=taeh.zip");
      res.send(zipData);
      await fs.remove(tempDir);
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "حدث خطأ أثناء عملية السكراب" });
  }
      }
