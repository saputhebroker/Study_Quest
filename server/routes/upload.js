import express from "express";
import multer from "multer";
import { extractText, getDocumentProxy } from "unpdf";

const router = express.Router();

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PAGES = 80;
const MAX_CHARS = 80000; // about 12,000 words

// keep the file in memory only, nothing is saved to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed."));
  },
});

function receiveFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .json({ error: "PDF is too large. Maximum is 5 MB." });
      }
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    next();
  });
}

router.post("/pdf", receiveFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Please choose a PDF file." });
    }

    // a real PDF starts with "%PDF-", whatever the file name says
    const head = req.file.buffer.subarray(0, 5).toString("latin1");
    if (head !== "%PDF-") {
      return res.status(400).json({ error: "This is not a valid PDF file." });
    }

    const pdf = await getDocumentProxy(new Uint8Array(req.file.buffer));
    const pages = pdf.numPages;

    if (pages > MAX_PAGES) {
      return res.status(400).json({
        error: `This PDF has ${pages} pages. The maximum is ${MAX_PAGES}.`,
      });
    }

    const { text } = await extractText(pdf, { mergePages: true });

    // tidy up spacing
    let clean = String(text)
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (clean.length < 50) {
      return res.status(422).json({
        error:
          "No readable text found. Scanned or image-only PDFs are not supported.",
      });
    }

    let truncated = false;
    if (clean.length > MAX_CHARS) {
      clean = clean.slice(0, MAX_CHARS);
      truncated = true;
    }

    res.json({ text: clean, pages, truncated });
  } catch (err) {
    console.error("PDF error:", err.message);
    res.status(422).json({
      error:
        "Could not read this PDF. It may be damaged or password-protected.",
    });
  }
});

export default router;