import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import requireAuth from "../middleware/auth.js";

const router = express.Router();

function makeToken(user) {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function publicUser(u) {
  return { id: u._id, name: u.name, email: u.email, xp: u.xp, streak: u.streak };
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res
        .status(400)
        .json({ error: "Name, email and password are required." });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ error: "This email is already registered." });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash });

    res.status(201).json({ token: makeToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not create account." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const ok = user && (await bcrypt.compare(password, user.password));

    // same message for both cases, so nobody can guess which emails exist
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    res.json({ token: makeToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not log in." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "User not found." });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Could not load profile." });
  }
});

export default router;