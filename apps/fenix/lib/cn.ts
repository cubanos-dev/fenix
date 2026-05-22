/**
 * Local cn() — apps/fenix uses the @fenix/ui cn export when it stabilises,
 * but during the build we keep a tiny local copy to keep the layout
 * dependency-light.
 */

import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
