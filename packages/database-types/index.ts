// Re-export database types from the SvelteKit app as the single source of truth.
// Workers and other packages import from here to get compile-time column checking.
export type {
	Database,
	Json,
	TierFeatures,
	UsageDetails,
	SubscriptionStatus,
	BillingInterval,
	SubscriptionEventType,
	EmailPreferences,
	AttributeWeight,
	LearnedPreferences,
	SubscriptionWithTier,
	UsageLimitResult,
	UserRole,
	InvitationStatus,
	AdminAction,
	AdminActivityDetails
} from '../../src/lib/server/database/types';
