import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import WeakQuestion from "../models/WeakQuestion.js";
import requireAuth from "../middleware/auth.js";
import publicUser from "../utils/publicUser.js";
import applyStreak from "../utils/streak.js";
import { shiftDay, validDate } from "../utils/dates.js";

const router = express.Router();
router.use(requireAuth);

const INTERVALS = { 1: 1, 2: 3, 3: 7 }; // box -> days until the next review
const XP_PER_REVIEW = 5;
const SESSION_SIZE = 20;

// how many weak questions, and how many are due
router.get("/stats", async (req, res) => {
  try {
    const { localDate } = req.query;
    if (!validDate(localDate)) {
      return res.status(400).json({ error: "Invalid date." });
    }
    const total = await WeakQuestion.countDocuments({ user: req.userId });
    const dueCount = await WeakQuestion.countDocuments({
      user: req.userId,
      dueDate: { $lte: localDate },
    });
    res.json({ total, dueCount });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not load stats." });
  }
});

// questions due today (the correct answer is NOT sent)
router.get("/due", async (req, res) => {
  try {
    const { localDate } = req.query;
    if (!validDate(localDate)) {
      return res.status(400).json({ error: "Invalid date." });
    }
    const due = await WeakQuestion.find({
      user: req.userId,
      dueDate: { $lte: localDate },
    })
      .sort({ dueDate: 1 })
      .limit(SESSION_SIZE)
      .select("question options");
    res.json({ due });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not load review." });
  }
});

// answer one question, the server checks it
router.post("/answer", async (req, res) => {
  try {
    const { id, chosenIndex, localDate } = req.body;

    if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid question." });
    }
    if (!Number.isInteger(chosenIndex) || chosenIndex < 0 || chosenIndex > 3) {
      return res.status(400).json({ error: "Invalid answer." });
    }
    if (!validDate(localDate)) {
      return res.status(400).json({ error: "Invalid date." });
    }

    const q = await WeakQuestion.findOne({ _id: id, user: req.userId });
    if (!q) return res.status(404).json({ error: "Question not found." });
    if (q.dueDate > localDate) {
      return res.status(400).json({ error: "This question is not due yet." });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "User not found." });

    const correct = chosenIndex === q.answerIndex;
    const answerIndex = q.answerIndex;
    const explanation = q.explanation || "";
    let mastered = false;
    let xpGained = 0;

    if (correct) {
      xpGained = XP_PER_REVIEW;
      if (q.box >= 3) {
        await q.deleteOne();
        mastered = true;
      } else {
        q.box += 1;
        q.dueDate = shiftDay(localDate, INTERVALS[q.box]);
        await q.save();
      }
    } else {
      q.box = 1;
      q.dueDate = shiftDay(localDate, 1);
      q.timesWrong = (q.timesWrong || 0) + 1;
      await q.save();
    }

    applyStreak(user, localDate);
    user.xp += xpGained;
    await user.save();

    res.json({
      correct,
      answerIndex,
      explanation,
      mastered,
      xpGained,
      user: publicUser(user),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not save answer." });
  }
});

export default router;