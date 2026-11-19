import { useEffect, useState } from "react";
import { localDate } from "./dates";

const API = "http://localhost:5000";

export default function Review({ token, onUser, onExit, onUnauthorized }) {
  const [cards, setCards] = useState(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tally, setTally] = useState({ right: 0, mastered: 0, xp: 0 });

  const auth = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/review/due?localDate=${localDate()}`, { headers: auth })
      .then(async (res) => {
        if (res.status === 401) {
          onUnauthorized();
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load review.");
        if (!cancelled) setCards(data.due);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e.message === "Failed to fetch" ? "Cannot reach the server." : e.message
        );
        setCards([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function answer(j) {
    if (busy || feedback) return;
    setPicked(j);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/review/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({
          id: cards[index]._id,
          chosenIndex: j,
          localDate: localDate(),
        }),
      });
      if (res.status === 401) {
        onUnauthorized();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save answer.");
      setFeedback(data);
      onUser(data.user);
      setTally((t) => ({
        right: t.right + (data.correct ? 1 : 0),
        mastered: t.mastered + (data.mastered ? 1 : 0),
        xp: t.xp + data.xpGained,
      }));
    } catch (e) {
      setError(
        e.message === "Failed to fetch" ? "Cannot reach the server." : e.message
      );
      setPicked(null);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setIndex(index + 1);
    setPicked(null);
    setFeedback(null);
  }

  if (cards === null) {
    return (
      <main className="app">
        <p className="sub">Loading...</p>
      </main>
    );
  }

  const finished = cards.length > 0 && index >= cards.length;
  const card = cards[index];

  return (
    <main className="app">
      {cards.length > 0 && (
        <div className="progress">
          <div style={{ width: `${(index / cards.length) * 100}%` }} />
        </div>
      )}

      <header className="topbar">
        <button className="ghost" onClick={onExit}>
          Back
        </button>
      </header>

      <h1>
        Weak <span>spots</span>
      </h1>
      <p className="sub">Questions you got wrong, back for another try.</p>

      {error && <p className="error">{error}</p>}

      {cards.length === 0 && (
        <div className="notice quiet">
          <span>Nothing to review right now. Check back tomorrow.</span>
        </div>
      )}

      {finished && (
        <>
          <div className="result">
            <span>
              {tally.right} / {cards.length}
            </span>
            <small>+{tally.xp} XP</small>
            <button className="ghost" onClick={onExit}>
              Done
            </button>
          </div>
          {tally.mastered > 0 && (
            <p className="mastered">
              {tally.mastered} question{tally.mastered === 1 ? "" : "s"}{" "}
              mastered and removed from your weak list.
            </p>
          )}
        </>
      )}

      {card && !finished && (
        <>
          <p className="meta">
            Question {index + 1} of {cards.length}
          </p>
          <section className="card" key={card._id}>
            <h3>{card.question}</h3>
            {card.options.map((opt, j) => {
              let cls = "option";
              if (picked === j) cls += " selected";
              if (feedback) {
                if (j === feedback.answerIndex) cls += " correct";
                else if (picked === j) cls += " wrong";
              }
              return (
                <button
                  key={j}
                  className={cls}
                  disabled={busy || !!feedback}
                  onClick={() => answer(j)}
                >
                  {opt}
                </button>
              );
            })}
            {feedback && (
              <p className="explain">
                {feedback.correct ? "Correct. " : "Not quite. "}
                {feedback.explanation}
              </p>
            )}
            {feedback && feedback.mastered && (
              <p className="mastered">
                Mastered. This question leaves your weak list.
              </p>
            )}
          </section>

          {feedback && (
            <div className="row">
              <span className="count">
                {feedback.correct
                  ? `+${feedback.xpGained} XP`
                  : "It comes back tomorrow"}
              </span>
              <button className="primary" onClick={next}>
                {index + 1 < cards.length ? "Next" : "Finish"}
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}