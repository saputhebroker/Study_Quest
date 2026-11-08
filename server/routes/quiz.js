import express from "express";
import OpenAI from "openai";

const router = express.Router();

router.post("/generate", async (req, res) => {
  try {
    const { notes, count = 5 } = req.body;

    if (!notes || notes.trim().length < 50) {
      return res.status(400).json({ error: "Please provide more notes." });
    }

    // created here so the key from .env is already loaded
    const client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });

    const response = await client.chat.completions.create({
      model: "openai/gpt-oss-20b",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You create multiple-choice quizzes from study notes. Respond with ONLY valid JSON.",
        },
        {
          role: "user",
          content: `Create ${count} multiple-choice questions from these notes.
Return JSON in exactly this shape:
{"questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}]}

Notes:
${notes}`,
        },
      ],
    });

    const quiz = JSON.parse(response.choices[0].message.content);
    res.json(quiz);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not generate quiz." });
  }
});

export default router;