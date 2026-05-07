import { cva } from 'class-variance-authority'

/**
 * Button styling tokens shared between the `Button` component and any
 * non-button elements (e.g. `<Link>`) that want to opt into the same look.
 * Lives in its own file so React Fast Refresh can correctly cache the
 * `Button` component module.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'text-[13px] font-medium leading-none transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
        outline:
          'border border-border-strong bg-transparent text-fg hover:bg-surface-2 hover:border-fg-faint',
        ghost: 'bg-transparent text-fg hover:bg-surface-2',
        danger: 'bg-danger text-white hover:opacity-90',
        link: 'h-auto p-0 text-accent underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-7 px-2.5',
        md: 'h-8 px-3',
        lg: 'h-10 px-4',
      },
      full: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      full: false,
    },
  },
)
