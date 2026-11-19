import express from "express";
import User from "../models/User.js";
import QuizResult from "../models/QuizResult.js";
import requireAuth from "../middleware/auth.js";
import publicUser from "../utils/publicUser.js";

const router = express.Router();
router.use(requireAuth);

const XP_PER_CORRECT = 10;
const MAX_QUESTIONS = 500;

// "2026-11-19" -> "2026-11-18"
function prevDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function validItem(r) {
  const okIndex = (n) => Number.isInteger(n) && n >= 0 && n < 4;
  return (
    r &&
    typeof r.question === "string" &&
    r.question.length <= 1000 &&
    Array.isArray(r.options) &&
    r.options.length === 4 &&
    r.options.every((o) => typeof o === "string" && o.length <= 1000) &&
    okIndex(r.answerIndex) &&
    (r.chosenIndex === null || okIndex(r.chosenIndex)) &&
    (r.explanation === undefined ||
      (typeof r.explanation === "string" && r.explanation.length <= 1000))
  );
}

router.post("/submit", async (req, res) => {
  try {
    const { results, localDate } = req.body;

    if (
      !Array.isArray(results) ||
      results.length === 0 ||
      results.length > MAX_QUESTIONS ||
      !results.every(validItem)
    ) {
      return res.status(400).json({ error: "Invalid quiz data." });
    }
    if (typeof localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
      return res.status(400).json({ error: "Invalid date." });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "User not found." });

    const score = results.filter((r) => r.chosenIndex === r.answerIndex).length;
    const xpGained = score * XP_PER_CORRECT;

    // daily streak
    if (user.lastActiveDate !== localDate) {
      user.streak =
        user.lastActiveDate === prevDay(localDate) ? user.streak + 1 : 1;
      user.lastActiveDate = localDate;
    }
    user.xp += xpGained;
    await user.save();

    const wrong = results
      .filter((r) => r.chosenIndex !== r.answerIndex)
      .slice(0, 100)
      .map((r) => ({
        question: r.question,
        options: r.options,
        answerIndex: r.answerIndex,
        chosenIndex: r.chosenIndex,
        explanation: r.explanation || "",
      }));

    await QuizResult.create({
      user: user._id,
      score,
      total: results.length,
      xpGained,
      wrong,
    });

    res.status(201).json({ xpGained, score, user: publicUser(user) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not save progress." });
  }
});

router.get("/history", async (req, res) => {
  try {
    const history = await QuizResult.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("score total xpGained createdAt");
    res.json({ history });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not load history." });
  }
});

export default router;