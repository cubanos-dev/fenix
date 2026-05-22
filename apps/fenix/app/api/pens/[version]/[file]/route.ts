/**
 * Pen PNG passthrough — serves pens/exports/<version>/<file>.png from
 * the repo root. Used by /versions/<v> to inline pen exports.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function repoRoot(): string {
  return process.env.FENIX_REPO_ROOT ?? resolve(process.cwd(), '../..')
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ version: string; file: string }> },
): Promise<Response> {
  const { version, file } = await ctx.params

  // Path-traversal guard.
  if (!/^[a-z][a-z0-9-]*$/.test(version) || !/^[A-Za-z0-9._-]+\.png$/.test(file)) {
    return new Response('bad path', { status: 400 })
  }

  const path = resolve(repoRoot(), 'pens', 'exports', version, file)
  if (!existsSync(path)) {
    return new Response('not found', { status: 404 })
  }
  const bytes = readFileSync(path)
  return new Response(bytes, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'no-cache',
    },
  })
}
