/**
 * GET /PUT /api/state — koloni-layouten.
 * Vercel-funktioner har inget persistent filsystem; returnerar ett tomt tillstånd
 * vid GET och bekräftar PUT utan att spara (layouten lever bara i webbläsaren).
 */
const emptyState = () => ({
  version: 2,
  archived: [],
  archivedAt: {},
  opened: [],
  plots: {},
  seen: {},
  hiddenProjects: [],
  viewedAt: {},
  settings: null,
  updatedAt: 0,
})

export default async function handler(req, res) {
  if (req.method === 'GET') return res.status(200).json(emptyState())
  if (req.method === 'PUT') return res.status(200).json({ ...emptyState(), updatedAt: Date.now() })
  return res.status(405).json({ error: 'Method Not Allowed' })
}
