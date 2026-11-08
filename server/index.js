import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import quizRoutes from "./routes/quiz.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/quiz", quizRoutes);

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