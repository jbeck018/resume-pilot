import Root from './badge.svelte';
import { tv, type VariantProps } from 'tailwind-variants';

const badgeVariants = tv({
	base: 'focus:ring-ring inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
	variants: {
		variant: {
			default: 'bg-primary text-primary-foreground border-transparent shadow',
			secondary: 'bg-secondary text-secondary-foreground border-transparent',
			destructive: 'bg-destructive text-destructive-foreground border-transparent shadow',
			outline: 'text-foreground'
		}
	},
	defaultVariants: {
		variant: 'default'
	}
});

type Variant = VariantProps<typeof badgeVariants>['variant'];

type Props = {
	variant?: Variant;
};

export { Root, type Props, Root as Badge, badgeVariants, type Props as BadgeProps };
