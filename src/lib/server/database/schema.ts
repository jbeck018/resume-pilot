import {
	pgTable,
	uuid,
	text,
	timestamp,
	jsonb,
	varchar,
	boolean,
	integer,
	vector,
	index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================================================
// User Roles (defined early for use in profiles table)
// ============================================================================

export type UserRole = 'user' | 'admin' | 'root_admin';

// ============================================================================
// User Profile
// ============================================================================

export const profiles = pgTable('profiles', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull().unique(), // References Supabase auth.users
	email: varchar('email', { length: 255 }).notNull(),

	// Basic info
	fullName: varchar('full_name', { length: 255 }),
	headline: varchar('headline', { length: 500 }),
	summary: text('summary'),
	location: varchar('location', { length: 255 }),

	// External profiles
	linkedinUrl: varchar('linkedin_url', { length: 500 }),
	githubHandle: varchar('github_handle', { length: 100 }),

	// Parsed profile data (from LinkedIn, GitHub, etc.)
	skills: jsonb('skills').$type<string[]>().default([]),
	experience: jsonb('experience').$type<ExperienceItem[]>().default([]),
	education: jsonb('education').$type<EducationItem[]>().default([]),

	// Job preferences
	preferredRoles: jsonb('preferred_roles').$type<string[]>().default([]),
	preferredLocations: jsonb('preferred_locations').$type<string[]>().default([]),
	remotePreference: varchar('remote_preference', { length: 50 }).default('hybrid'), // remote, hybrid, onsite
	minSalary: integer('min_salary'),
	maxSalary: integer('max_salary'),

	// Resume style preference
	preferredResumeStyle: varchar('preferred_resume_style', { length: 50 }).default('classic'),

	// Email notification preferences
	emailPreferences: jsonb('email_preferences').$type<EmailPreferences>().default({
		jobMatches: true,
		resumeReady: true,
		weeklySummary: true,
		applicationUpdates: true,
		marketingEmails: false
	}),

	// User role (user, admin, root_admin)
	role: varchar('role', { length: 20 }).$type<UserRole>().notNull().default('user'),

	// Profile embedding for job matching (1536 dimensions for OpenAI embeddings)
	embedding: vector('embedding', { dimensions: 1536 }),

	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ============================================================================
// Resumes
// ============================================================================

export const resumes = pgTable('resumes', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull(), // References Supabase auth.users
	profileId: uuid('profile_id')
		.notNull()
		.references(() => profiles.id, { onDelete: 'cascade' }),

	// Resume metadata
	name: varchar('name', { length: 255 }).notNull().default('My Resume'),
	isDefault: boolean('is_default').default(false),

	// Original file
	originalFileUrl: varchar('original_file_url', { length: 1000 }),
	originalFileName: varchar('original_file_name', { length: 255 }),
	originalFileType: varchar('original_file_type', { length: 50 }), // pdf, docx, txt

	// Parsed content
	parsedContent: text('parsed_content'), // Plain text extracted from file
	structuredData: jsonb('structured_data').$type<ResumeStructuredData>(),

	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ============================================================================
// Jobs
// ============================================================================

export const jobs = pgTable(
	'jobs',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id').notNull(), // References Supabase auth.users

		// Job identification (for deduplication)
		externalId: varchar('external_id', { length: 500 }), // ID from source
		source: varchar('source', { length: 100 }).notNull(), // adzuna, muse, greenhouse, lever, etc.
		sourceUrl: varchar('source_url', { length: 1000 }).notNull(),

		// Job details
		title: varchar('title', { length: 500 }).notNull(),
		company: varchar('company', { length: 255 }).notNull(),
		companyLogo: varchar('company_logo', { length: 1000 }),
		location: varchar('location', { length: 255 }),
		isRemote: boolean('is_remote').default(false),

		// Job content
		description: text('description'),
		requirements: jsonb('requirements').$type<string[]>(),
		benefits: jsonb('benefits').$type<string[]>(),
		salaryMin: integer('salary_min'),
		salaryMax: integer('salary_max'),
		salaryCurrency: varchar('salary_currency', { length: 10 }).default('USD'),

		// Job metadata
		employmentType: varchar('employment_type', { length: 50 }), // full-time, part-time, contract
		experienceLevel: varchar('experience_level', { length: 50 }), // entry, mid, senior, lead

		// Matching
		matchScore: integer('match_score'), // 0-100 relevance score
		matchReasons: jsonb('match_reasons').$type<string[]>(), // Why this job was matched

		// Job embedding for similarity search
		embedding: vector('embedding', { dimensions: 1536 }),

		// Status
		status: varchar('status', { length: 50 }).notNull().default('pending'),
		// pending, reviewing, applied, interview, offer, rejected, not_relevant, saved

		// User feedback (for learning)
		userFeedback: varchar('user_feedback', { length: 50 }), // good_match, bad_match, null
		feedbackReason: text('feedback_reason'),

		// Application tracking dates (from migration 0002)
		interviewDate: timestamp('interview_date', { withTimezone: true }),
		offerDate: timestamp('offer_date', { withTimezone: true }),
		rejectionDate: timestamp('rejection_date', { withTimezone: true }),
		notes: text('notes'),

		// ATS score and keyword tracking
		atsScore: integer('ats_score'),
		keywordsMatched: jsonb('keywords_matched').$type<string[]>().default([]),
		keywordsMissing: jsonb('keywords_missing').$type<string[]>().default([]),

		// Skills gap analysis
		matchedSkills: jsonb('matched_skills').$type<string[]>().default([]),
		missingRequiredSkills: jsonb('missing_required_skills').$type<string[]>().default([]),
		missingPreferredSkills: jsonb('missing_preferred_skills').$type<string[]>().default([]),

		// Match score breakdown for detailed analysis
		matchScoreBreakdown: jsonb('match_score_breakdown').$type<MatchScoreBreakdown>(),

		// Timestamps
		postedAt: timestamp('posted_at', { withTimezone: true }),
		discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
		appliedAt: timestamp('applied_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('jobs_user_id_idx').on(table.userId),
		index('jobs_status_idx').on(table.status),
		index('jobs_source_external_id_idx').on(table.source, table.externalId)
	]
);

// ============================================================================
// Job Applications (generated resumes and cover letters)
// ============================================================================

export const jobApplications = pgTable('job_applications', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull(),
	jobId: uuid('job_id')
		.notNull()
		.references(() => jobs.id, { onDelete: 'cascade' }),
	resumeId: uuid('resume_id').references(() => resumes.id, { onDelete: 'set null' }),

	// Generated content
	tailoredResume: text('tailored_resume'), // Markdown or HTML
	tailoredResumeUrl: varchar('tailored_resume_url', { length: 1000 }), // PDF download link
	coverLetter: text('cover_letter'),

	// Resume style
	resumeStyle: varchar('resume_style', { length: 50 }).default('classic'),
	resumeStyleName: varchar('resume_style_name', { length: 100 }),

	// Generation metadata
	generationModel: varchar('generation_model', { length: 100 }), // claude-3, gpt-4, etc.
	generationPrompt: text('generation_prompt'), // For debugging/improvement
	generationCost: integer('generation_cost'), // In cents

	// Status
	status: varchar('status', { length: 50 }).notNull().default('generating'),
	// generating, ready, sent, error

	errorMessage: text('error_message'),

	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ============================================================================
// Search History (for learning and avoiding duplicates)
// ============================================================================

export const searchHistory = pgTable('search_history', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull(),

	// Search parameters
	query: text('query'),
	filters: jsonb('filters').$type<SearchFilters>(),
	source: varchar('source', { length: 100 }).notNull(),

	// Results
	jobsFound: integer('jobs_found').default(0),
	jobsNew: integer('jobs_new').default(0), // Jobs not seen before
	jobsMatched: integer('jobs_matched').default(0), // Jobs matching profile

	// Timing
	executedAt: timestamp('executed_at', { withTimezone: true }).defaultNow().notNull(),
	durationMs: integer('duration_ms')
});

// ============================================================================
// Workflow Runs (Inngest tracking)
// ============================================================================

export const workflowRuns = pgTable('workflow_runs', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull(),

	// Workflow identification
	workflowType: varchar('workflow_type', { length: 100 }).notNull(),
	// daily_job_discovery, resume_generation, profile_sync
	inngestRunId: varchar('inngest_run_id', { length: 255 }),

	// Status
	status: varchar('status', { length: 50 }).notNull().default('pending'),
	// pending, running, completed, failed

	// Results
	result: jsonb('result'),
	errorMessage: text('error_message'),

	// Timing
	startedAt: timestamp('started_at', { withTimezone: true }),
	completedAt: timestamp('completed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// ============================================================================
// Relations
// ============================================================================

export const profilesRelations = relations(profiles, ({ many }) => ({
	resumes: many(resumes),
	jobs: many(jobs)
}));

export const resumesRelations = relations(resumes, ({ one }) => ({
	profile: one(profiles, {
		fields: [resumes.profileId],
		references: [profiles.id]
	})
}));

export const jobsRelations = relations(jobs, ({ many }) => ({
	applications: many(jobApplications)
}));

export const jobApplicationsRelations = relations(jobApplications, ({ one }) => ({
	job: one(jobs, {
		fields: [jobApplications.jobId],
		references: [jobs.id]
	}),
	resume: one(resumes, {
		fields: [jobApplications.resumeId],
		references: [resumes.id]
	})
}));

// ============================================================================
// Types
// ============================================================================

export type ExperienceItem = {
	title: string;
	company: string;
	location?: string;
	startDate: string;
	endDate?: string;
	current: boolean;
	description?: string;
	skills?: string[];
};

export type EducationItem = {
	institution: string;
	degree: string;
	field?: string;
	startDate?: string;
	endDate?: string;
	gpa?: string;
};

export type ResumeStructuredData = {
	name?: string;
	email?: string;
	phone?: string;
	summary?: string;
	skills?: string[];
	experience?: ExperienceItem[];
	education?: EducationItem[];
	certifications?: string[];
	projects?: { name: string; description: string; url?: string }[];
};

export type SearchFilters = {
	roles?: string[];
	locations?: string[];
	remote?: boolean;
	salaryMin?: number;
	salaryMax?: number;
	experienceLevels?: string[];
};

export type MatchScoreBreakdown = {
	skills?: { score: number; matched: string[]; missing: string[] };
	experience?: { score: number; relevance: string };
	education?: { score: number; relevance: string };
	location?: { score: number; compatible: boolean };
	salary?: { score: number; inRange: boolean };
};

export type EmailPreferences = {
	jobMatches: boolean;
	resumeReady: boolean;
	weeklySummary: boolean;
	applicationUpdates: boolean;
	marketingEmails: boolean;
};

// ============================================================================
// Subscription Tiers
// ============================================================================

export const subscriptionTiers = pgTable('subscription_tiers', {
	id: uuid('id').primaryKey().defaultRandom(),

	// Tier identification
	name: varchar('name', { length: 50 }).notNull().unique(), // free, pro, premium
	displayName: varchar('display_name', { length: 100 }).notNull(),
	description: text('description'),

	// Pricing (in cents)
	priceMonthly: integer('price_monthly').notNull().default(0),
	priceYearly: integer('price_yearly').notNull().default(0),

	// Stripe product/price IDs
	stripeProductId: varchar('stripe_product_id', { length: 255 }),
	stripePriceMonthlyId: varchar('stripe_price_monthly_id', { length: 255 }),
	stripePriceYearlyId: varchar('stripe_price_yearly_id', { length: 255 }),

	// Limits
	generationLimitWeekly: integer('generation_limit_weekly').notNull(), // -1 for unlimited
	jobDiscoveryLimitDaily: integer('job_discovery_limit_daily').notNull().default(-1),

	// Features (JSONB for flexibility)
	features: jsonb('features').$type<TierFeatures>().notNull().default({}),

	// Display
	badgeText: varchar('badge_text', { length: 50 }),
	sortOrder: integer('sort_order').notNull().default(0),
	isActive: boolean('is_active').notNull().default(true),

	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ============================================================================
// User Subscriptions
// ============================================================================

export const userSubscriptions = pgTable('user_subscriptions', {
	id: uuid('id').primaryKey().defaultRandom(),
	userId: uuid('user_id').notNull().unique(), // References Supabase auth.users
	tierId: uuid('tier_id')
		.notNull()
		.references(() => subscriptionTiers.id),

	// Subscription status
	status: varchar('status', { length: 50 }).notNull().default('active'),
	// active, canceled, past_due, incomplete, trialing, paused

	// Stripe integration
	stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
	stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
	stripePriceId: varchar('stripe_price_id', { length: 255 }),

	// Billing period
	billingInterval: varchar('billing_interval', { length: 20 }).default('monthly'),
	currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
	currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

	// Trial info
	trialStart: timestamp('trial_start', { withTimezone: true }),
	trialEnd: timestamp('trial_end', { withTimezone: true }),

	// Cancellation
	cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
	canceledAt: timestamp('canceled_at', { withTimezone: true }),
	cancellationReason: text('cancellation_reason'),

	// Metadata
	metadata: jsonb('metadata').default({}),

	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// ============================================================================
// Usage Tracking
// ============================================================================

export const usageTracking = pgTable(
	'usage_tracking',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id').notNull(), // References Supabase auth.users

		// Period (week boundaries in UTC)
		periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
		periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

		// Usage counters
		generationsUsed: integer('generations_used').notNull().default(0),
		jobsDiscovered: integer('jobs_discovered').notNull().default(0),
		apiCalls: integer('api_calls').notNull().default(0),

		// Detailed tracking
		usageDetails: jsonb('usage_details').$type<UsageDetails>().default({}),

		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [index('usage_tracking_user_period_idx').on(table.userId, table.periodStart)]
);

// ============================================================================
// Subscription Events (Audit Log)
// ============================================================================

export const subscriptionEvents = pgTable(
	'subscription_events',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id').notNull(), // References Supabase auth.users

		// Event info
		eventType: varchar('event_type', { length: 100 }).notNull(),
		// subscription_created, subscription_updated, subscription_canceled,
		// payment_succeeded, payment_failed, trial_started, trial_ended,
		// tier_upgraded, tier_downgraded, usage_limit_reached

		// Related data
		subscriptionId: uuid('subscription_id').references(() => userSubscriptions.id, {
			onDelete: 'set null'
		}),
		stripeEventId: varchar('stripe_event_id', { length: 255 }),

		// Event data
		data: jsonb('data').notNull().default({}),

		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('subscription_events_user_idx').on(table.userId, table.createdAt),
		index('subscription_events_stripe_idx').on(table.stripeEventId)
	]
);

// ============================================================================
// Subscription Relations
// ============================================================================

export const subscriptionTiersRelations = relations(subscriptionTiers, ({ many }) => ({
	subscriptions: many(userSubscriptions)
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one, many }) => ({
	tier: one(subscriptionTiers, {
		fields: [userSubscriptions.tierId],
		references: [subscriptionTiers.id]
	}),
	events: many(subscriptionEvents)
}));

export const subscriptionEventsRelations = relations(subscriptionEvents, ({ one }) => ({
	subscription: one(userSubscriptions, {
		fields: [subscriptionEvents.subscriptionId],
		references: [userSubscriptions.id]
	})
}));

// ============================================================================
// Subscription Types
// ============================================================================

export type TierFeatures = {
	resume_styles?: string[];
	api_access?: boolean;
	white_label?: boolean;
	priority_support?: boolean;
	custom_branding?: boolean;
	advanced_analytics?: boolean;
	cover_letter?: boolean;
	job_matching?: boolean;
	ats_optimization?: boolean;
	linkedin_optimization?: boolean;
	interview_prep?: boolean;
	salary_negotiation?: boolean;
	career_coaching?: boolean;
};

export type UsageDetails = {
	generation_timestamps?: string[];
	by_day?: Record<string, number>;
};

export type SubscriptionStatus =
	| 'active'
	| 'canceled'
	| 'past_due'
	| 'incomplete'
	| 'trialing'
	| 'paused';

export type BillingInterval = 'monthly' | 'yearly';

export type SubscriptionEventType =
	| 'subscription_created'
	| 'subscription_updated'
	| 'subscription_canceled'
	| 'payment_succeeded'
	| 'payment_failed'
	| 'trial_started'
	| 'trial_ended'
	| 'tier_upgraded'
	| 'tier_downgraded'
	| 'usage_limit_reached';

// ============================================================================
// Invited Users
// ============================================================================

export const invitedUsers = pgTable(
	'invited_users',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		// Invitation details
		email: varchar('email', { length: 255 }).notNull(),
		role: varchar('role', { length: 20 }).notNull().default('user').$type<UserRole>(),
		token: varchar('token', { length: 255 }).notNull().unique(),

		// Inviter info
		invitedBy: uuid('invited_by').notNull(), // References auth.users
		invitedByEmail: varchar('invited_by_email', { length: 255 }),

		// Status tracking
		status: varchar('status', { length: 20 }).notNull().default('pending').$type<InvitationStatus>(),

		// Timestamps
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		acceptedAt: timestamp('accepted_at', { withTimezone: true }),
		acceptedBy: uuid('accepted_by'), // References auth.users

		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('invited_users_email_idx').on(table.email),
		index('invited_users_token_idx').on(table.token),
		index('invited_users_status_idx').on(table.status),
		index('invited_users_invited_by_idx').on(table.invitedBy)
	]
);

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

// ============================================================================
// Waitlist
// ============================================================================

export const waitlist = pgTable(
	'waitlist',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		// Contact info
		email: varchar('email', { length: 255 }).notNull().unique(),
		fullName: varchar('full_name', { length: 255 }),

		// Source tracking
		source: varchar('source', { length: 100 }), // 'pricing_page', 'landing_page', 'referral', etc.
		referralCode: varchar('referral_code', { length: 100 }), // If referred by someone

		// Priority for invitation (higher = more priority)
		priority: integer('priority').notNull().default(0),

		// Notes (internal use)
		notes: text('notes'),

		// Timestamps
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		notifiedAt: timestamp('notified_at', { withTimezone: true }), // When invitation was sent
		convertedAt: timestamp('converted_at', { withTimezone: true }) // When they signed up
	},
	(table) => [
		index('waitlist_email_idx').on(table.email),
		index('waitlist_source_idx').on(table.source),
		index('waitlist_priority_idx').on(table.priority),
		index('waitlist_created_at_idx').on(table.createdAt)
	]
);

// ============================================================================
// Admin Activity Log
// ============================================================================

export const adminActivityLog = pgTable(
	'admin_activity_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		// Who performed the action
		adminId: uuid('admin_id').notNull(), // References profiles.id
		adminEmail: varchar('admin_email', { length: 255 }),

		// Action details
		action: varchar('action', { length: 100 }).notNull(),
		// e.g., 'invite_user', 'change_role', 'approve_waitlist', 'revoke_access'

		// Target of the action
		targetType: varchar('target_type', { length: 50 }), // 'user', 'invitation', 'waitlist_entry'
		targetId: uuid('target_id'),
		targetEmail: varchar('target_email', { length: 255 }),

		// Additional details as JSON
		details: jsonb('details').$type<AdminActivityDetails>().default({}),

		// Request context
		ipAddress: varchar('ip_address', { length: 45 }),
		userAgent: text('user_agent'),

		// Timestamp
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
	},
	(table) => [
		index('admin_activity_admin_id_idx').on(table.adminId),
		index('admin_activity_action_idx').on(table.action),
		index('admin_activity_created_at_idx').on(table.createdAt),
		index('admin_activity_target_idx').on(table.targetType, table.targetId)
	]
);

export type AdminActivityDetails = {
	previousValue?: unknown;
	newValue?: unknown;
	reason?: string;
	metadata?: Record<string, unknown>;
};

export type AdminAction =
	| 'invite_user'
	| 'revoke_invitation'
	| 'change_role'
	| 'approve_waitlist'
	| 'remove_waitlist'
	| 'update_user'
	| 'delete_user'
	| 'system_setting_change';
