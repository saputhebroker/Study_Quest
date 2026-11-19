import mongoose from "mongoose";

const wrongSchema = new mongoose.Schema(
  {
    question: String,
    options: [String],
    answerIndex: Number,
    chosenIndex: { type: Number, default: null },
    explanation: String,
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    score: Number,
    total: Number,
    xpGained: Number,
    wrong: [wrongSchema], // kept for the weak-spots feature
  },
  { timestamps: true }
);

export default mongoose.model("QuizResult", resultSchema);