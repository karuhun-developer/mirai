import { cva, type VariantProps } from 'class-variance-authority'

export { default as Badge } from './Badge.vue'

export const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border-border text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        /** Jumlah chapter/episode belum dibaca — pojok kiri-atas cover. */
        unread: 'bg-unread text-unread-foreground',
        /** Penanda item yang sudah tersimpan offline. */
        downloaded: 'bg-downloaded text-primary-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export type BadgeVariants = VariantProps<typeof badgeVariants>
