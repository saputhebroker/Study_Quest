import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    question: String,
    options: [String],
    answerIndex: Number,
    explanation: String,
    box: Number, // 1, 2 or 3
    dueDate: { type: String, required: true }, // "YYYY-MM-DD"
    timesWrong: Number,
  },
  { timestamps: true }
);

schema.index({ user: 1, key: 1 }, { unique: true });

export default mongoose.model("WeakQuestion", schema);