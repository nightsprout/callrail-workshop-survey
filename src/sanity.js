// Sanity.io configuration
// Replace these with your actual Sanity project values
const PROJECT_ID = import.meta.env.VITE_SANITY_PROJECT_ID || 'YOUR_PROJECT_ID'
const DATASET = import.meta.env.VITE_SANITY_DATASET || 'production'
const API_VERSION = '2021-06-07'
const WRITE_TOKEN = import.meta.env.VITE_SANITY_WRITE_TOKEN || ''

const MUTATIONS_URL = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/mutate/${DATASET}`
const QUERY_URL = `https://${PROJECT_ID}.api.sanity.io/v${API_VERSION}/data/query/${DATASET}`

export async function submitSurvey(answers) {
  const doc = {
    _type: 'surveyResponse',
    submittedAt: new Date().toISOString(),
    ...answers,
  }

  const response = await fetch(MUTATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WRITE_TOKEN}`,
    },
    body: JSON.stringify({
      mutations: [{ create: doc }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Sanity API error: ${response.status}`)
  }

  return response.json()
}

export async function fetchResults() {
  const query = encodeURIComponent('*[_type == "surveyResponse"] | order(submittedAt desc)')

  const response = await fetch(`${QUERY_URL}?query=${query}`, {
    headers: {
      Authorization: `Bearer ${WRITE_TOKEN}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Sanity API error: ${response.status}`)
  }

  const data = await response.json()
  return data.result
}

// Question Board API

export async function createQuestion(text, email) {
  const doc = {
    _type: 'workshopQuestion',
    text,
    email,
    votes: [email],
    createdAt: new Date().toISOString(),
  }

  const response = await fetch(MUTATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WRITE_TOKEN}`,
    },
    body: JSON.stringify({
      mutations: [{ create: doc }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Sanity API error: ${response.status}`)
  }

  return response.json()
}

export async function fetchQuestions() {
  const query = encodeURIComponent('*[_type == "workshopQuestion"] | order(createdAt desc)')

  const response = await fetch(`${QUERY_URL}?query=${query}`, {
    headers: {
      Authorization: `Bearer ${WRITE_TOKEN}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Sanity API error: ${response.status}`)
  }

  const data = await response.json()
  return data.result
}

export async function voteQuestion(questionId, email) {
  // Use Sanity's patch to add email to the votes array if not already present
  const response = await fetch(MUTATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WRITE_TOKEN}`,
    },
    body: JSON.stringify({
      mutations: [
        {
          patch: {
            id: questionId,
            ifRevisionID: undefined,
            setIfMissing: { votes: [] },
          },
        },
        {
          patch: {
            id: questionId,
            insert: {
              after: 'votes[-1]',
              items: [email],
            },
          },
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Sanity API error: ${response.status}`)
  }

  return response.json()
}

export async function unvoteQuestion(questionId, email) {
  // Fetch the current document to find the vote to remove
  const query = encodeURIComponent(`*[_id == "${questionId}"][0]`)
  const getResponse = await fetch(`${QUERY_URL}?query=${query}`, {
    headers: {
      Authorization: `Bearer ${WRITE_TOKEN}`,
    },
  })

  if (!getResponse.ok) {
    throw new Error(`Sanity API error: ${getResponse.status}`)
  }

  const { result: doc } = await getResponse.json()
  if (!doc || !doc.votes) return

  const newVotes = doc.votes.filter((v) => v !== email)

  const response = await fetch(MUTATIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WRITE_TOKEN}`,
    },
    body: JSON.stringify({
      mutations: [
        {
          patch: {
            id: questionId,
            set: { votes: newVotes },
          },
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Sanity API error: ${response.status}`)
  }

  return response.json()
}
