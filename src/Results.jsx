import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { questions, sections } from './questions'
import { fetchResults, fetchQuestions } from './sanity'
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

// Radar/Spider chart for workflow capabilities (Q1)
function RadarChart({ question, data, total }) {
  const items = question.options.map((opt) => ({
    ...opt,
    ...(data[opt.value] || { count: 0 }),
  }))

  const n = items.length
  const size = 280
  const cx = size / 2
  const cy = size / 2
  const maxR = 110
  const rings = 4

  // Calculate angles — start from top (-90deg)
  const angleStep = (2 * Math.PI) / n
  const getPoint = (i, r) => ({
    x: cx + r * Math.cos(angleStep * i - Math.PI / 2),
    y: cy + r * Math.sin(angleStep * i - Math.PI / 2),
  })

  // Background rings
  const ringPaths = Array.from({ length: rings }, (_, ringIdx) => {
    const r = maxR * ((ringIdx + 1) / rings)
    const points = Array.from({ length: n }, (_, i) => getPoint(i, r))
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
  })

  // Spoke lines
  const spokes = Array.from({ length: n }, (_, i) => getPoint(i, maxR))

  // Data polygon
  const dataPoints = items.map((item, i) => {
    const pct = total > 0 ? item.count / total : 0
    const r = Math.max(maxR * pct, 8)
    return getPoint(i, r)
  })
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'

  // Labels
  const labelPoints = items.map((item, i) => {
    const p = getPoint(i, maxR + 20)
    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
    return { ...p, label: item.label.replace(/\s*\(.*\)/, ''), pct, count: item.count }
  })

  return (
    <div className="result-question">
      <h3 className="result-question__title">{question.title}</h3>
      <div className="radar-container">
        <svg viewBox={`0 0 ${size} ${size}`} className="radar-svg">
          {/* Background rings */}
          {ringPaths.map((path, i) => (
            <path key={i} d={path} fill="none" stroke="rgba(0,53,59,0.08)" strokeWidth="1" />
          ))}
          {/* Spokes */}
          {spokes.map((p, i) => (
            <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(0,53,59,0.06)" strokeWidth="1" />
          ))}
          {/* Data area */}
          <path d={dataPath} fill="rgba(0,206,124,0.15)" stroke="var(--brand-green)" strokeWidth="2" />
          {/* Data points */}
          {dataPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="4" fill="var(--brand-green)" />
          ))}
        </svg>
        <div className="radar-labels">
          {labelPoints.map((p, i) => (
            <div key={i} className="radar-label" style={{ left: `${(p.x / size) * 100}%`, top: `${(p.y / size) * 100}%` }}>
              <span className="radar-label__text">{p.label}</span>
              <span className="radar-label__pct">{p.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Donut chart for single-select with few options
function DonutChart({ question, data, total }) {
  const items = question.options
    .map((opt) => ({ ...opt, ...(data[opt.value] || { count: 0, emails: [] }) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)

  const colors = ['var(--brand-green)', 'var(--brand-aqua)', 'var(--brand-blue)', 'var(--brand-teal)', 'var(--brand-dark-green)', '#F2FF69', '#FF6B6B']
  const size = 200
  const cx = size / 2
  const cy = size / 2
  const outerR = 85
  const innerR = 55

  let currentAngle = -Math.PI / 2
  const arcs = items.map((item, i) => {
    const pct = total > 0 ? item.count / total : 0
    const angle = Math.min(pct * 2 * Math.PI, 2 * Math.PI - 0.001) // prevent full circle (SVG arc bug)
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    // Single item = full ring
    if (items.length === 1) {
      const path = [
        `M${cx},${cy - outerR}`,
        `A${outerR},${outerR} 0 1 1 ${cx - 0.001},${cy - outerR}`,
        `M${cx},${cy - innerR}`,
        `A${innerR},${innerR} 0 1 0 ${cx - 0.001},${cy - innerR}`,
      ].join(' ')
      return { ...item, path, color: colors[0], pct: 100 }
    }

    const largeArc = angle > Math.PI ? 1 : 0
    const x1o = cx + outerR * Math.cos(startAngle)
    const y1o = cy + outerR * Math.sin(startAngle)
    const x2o = cx + outerR * Math.cos(endAngle)
    const y2o = cy + outerR * Math.sin(endAngle)
    const x1i = cx + innerR * Math.cos(endAngle)
    const y1i = cy + innerR * Math.sin(endAngle)
    const x2i = cx + innerR * Math.cos(startAngle)
    const y2i = cy + innerR * Math.sin(startAngle)

    const path = [
      `M${x1o},${y1o}`,
      `A${outerR},${outerR} 0 ${largeArc} 1 ${x2o},${y2o}`,
      `L${x1i},${y1i}`,
      `A${innerR},${innerR} 0 ${largeArc} 0 ${x2i},${y2i}`,
      'Z',
    ].join(' ')

    return { ...item, path, color: colors[i % colors.length], pct: Math.round(pct * 100) }
  })

  return (
    <div className="result-question">
      <h3 className="result-question__title">{question.title}</h3>
      <div className="donut-container">
        <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg">
          {arcs.map((arc, i) => (
            <path key={i} d={arc.path} fill={arc.color} fillRule="evenodd" />
          ))}
          <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--color-text)" fontSize="28" fontWeight="700" fontFamily="var(--font-headline)">
            {total}
          </text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--brand-teal)" fontSize="11">
            responses
          </text>
        </svg>
        <div className="donut-legend">
          {arcs.map((arc, i) => (
            <div key={i} className="donut-legend__item">
              <span className="donut-legend__swatch" style={{ background: arc.color }} />
              <span className="donut-legend__label">{arc.label}</span>
              <span className="donut-legend__count">{arc.count} ({arc.pct}%)</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Gradient bar for linear scales (CLAUDE.md familiarity)
function GradientScale({ question, data, total }) {
  const items = question.options.map((opt) => ({
    ...opt,
    ...(data[opt.value] || { count: 0, emails: [] }),
  }))

  const maxCount = Math.max(...items.map((i) => i.count), 1)

  return (
    <div className="result-question">
      <h3 className="result-question__title">{question.title}</h3>
      <div className="gradient-scale">
        <div className="gradient-scale__bars">
          {items.map((item) => {
            const intensity = item.count / maxCount
            return (
              <div key={item.value} className="gradient-scale__col">
                <div className="gradient-scale__bar-area">
                  <div
                    className="gradient-scale__bar"
                    style={{
                      height: `${Math.max(intensity * 100, 6)}%`,
                      opacity: 0.3 + intensity * 0.7,
                    }}
                  />
                </div>
                <div className="gradient-scale__count">{item.count}</div>
              </div>
            )
          })}
        </div>
        <div className="gradient-scale__labels">
          {items.map((item) => (
            <div key={item.value} className="gradient-scale__label-col">
              <div className="gradient-scale__label">{item.label}</div>
              {item.emails && item.emails.length > 0 && (
                <div className="gradient-scale__avatars">
                  {item.emails.map((email, j) => (
                    <MiniAvatar key={j} email={email} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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

// Pick the right chart for each question
function QuestionChart({ question, data, total }) {
  if (question.type === 'text') {
    return <TextResponses question={question} responses={data} />
  }

  // Radar for workflow capabilities
  if (question.id === 'q1_workflow') {
    return <RadarChart question={question} data={data || {}} total={total} />
  }

  // Donut for role and time split
  if (question.id === 'q2_role' || question.id === 'q8_time_split') {
    return <DonutChart question={question} data={data || {}} total={total} />
  }

  // Gradient scale for linear familiarity ratings and sentiment
  if (question.id === 'q5_claude_md' || question.id === 'q6_vibecoding') {
    return <GradientScale question={question} data={data || {}} total={total} />
  }

  // Default: bar chart
  return <BarChart question={question} data={data || {}} total={total} />
}

function QuestionBoardResults({ boardQuestions }) {
  if (!boardQuestions || boardQuestions.length === 0) return null

  const sorted = [...boardQuestions].sort((a, b) => (b.votes?.length || 0) - (a.votes?.length || 0))

  return (
    <div className="results-section">
      <h2 className="results-section__title">Question Board</h2>
      <div className="result-question">
        <h3 className="result-question__title">Top requested topics</h3>
        <div className="qboard-results">
          {sorted.map((q) => (
            <div key={q._id} className="qboard-result-item">
              <div className="qboard-result-votes">{q.votes?.length || 0}</div>
              <div className="qboard-result-text">{q.text}</div>
            </div>
          ))}
        </div>
      </div>
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
            q3_ai_setup: [
              'Claude Code CLI daily, Copilot for autocomplete, ChatGPT for brainstorming',
              'Cursor with Claude, sometimes ChatGPT for quick questions',
              'Claude Code in VS Code, custom MCP server for Jira',
              'Mostly Copilot, trying to switch to Claude Code',
              'Claude CLI with YOLO mode, worktrees for parallel work',
              'ChatGPT for research, Claude for coding, Copilot suggestions',
              'Just getting started with Claude Code, used Copilot before',
              'Claude Code + custom commands for our Rails patterns',
            ],
          }
          resp[q.id] = pick(texts[q.id] || [''])
        }
      } else if (q.type === 'checkbox') {
        const vals = pickN(q.options.map((o) => o.value), 1, Math.min(3, q.options.length))
        resp[q.id] = vals
      } else {
        const weights = q.options.map((_, i) => Math.max(1, q.options.length - i))
        const totalW = weights.reduce((a, b) => a + b, 0)
        let r = Math.random() * totalW
        let idx = 0
        for (let j = 0; j < weights.length; j++) {
          r -= weights[j]
          if (r <= 0) { idx = j; break }
        }
        resp[q.id] = q.options[idx].value
      }
    }
    return resp
  })
}

function generateFakeQuestions() {
  const fakeNames = ['alex', 'jordan', 'casey', 'morgan', 'taylor', 'riley', 'drew', 'sam']
  const topics = [
    'How to handle large legacy Rails codebases with Claude?',
    'Best practices for AI-generated code review',
    'MCP server setup for internal tools',
    'Cross-repo refactoring strategies',
    'How to write effective CLAUDE.md files?',
    'When to use Opus vs Sonnet?',
    'Dealing with rate limits on Max plan',
    'Security considerations with YOLO mode',
    'Testing strategies with AI-generated code',
    'How to onboard team members to Claude Code?',
  ]
  return topics.map((text, i) => ({
    _id: `fake-q-${i}`,
    text,
    email: `${fakeNames[i % fakeNames.length]}@callrail.com`,
    votes: fakeNames.slice(0, 1 + Math.floor(Math.random() * 7)).map((n) => `${n}@callrail.com`),
    createdAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
  }))
}

const RESULTS_PASSWORD = 'tyrannosaurus'

export default function Results() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('results_authed') === '1')
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)
  const [allResponses, setAllResponses] = useState(null)
  const [boardQuestions, setBoardQuestions] = useState(null)
  const [excludeTTech, setExcludeTTech] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!authed) return
    setLoading(true)
    Promise.all([fetchResults(), fetchQuestions()])
      .then(([surveyData, questionData]) => {
        setAllResponses(surveyData)
        setBoardQuestions(questionData)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [authed])

  const responses = allResponses
    ? excludeTTech
      ? allResponses.filter((r) => !r.email || !r.email.endsWith('@tyrannosaurustech.com'))
      : allResponses
    : null
  const total = responses ? responses.length : 0
  const agg = responses ? aggregateResponses(responses) : {}

  if (!authed) {
    return (
      <div className="results-page">
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
      </div>
    )
  }

  return (
    <div className="results-page">
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
            <div className="results-filters">
              <label className="filter-toggle">
                <input
                  type="checkbox"
                  checked={excludeTTech}
                  onChange={(e) => setExcludeTTech(e.target.checked)}
                />
                <span>Exclude Tyrannosaurus Tech</span>
              </label>
            </div>

            {/* Dashboard summary */}
            <div className="dashboard-summary">
              {/* Responses card with avatars */}
              <div className="summary-card summary-card--responses">
                <div className="summary-card__header">
                  <div className="summary-card__number">{total}</div>
                  <div className="summary-card__label">Responses</div>
                </div>
                {responses && responses.length > 0 && (
                  <div className="summary-card__avatars">
                    {responses
                      .filter((r) => r.email)
                      .map((r, i) => {
                        const color = getAvatarColor(r.email)
                        return (
                          <div
                            key={i}
                            className="avatar avatar--sm"
                            title={getInitials(r.email)}
                            style={{ background: color.bg, color: color.fg, borderColor: color.border }}
                          >
                            {getInitials(r.email)}
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* Time split mini donut */}
              {agg.q8_time_split && (() => {
                const cc = agg.q8_time_split.crash_course?.count || 0
                const adv = agg.q8_time_split.advanced?.count || 0
                const voted = cc + adv
                if (voted === 0) return null
                const ccPct = cc / voted
                const advPct = adv / voted
                const size = 100
                const cx = size / 2
                const cy = size / 2
                const r = 40
                const ir = 26
                // Draw two arcs: crash course and advanced
                const ccAngle = ccPct * 2 * Math.PI
                const startAngle = -Math.PI / 2
                const ccEnd = startAngle + ccAngle
                const advEnd = startAngle + 2 * Math.PI
                const ccLargeArc = ccAngle > Math.PI ? 1 : 0
                const advLargeArc = (2 * Math.PI - ccAngle) > Math.PI ? 1 : 0

                const arc = (start, end, outerR, innerR, large) => {
                  const x1o = cx + outerR * Math.cos(start)
                  const y1o = cy + outerR * Math.sin(start)
                  const x2o = cx + outerR * Math.cos(end)
                  const y2o = cy + outerR * Math.sin(end)
                  const x1i = cx + innerR * Math.cos(end)
                  const y1i = cy + innerR * Math.sin(end)
                  const x2i = cx + innerR * Math.cos(start)
                  const y2i = cy + innerR * Math.sin(start)
                  return `M${x1o},${y1o} A${outerR},${outerR} 0 ${large} 1 ${x2o},${y2o} L${x1i},${y1i} A${innerR},${innerR} 0 ${large} 0 ${x2i},${y2i} Z`
                }

                return (
                  <div className="summary-card summary-card--split">
                    <div className="summary-card__label">Wants Focus On</div>
                    <div className="split-donut">
                      <svg viewBox={`0 0 ${size} ${size}`} className="split-donut__svg">
                        {cc > 0 && <path d={arc(startAngle, ccEnd, r, ir, ccLargeArc)} fill="var(--brand-aqua)" />}
                        {adv > 0 && <path d={arc(ccEnd, advEnd, r, ir, advLargeArc)} fill="var(--brand-green)" />}
                      </svg>
                      <div className="split-donut__legend">
                        <div className="split-donut__row">
                          <span className="split-donut__swatch" style={{ background: 'var(--brand-aqua)' }} />
                          <span className="split-donut__text">Crash Course</span>
                          <span className="split-donut__val">{cc}</span>
                        </div>
                        <div className="split-donut__row">
                          <span className="split-donut__swatch" style={{ background: 'var(--brand-green)' }} />
                          <span className="split-donut__text">Advanced</span>
                          <span className="split-donut__val">{adv}</span>
                        </div>
                        {(agg.q8_time_split.equal?.count || 0) > 0 && (
                          <div className="split-donut__row split-donut__row--muted">
                            <span className="split-donut__text">{agg.q8_time_split.equal.count} said equal</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Vibe coding sentiment */}
              {agg.q6_vibecoding && (() => {
                const d = agg.q6_vibecoding
                const excited = (d.excited?.count || 0) + (d.cautious_optimism?.count || 0)
                const concerned = (d.concerned?.count || 0) + (d.opposed?.count || 0)
                const mixed = d.mixed?.count || 0
                const dominant = excited > concerned ? 'Optimistic' : concerned > excited ? 'Cautious' : 'Split'
                return (
                  <div className="summary-card">
                    <div className="summary-card__label">Vibe Coding Sentiment</div>
                    <div className="summary-card__header">
                      <div className="summary-card__number summary-card__number--sm">{dominant}</div>
                    </div>
                    <div className="sentiment-bar">
                      <div className="sentiment-bar__fill sentiment-bar__fill--green" style={{ flex: excited }} />
                      <div className="sentiment-bar__fill sentiment-bar__fill--yellow" style={{ flex: mixed }} />
                      <div className="sentiment-bar__fill sentiment-bar__fill--red" style={{ flex: concerned }} />
                    </div>
                    <div className="sentiment-legend">
                      <span>Excited {excited}</span>
                      <span>Mixed {mixed}</span>
                      <span>Concerned {concerned}</span>
                    </div>
                  </div>
                )
              })()}

              {/* Top challenge */}
              {agg.q7_challenges && (() => {
                const d = agg.q7_challenges
                const sorted = Object.entries(d)
                  .filter(([key]) => key !== 'other')
                  .sort((a, b) => b[1].count - a[1].count)
                const top = sorted[0]
                if (!top || top[1].count === 0) return null
                const q = questions.find((q) => q.id === 'q7_challenges')
                const label = q?.options.find((o) => o.value === top[0])?.label || top[0]
                return (
                  <div className="summary-card">
                    <div className="summary-card__label">Top Challenge</div>
                    <div className="summary-card__highlight">{label}</div>
                    <div className="summary-card__meta">{top[1].count} of {total} respondents</div>
                  </div>
                )
              })()}

              {/* CLAUDE.md awareness */}
              {agg.q5_claude_md && (() => {
                const d = agg.q5_claude_md
                const neverHeard = d.never_heard?.count || 0
                const heardOf = d.heard_of?.count || 0
                const newToIt = neverHeard + heardOf
                const pct = total > 0 ? Math.round((newToIt / total) * 100) : 0
                return (
                  <div className="summary-card">
                    <div className="summary-card__label">CLAUDE.md Awareness</div>
                    <div className="summary-card__header">
                      <div className="summary-card__number">{pct}%</div>
                    </div>
                    <div className="summary-card__meta">haven't set one up yet</div>
                  </div>
                )
              })()}

              {/* Questions submitted */}
              <div className="summary-card">
                <div className="summary-card__label">Questions Submitted</div>
                <div className="summary-card__header">
                  <div className="summary-card__number">{boardQuestions?.length || 0}</div>
                </div>
                <div className="summary-card__meta">topics for the workshop</div>
              </div>
            </div>

            {/* Per-section results */}
            {sections.map((section) => {
              const sectionQuestions = questions.filter((q) => q.section === section.id)
              return (
                <div key={section.id} className="results-section">
                  <h2 className="results-section__title">{section.title}</h2>
                  {sectionQuestions.map((q) => (
                    <QuestionChart key={q.id} question={q} data={agg[q.id]} total={total} />
                  ))}
                </div>
              )
            })}

            {/* Question Board */}
            <QuestionBoardResults boardQuestions={boardQuestions} />
          </>
        )}
      </main>

      <footer className="survey-footer">
        <p>Tyrannosaurus Tech &middot; Claude Code Workshop &middot; March 26, 2026</p>
      </footer>
    </div>
  )
}
