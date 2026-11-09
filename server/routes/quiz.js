import express from "express";
import OpenAI from "openai";

const router = express.Router();

const MAX_CHARS = 100000; // about 15,000 words
const WORDS_PER_CHUNK = 300; // smaller chunks = more questions per word
const QUESTIONS_PER_CHUNK = 15;
const PAUSE_MS = 1500; // short pause between chunks
const MAX_TRIES = 5;

// duplicate filter strength (0 to 1, lower = stricter)
const SAME_QUESTION = 0.55;
const SAME_FACT = 0.4; // used when the correct answer is also the same

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- duplicate filter ----------
function wordsOf(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function similarity(a, b) {
  const setA = new Set(wordsOf(a));
  const setB = new Set(wordsOf(b));
  if (setA.size === 0 || setB.size === 0) return 0;
  let common = 0;
  for (const w of setA) if (setB.has(w)) common++;
  return common / (setA.size + setB.size - common);
}

function normalize(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isRepeat(a, b) {
  const sim = similarity(a.question, b.question);
  if (sim >= SAME_QUESTION) return true;

  // same correct answer and fairly similar wording = same fact
  const sameAnswer =
    normalize(a.options[a.answerIndex]) === normalize(b.options[b.answerIndex]);
  return sameAnswer && sim >= SAME_FACT;
}

function cleanQuestions(list) {
  const kept = [];
  for (const q of list) {
    const valid =
      q &&
      typeof q.question === "string" &&
      Array.isArray(q.options) &&
      q.options.length === 4 &&
      new Set(q.options.map((o) => normalize(o))).size === 4 &&
      Number.isInteger(q.answerIndex) &&
      q.answerIndex >= 0 &&
      q.answerIndex < 4;
    if (!valid) continue;

    if (!kept.some((k) => isRepeat(k, q))) kept.push(q);
  }
  return kept;
}

// ---------- splitting ----------
function splitIntoChunks(text) {
  const units = [];
  for (const s of text.trim().split(/(?<=[.!?])\s+/)) {
    const w = s.split(/\s+/);
    if (w.length <= WORDS_PER_CHUNK) {
      units.push(s);
    } else {
      // a very long sentence with no punctuation: cut it by words
      for (let i = 0; i < w.length; i += WORDS_PER_CHUNK) {
        units.push(w.slice(i, i + WORDS_PER_CHUNK).join(" "));
      }
    }
  }

  const chunks = [];
  let cur = [];
  let count = 0;
  for (const u of units) {
    const n = u.split(/\s+/).length;
    if (count + n > WORDS_PER_CHUNK && cur.length > 0) {
      chunks.push(cur.join(" "));
      cur = [];
      count = 0;
    }
    cur.push(u);
    count += n;
  }
  if (cur.length > 0) chunks.push(cur.join(" "));
  return chunks;
}

// ---------- calling the AI ----------
async function callWithRetry(fn) {
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status !== 429 || attempt === MAX_TRIES) throw err;

      const h = err.headers;
      const raw = h?.get ? h.get("retry-after") : h?.["retry-after"];
      const header = Number(raw);
      const waitSec =
        Number.isFinite(header) && header > 0 ? header + 1 : 20 * attempt;

      // a very long wait means the daily limit is used up
      if (waitSec > 120) throw new Error("Daily limit reached (429)");

      console.log(
        `Rate limit hit. Waiting ${waitSec}s (try ${attempt}/${MAX_TRIES})...`
      );
      await sleep(waitSec * 1000);
    }
  }
}

async function quizForChunk(client, chunk) {
  const response = await client.chat.completions.create({
    model: "openai/gpt-oss-20b",
    response_format: { type: "json_object" },
    reasoning_effort: "low",
    max_tokens: 3500,
    messages: [
      {
        role: "system",
        content:
          "You create multiple-choice quizzes from study notes. Respond with ONLY valid JSON.",
      },
      {
        role: "user",
        content: `Create as many multiple-choice questions as the notes support (up to ${QUESTIONS_PER_CHUNK}).
Turn every fact, definition, number, name, date, cause, effect, and example into its own question.
Strict rules:
- Every question must test a different fact. Never ask the same thing twice, even in different words.
- The 4 options of each question must all be different.
- Only use information that is in the notes.
- Keep each explanation to one short sentence.
Return JSON in exactly this shape:
{"questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}]}

Notes:
${chunk}`,
      },
    ],
  });

  const choice = response.choices[0];
  if (choice.finish_reason === "length") {
    throw new Error("Response was cut off");
  }
  const data = JSON.parse(choice.message.content);
  return data.questions || [];
}

// ---------- route ----------
router.post("/generate", async (req, res) => {
  try {
    const { notes } = req.body;

    if (!notes || notes.trim().length < 50) {
      return res.status(400).json({ error: "Please provide more notes." });
    }
    if (notes.length > MAX_CHARS) {
      return res
        .status(400)
        .json({ error: "Notes are too long. Please use a shorter text." });
    }

    // created here so the key from .env is already loaded
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      maxRetries: 0, // we handle retries ourselves
    });

    const chunks = splitIntoChunks(notes);
    console.log(`Notes split into ${chunks.length} chunk(s)`);

    let all = [];
    let failed = 0;
    let stopReason = "";

    for (let i = 0; i < chunks.length; i++) {
      try {
        const qs = await callWithRetry(() => quizForChunk(client, chunks[i]));
        all = all.concat(qs);
        console.log(`Chunk ${i + 1}/${chunks.length}: got ${qs.length} questions`);
      } catch (err) {
        failed++;
        console.error(`Chunk ${i + 1}/${chunks.length} failed:`, err.message);
        if (err.message.includes("Daily limit")) {
          stopReason = "Daily free limit reached. Showing what was generated.";
          break;
        }
      }
      await sleep(PAUSE_MS);
    }

    const questions = cleanQuestions(all);

    if (questions.length === 0) {
      return res.status(500).json({
        error: stopReason || "Could not generate quiz. Try again in a minute.",
      });
    }

    console.log(
      `Done: ${questions.length} unique questions (${all.length} generated, ${failed} chunk(s) failed)`
    );
    res.json({ questions, failedChunks: failed, note: stopReason });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not generate quiz." });
  }
});

export default router;