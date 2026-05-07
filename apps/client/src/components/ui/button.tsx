import { Slot } from '@radix-ui/react-slot'
import { type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/cn'
import { buttonVariants } from './button-variants'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, full, asChild = false, ...props },
  ref,
) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant, size, full }), className)} ref={ref} {...props} />
  )
})
