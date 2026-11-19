import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import quizRoutes from "./routes/quiz.js";
import authRoutes from "./routes/auth.js";
import requireAuth from "./middleware/auth.js";
import progressRoutes from "./routes/progress.js";
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in .env");
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use("/api/quiz", requireAuth, quizRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);

app.get("/", (req, res) => res.send("Study Quest API running"));

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(process.env.PORT, () =>
      console.log(`Server running on port ${process.env.PORT}`)
    );
  })
  .catch((err) => console.error("MongoDB connection error:", err.message));