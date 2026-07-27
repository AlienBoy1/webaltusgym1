/**
 * Vercel Serverless entry — Express app as a single Function.
 * Routes: /api/* → this handler (see root vercel.json rewrites).
 */
import app from '../server/src/app.js'

export default app
