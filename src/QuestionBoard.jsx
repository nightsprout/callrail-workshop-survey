import { useState, useEffect, useCallback } from 'react'
import { createQuestion, fetchQuestions, voteQuestion, unvoteQuestion } from './sanity'
import './QuestionBoard.css'

export default function QuestionBoard({ email }) {
  const [questions, setQuestions] = useState([])
  const [newQuestion, setNewQuestion] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const DEFAULT_QUESTIONS = [
    { _id: 'default-1', text: 'What is a token?', email: 'workshop@tyrannosaurustech.com', votes: [], createdAt: '2026-03-14T00:00:00Z' },
  ]

  const loadQuestions = useCallback(async () => {
    try {
      const data = await fetchQuestions()
      // Merge defaults that don't already exist (by text match)
      const existing = (data || []).map((q) => q.text.toLowerCase())
      const defaults = DEFAULT_QUESTIONS.filter((d) => !existing.includes(d.text.toLowerCase()))
      setQuestions([...(data || []), ...defaults])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQuestions()
    const interval = setInterval(loadQuestions, 10000)
    return () => clearInterval(interval)
  }, [loadQuestions])

  async function handleSubmit(e) {
    e.preventDefault()
    const text = newQuestion.trim()
    if (!text) return

    setSubmitting(true)
    try {
      await createQuestion(text, email)
      setNewQuestion('')
      await loadQuestions()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVote(questionId, hasVoted) {
    // Optimistic update
    setQuestions((prev) =>
      prev.map((q) => {
        if (q._id !== questionId) return q
        const votes = q.votes || []
        return {
          ...q,
          votes: hasVoted ? votes.filter((v) => v !== email) : [...votes, email],
        }
      })
    )

    try {
      if (hasVoted) {
        await unvoteQuestion(questionId, email)
      } else {
        await voteQuestion(questionId, email)
      }
      await loadQuestions()
    } catch (err) {
      // Revert on error
      await loadQuestions()
    }
  }

  const sorted = [...questions].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0))

  return (
    <div className="qboard">
      <div className="qboard__header">
        <h2 className="qboard__title">Question Board</h2>
        <p className="qboard__subtitle">
          What topics or questions do you want covered? Upvote what matters to you.
        </p>
      </div>

      <form className="qboard__form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="qboard__input"
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Add a topic or question..."
          maxLength={200}
          disabled={submitting}
        />
        <button type="submit" className="qboard__submit" disabled={submitting || !newQuestion.trim()}>
          {submitting ? 'Adding...' : 'Add'}
        </button>
      </form>

      {error && <div className="qboard__error">{error}</div>}

      {loading && <div className="qboard__loading">Loading questions...</div>}

      {!loading && sorted.length === 0 && (
        <div className="qboard__empty">No questions yet. Be the first to add one!</div>
      )}

      {!loading && sorted.length > 0 && (
        <ul className="qboard__list">
          {sorted.map((q) => {
            const voteCount = q.votes?.length || 0
            const hasVoted = (q.votes || []).includes(email)
            return (
              <li key={q._id} className="qboard__item">
                <button
                  className={`qboard__vote ${hasVoted ? 'qboard__vote--active' : ''}`}
                  onClick={() => handleVote(q._id, hasVoted)}
                  title={hasVoted ? 'Remove vote' : 'Upvote'}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 3L13 9H3L8 3Z" fill="currentColor" />
                  </svg>
                  <span className="qboard__vote-count">{voteCount}</span>
                </button>
                <div className="qboard__item-content">
                  <span className="qboard__item-text">{q.text}</span>
                  <span className="qboard__item-author">{q.email?.split('@')[0]}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
