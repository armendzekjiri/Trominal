import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge Tailwind class names while resolving conflicts (the standard shadcn
 * helper). Pulled into one place so we don't ship multiple copies.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
