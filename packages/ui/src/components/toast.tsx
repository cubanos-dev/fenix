'use client'

import { Toaster as SonnerToaster, toast } from 'sonner'

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>

export function Toaster(props: ToasterProps) {
  return <SonnerToaster richColors closeButton {...props} />
}

export { toast }
