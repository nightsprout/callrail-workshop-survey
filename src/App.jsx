import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { questions, sections } from './questions'
import { submitSurvey } from './sanity'
import logo from './assets/logo-symbol.png'
import './App.css'

function QuestionBlock({ question, value, onChange, otherValue, onOtherChange }) {
  if (question.type === 'text') {
    return (
      <div className="question">
        <label className="question__title">
          {question.title}
          {question.optional ? <span className="question__optional"> (optional)</span> : <span className="question__required"> *</span>}
        </label>
        <textarea
          className="question__textarea"
          value={value || ''}
          onChange={(e) => onChange(question.id, e.target.value)}
          rows={3}
          placeholder="Type your answer..."
        />
      </div>
    )
  }

  const isCheckbox = question.type === 'checkbox'
  const currentValues = isCheckbox ? (value || []) : value
  const hasOther = question.options.some((o) => o.value === 'other')
  const otherSelected = isCheckbox
    ? (currentValues || []).includes('other')
    : currentValues === 'other'

  function handleChange(optionValue) {
    if (isCheckbox) {
      const arr = currentValues || []
      if (arr.includes(optionValue)) {
        onChange(question.id, arr.filter((v) => v !== optionValue))
      } else {
        if (question.max && arr.length >= question.max) return
        onChange(question.id, [...arr, optionValue])
      }
    } else {
      onChange(question.id, optionValue)
    }
  }

  return (
    <div className="question">
      <div className="question__title">
        {question.title}
        {!question.optional && <span className="question__required"> *</span>}
      </div>
      {question.hint && <div className="question__hint">{question.hint}</div>}
      <div className="question__options">
        {question.options.map((opt) => {
          const selected = isCheckbox
            ? (currentValues || []).includes(opt.value)
            : currentValues === opt.value
          const disabled = isCheckbox && question.max && !selected && (currentValues || []).length >= question.max

          return (
            <label
              key={opt.value}
              className={`option ${selected ? 'option--selected' : ''} ${disabled ? 'option--disabled' : ''}`}
            >
              <input
                type={isCheckbox ? 'checkbox' : 'radio'}
                name={question.id}
                value={opt.value}
                checked={selected}
                disabled={disabled}
                onChange={() => handleChange(opt.value)}
              />
              <span className="option__content">
                <span className="option__label">{opt.label}</span>
                {opt.desc && <span className="option__desc">{opt.desc}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {hasOther && otherSelected && (
        <input
          type="text"
          className="question__other-input"
          value={otherValue || ''}
          onChange={(e) => onOtherChange(question.id + '_other', e.target.value)}
          placeholder="Please specify..."
          autoFocus
        />
      )}
    </div>
  )
}

const ALLOWED_DOMAINS = ['callrail.com', 'tyrannosaurustech.com']

function validateEmail(email) {
  if (!email || !email.trim()) return 'Email is required'
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain || !ALLOWED_DOMAINS.includes(domain)) {
    return 'Please use your @callrail.com or @tyrannosaurustech.com email'
  }
  return null
}

export default function App() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const emailError = emailTouched ? validateEmail(email) : null

  function handleChange(questionId, value) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Validate email
    setEmailTouched(true)
    const emailErr = validateEmail(email)
    if (emailErr) {
      setError(emailErr)
      return
    }

    // Validate required fields
    const required = questions.filter((q) => !q.optional)
    const missing = required.filter((q) => {
      const val = answers[q.id]
      if (q.type === 'checkbox') return !val || val.length === 0
      return !val
    })

    if (missing.length > 0) {
      setError(`Please answer all required questions: ${missing.map((q) => q.title).join(', ')}`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await submitSurvey({ email: email.trim().toLowerCase(), ...answers })
      navigate('/results')
    } catch (err) {
      setError(`Failed to submit: ${err.message}. Your answers have been saved locally.`)
      setSubmitting(false)
    }
  }

  return (
    <>
      <header className="survey-header">
        <div className="survey-header__inner">
          <img src={logo} alt="T-Rex Tech" className="survey-header__logo" />
          <span className="survey-header__title">Claude Code Workshop</span>
          <nav className="results-nav">
            <Link to="/results">View Results</Link>
          </nav>
        </div>
      </header>

      <div className="survey-hero">
        <div className="survey-hero__inner">
          <h1>Pre-Workshop Survey</h1>
          <p>Help us tailor the workshop to you. Takes about 5 minutes.</p>
        </div>
      </div>

      <main className="survey-content">
        <form onSubmit={handleSubmit}>
          <div className="survey-section">
            <div className="question">
              <label className="question__title" htmlFor="email">
                Work Email <span className="question__required">*</span>
              </label>
              <input
                id="email"
                type="email"
                className={`question__input ${emailError ? 'question__input--error' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                placeholder="you@callrail.com"
              />
              {emailError && <div className="question__field-error">{emailError}</div>}
            </div>
          </div>

          {sections.map((section) => {
            const sectionQuestions = questions.filter((q) => q.section === section.id)
            return (
              <div key={section.id} className="survey-section">
                <h2 className="survey-section__title">{section.title}</h2>
                {sectionQuestions.map((q) => (
                  <QuestionBlock
                    key={q.id}
                    question={q}
                    value={answers[q.id]}
                    onChange={handleChange}
                    otherValue={answers[q.id + '_other']}
                    onOtherChange={handleChange}
                  />
                ))}
              </div>
            )
          })}

          {error && <div className="survey-error">{error}</div>}

          <button type="submit" className="survey-submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Survey'}
          </button>
        </form>
      </main>

      <footer className="survey-footer">
        <p>Tyrannosaurus Tech &middot; Claude Code Workshop &middot; March 26, 2026</p>
      </footer>
    </>
  )
}
