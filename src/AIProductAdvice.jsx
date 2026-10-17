import React, { useState } from "react";

export default function AIProductAdvice({ requirement }) {
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function getAdvice() {
    setLoading(true);
    setError("");
    setAdvice("");

    try {
      const response = await fetch(
        "http://localhost:8000/api/ai/advice",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requirement),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not get AI advice");
      }

      setAdvice(data.advice);
    } catch (err) {
      setError(err.message || "Failed to fetch AI advice");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-advice">
      <h3>✨ MatchMart AI Assistant</h3>
      <p>
        Get AI-powered guidance to help compare available products.
      </p>

      <button onClick={getAdvice} disabled={loading || !requirement}>
        {loading ? "Analyzing products..." : "Get AI Recommendation"}
      </button>

      {error && <p role="alert">{error}</p>}

      {advice && (
        <div className="ai-advice-result">
          <h4>AI Recommendation</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{advice}</p>
        </div>
      )}
    </section>
  );
}