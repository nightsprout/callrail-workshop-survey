import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { questions, sections } from './questions'
import { fetchResults } from './sanity'
import logo from './assets/logo-symbol.png'
import './Results.css'

const AVATAR_COLORS = [
  { bg: 'var(--brand-dark-blue)', fg: 'var(--brand-green)', border: 'var(--brand-green)' },
  { bg: 'var(--brand-teal)', fg: 'var(--brand-white)', border: 'var(--brand-teal)' },
  { bg: 'var(--brand-blue)', fg: 'var(--brand-white)', border: 'var(--brand-blue)' },
  { bg: 'var(--brand-dark-green)', fg: 'var(--brand-green)', border: 'var(--brand-green)' },
]

function getInitials(email) {
  if (!email) return '??'
  const parts = email.split('@')[0].split('.')
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : email.substring(0, 2).toUpperCase()
}

function getAvatarColor(email) {
  let hash = 0
  for (let i = 0; i < (email || '').length; i++) hash = ((hash << 5) - hash + email.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function MiniAvatar({ email }) {
  const initials = getInitials(email)
  const color = getAvatarColor(email)
  return (
    <span
      className="mini-avatar"
      title={initials}
      style={{ background: color.bg, color: color.fg, borderColor: color.border }}
    >
      {initials}
    </span>
  )
}

function aggregateResponses(responses) {
  const agg = {}

  for (const q of questions) {
    if (q.type === 'text') {
      agg[q.id] = responses
        .map((r) => ({ text: r[q.id], email: r.email }))
        .filter((r) => r.text)
    } else if (q.type === 'checkbox') {
      const data = {}
      for (const opt of q.options) {
        data[opt.value] = { count: 0, emails: [] }
      }
      for (const r of responses) {
        const vals = r[q.id] || []
        for (const v of vals) {
          if (data[v]) {
            data[v].count++
            if (r.email) data[v].emails.push(r.email)
          }
        }
      }
      agg[q.id] = data
    } else {
      const data = {}
      for (const opt of q.options) {
        data[opt.value] = { count: 0, emails: [] }
      }
      for (const r of responses) {
        const v = r[q.id]
        if (v && data[v]) {
          data[v].count++
          if (r.email) data[v].emails.push(r.email)
        }
      }
      agg[q.id] = data
    }
  }

  return agg
}

function BarChart({ question, data, total }) {
  const sorted = question.options
    .map((opt) => ({ ...opt, ...(data[opt.value] || { count: 0, emails: [] }) }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="result-question">
      <h3 className="result-question__title">{question.title}</h3>
      <div className="result-bars">
        {sorted.map((opt) => {
          const pct = total > 0 ? Math.round((opt.count / total) * 100) : 0
          return (
            <div key={opt.value} className="result-bar">
              <div className="result-bar__header">
                <span className="result-bar__label">{opt.label}</span>
                <span className="result-bar__count">
                  {opt.count} ({pct}%)
                </span>
              </div>
              <div className="result-bar__row">
                <div className="result-bar__track">
                  <div
                    className="result-bar__fill"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                {opt.emails && opt.emails.length > 0 && (
                  <div className="result-bar__avatars">
                    {opt.emails.map((email, i) => (
                      <MiniAvatar key={i} email={email} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TextResponses({ question, responses }) {
  if (!responses || responses.length === 0) {
    return (
      <div className="result-question">
        <h3 className="result-question__title">{question.title}</h3>
        <p className="result-empty">No responses yet</p>
      </div>
    )
  }

  return (
    <div className="result-question">
      <h3 className="result-question__title">{question.title}</h3>
      <ul className="result-text-list">
        {responses.map((r, i) => (
          <li key={i} className="result-text-item">
            {r.email && <MiniAvatar email={r.email} />}
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function generateFakeResponses(count = 24) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
  const pickN = (arr, min, max) => {
    const n = min + Math.floor(Math.random() * (max - min + 1))
    const shuffled = [...arr].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, n)
  }

  const fakeNames = ['alex', 'jordan', 'casey', 'morgan', 'taylor', 'riley', 'drew', 'sam', 'chris', 'pat', 'quinn', 'jamie', 'devon', 'avery', 'blake', 'cameron', 'dana', 'emery', 'finley', 'hayden', 'kai', 'logan', 'nico', 'reese']

  return Array.from({ length: count }, (_, i) => {
    const resp = {
      email: `${fakeNames[i % fakeNames.length]}@callrail.com`,
      submittedAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    }
    for (const q of questions) {
      if (q.type === 'text') {
        if (Math.random() > 0.4) {
          const texts = {
            q14_excited: ['Test generation for our Rails API', 'Automating PR reviews', 'Refactoring the Angular monorepo', 'Writing Helm charts faster', 'Debugging Sidekiq jobs', 'Speeding up migration writing', 'Better code review workflows', 'Prototyping new features quickly'],
            q15_anything_else: ['More on MCP servers', 'Cross-repo workflows', 'How to handle large legacy codebases', 'Security best practices with AI', '', '', ''],
          }
          resp[q.id] = pick(texts[q.id] || [''])
        }
      } else if (q.type === 'checkbox') {
        const vals = pickN(q.options.map((o) => o.value), 1, Math.min(3, q.options.length))
        resp[q.id] = vals
      } else {
        // Weight earlier options slightly more for realistic distribution
        const weights = q.options.map((_, i) => Math.max(1, q.options.length - i))
        const totalW = weights.reduce((a, b) => a + b, 0)
        let r = Math.random() * totalW
        let idx = 0
        for (let i = 0; i < weights.length; i++) {
          r -= weights[i]
          if (r <= 0) { idx = i; break }
        }
        resp[q.id] = q.options[idx].value
      }
    }
    return resp
  })
}

const RESULTS_PASSWORD = 'tyrannosaurus'

export default function Results() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('results_authed') === '1')
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [responses, setResponses] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    fetchResults()
      .then((data) => {
        setResponses(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [authed])

  const total = responses ? responses.length : 0
  const agg = responses ? aggregateResponses(responses) : {}

  if (!authed) {
    return (
      <>
        <header className="survey-header">
          <div className="survey-header__inner">
            <img src={logo} alt="T-Rex Tech" className="survey-header__logo" />
            <span className="survey-header__title">Claude Code Workshop</span>
            <nav className="results-nav">
              <Link to="/">Take Survey</Link>
            </nav>
          </div>
        </header>
        <div className="results-hero">
          <div className="results-hero__inner">
            <h1>Survey Results</h1>
            <p>Enter the password to view results</p>
          </div>
        </div>
        <main className="results-content">
          <form className="pw-gate" onSubmit={(e) => {
            e.preventDefault()
            if (pw === RESULTS_PASSWORD) {
              sessionStorage.setItem('results_authed', '1')
              setAuthed(true)
            } else {
              setPwError(true)
            }
          }}>
            <input
              type="password"
              className="pw-gate__input"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setPwError(false) }}
              placeholder="Password"
              autoFocus
            />
            <button type="submit" className="pw-gate__btn">View Results</button>
            {pwError && <div className="pw-gate__error">Incorrect password</div>}
          </form>
        </main>
      </>
    )
  }

  return (
    <>
      <header className="survey-header">
        <div className="survey-header__inner">
          <img src={logo} alt="T-Rex Tech" className="survey-header__logo" />
          <span className="survey-header__title">Claude Code Workshop</span>
          <nav className="results-nav">
            <Link to="/">Take Survey</Link>
          </nav>
        </div>
      </header>

      <div className="results-hero">
        <div className="results-hero__inner">
          <h1>Survey Results</h1>
          <p>
            {loading
              ? 'Loading responses...'
              : error
                ? 'Error loading results'
                : `${total} response${total !== 1 ? 's' : ''} so far`}
          </p>
        </div>
      </div>

      <main className="results-content">
        {loading && <div className="results-loading">Loading...</div>}

        {error && (
          <div className="results-error">
            Failed to load results: {error}
          </div>
        )}

        {!loading && !error && total === 0 && (
          <div className="results-empty">
            <p>No responses yet. Be the first!</p>
            <Link to="/" className="results-cta">Take the Survey</Link>
          </div>
        )}

        {!loading && !error && total > 0 && (
          <>
            {/* Respondent avatars */}
            {responses && responses.length > 0 && (
              <div className="respondent-avatars">
                {responses
                  .filter((r) => r.email)
                  .map((r, i) => {
                    const color = getAvatarColor(r.email)
                    return (
                      <div
                        key={i}
                        className="avatar"
                        title={`Responded ${new Date(r.submittedAt).toLocaleDateString()}`}
                        style={{ background: color.bg, color: color.fg, borderColor: color.border }}
                      >
                        {getInitials(r.email)}
                      </div>
                    )
                  })}
              </div>
            )}

            {/* Summary stats */}
            <div className="results-stats">
              <div className="stat">
                <div className="stat__number">{total}</div>
                <div className="stat__label">Responses</div>
              </div>
              {agg.q1_yegge_stage && (
                <div className="stat">
                  <div className="stat__number">
                    {(() => {
                      const d = agg.q1_yegge_stage
                      let sum = 0, n = 0
                      for (const [stage, { count }] of Object.entries(d)) {
                        sum += parseInt(stage) * count
                        n += count
                      }
                      return n > 0 ? (sum / n).toFixed(1) : '—'
                    })()}
                  </div>
                  <div className="stat__label">Avg Yegge Stage</div>
                </div>
              )}
              {agg.q7_frequency && (
                <div className="stat">
                  <div className="stat__number">
                    {(() => {
                      const daily = (agg.q7_frequency.daily?.count || 0) + (agg.q7_frequency.several_week?.count || 0)
                      return total > 0 ? `${Math.round((daily / total) * 100)}%` : '—'
                    })()}
                  </div>
                  <div className="stat__label">Use CC Weekly+</div>
                </div>
              )}
            </div>

            {/* Per-section results */}
            {sections.map((section) => {
              const sectionQuestions = questions.filter((q) => q.section === section.id)
              return (
                <div key={section.id} className="results-section">
                  <h2 className="results-section__title">{section.title}</h2>
                  {sectionQuestions.map((q) =>
                    q.type === 'text' ? (
                      <TextResponses key={q.id} question={q} responses={agg[q.id]} />
                    ) : (
                      <BarChart key={q.id} question={q} data={agg[q.id] || {}} total={total} />
                    )
                  )}
                </div>
              )
            })}
          </>
        )}
      </main>

      <footer className="survey-footer">
        <p>Tyrannosaurus Tech &middot; Claude Code Workshop &middot; March 26, 2026</p>
      </footer>
    </>
  )
}
