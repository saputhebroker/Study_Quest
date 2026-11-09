import { useState } from "react";
import "./App.css";
import Cursor from "./Cursor";

const API = "http://localhost:5000";

export default function App() {
  const [notes, setNotes] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    try {
      const res = await fetch(`${API}/api/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setQuiz(data.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setQuiz(null);
    setAnswers({});
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const wordCount = notes.trim() ? notes.trim().split(/\s+/).length : 0;
  const answered = Object.keys(answers).length;
  const progress = quiz ? (answered / quiz.length) * 100 : 0;
  const score = quiz
    ? quiz.filter((q, i) => answers[i] === q.answerIndex).length
    : 0;

  return (
    <>
      <Cursor />

      {quiz && (
        <div className="progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}

      <main className="app">
        <h1>
          Study <span>Quest</span>
        </h1>
        <p className="sub">Paste your notes. Get a quiz.</p>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Paste your study notes here..."
        />

        <div className="row">
          <span className="count">{wordCount} words</span>
          <button
            className="primary"
            onClick={generate}
            disabled={loading || notes.trim().length < 50}
          >
            {loading ? "Generating..." : "Generate quiz"}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        {quiz && (
          <p className="meta">
            {quiz.length} questions &middot; {answered} answered
          </p>
        )}

        {quiz &&
          quiz.map((q, i) => (
            <section
              className="card"
              key={i}
              style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}
            >
              <h3>
                {i + 1}. {q.question}
              </h3>
              {q.options.map((opt, j) => {
                let cls = "option";
                if (answers[i] === j) cls += " selected";
                if (submitted && j === q.answerIndex) cls += " correct";
                if (submitted && answers[i] === j && j !== q.answerIndex)
                  cls += " wrong";
                return (
                  <button
                    key={j}
                    className={cls}
                    disabled={submitted}
                    onClick={() => setAnswers({ ...answers, [i]: j })}
                  >
                    {opt}
                  </button>
                );
              })}
              {submitted && <p className="explain">{q.explanation}</p>}
            </section>
          ))}

        {quiz && !submitted && (
          <div className="row">
            <span className="count">
              {answered < quiz.length
                ? `${quiz.length - answered} left to answer`
                : "All answered"}
            </span>
            <button
              className="primary"
              onClick={() => setSubmitted(true)}
              disabled={answered < quiz.length}
            >
              Submit answers
            </button>
          </div>
        )}

        {submitted && (
          <div className="result">
            <span>
              {score} / {quiz.length}
            </span>
            <small>+{score * 10} XP</small>
            <button className="ghost" onClick={reset}>
              New quiz
            </button>
          </div>
        )}
      </main>
    </>
  );
}