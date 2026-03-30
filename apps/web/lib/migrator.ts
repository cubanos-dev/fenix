import { runMigrations } from '@fenix/db/migrator'
import * as path from 'node:path'

await runMigrations(path.join(import.meta.dirname, 'migrations'))
