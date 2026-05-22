import * as path from 'node:path'
import { runMigrations } from '@fenix/db/migrator'

await runMigrations(path.join(import.meta.dirname, 'migrations'))
