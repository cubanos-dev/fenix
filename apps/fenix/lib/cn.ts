// Re-export from @fenix/ui — single source of the cn helper. The local
// implementation lived here while packages/ui was being scaffolded; that
// export is now stable, so all callers ride the design-system version.
export { cn } from '@fenix/ui/lib/cn'
