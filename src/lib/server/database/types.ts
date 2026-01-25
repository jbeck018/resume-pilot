// Generated Supabase types for the client SDK
// This provides type safety for Supabase queries

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					user_id: string;
					email: string;
					full_name: string | null;
					headline: string | null;
					summary: string | null;
					location: string | null;
					linkedin_url: string | null;
					github_handle: string | null;
					skills: string[];
					experience: Json;
					education: Json;
					preferred_roles: string[];
					preferred_locations: string[];
					remote_preference: string;
					min_salary: number | null;
					max_salary: number | null;
					preferred_resume_style: string;
					role: UserRole;
					embedding: number[] | null;
					onboarding_completed: boolean;
					ideal_job_description: string | null;
					portfolio_urls: string[];
					email_preferences: EmailPreferences;
					learned_preferences: LearnedPreferences | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					email: string;
					full_name?: string | null;
					headline?: string | null;
					summary?: string | null;
					location?: string | null;
					linkedin_url?: string | null;
					github_handle?: string | null;
					skills?: string[];
					experience?: Json;
					education?: Json;
					preferred_roles?: string[];
					preferred_locations?: string[];
					remote_preference?: string;
					min_salary?: number | null;
					max_salary?: number | null;
					preferred_resume_style?: string;
					role?: UserRole;
					embedding?: number[] | null;
					onboarding_completed?: boolean;
					ideal_job_description?: string | null;
					portfolio_urls?: string[];
					email_preferences?: EmailPreferences;
					learned_preferences?: LearnedPreferences | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					email?: string;
					full_name?: string | null;
					headline?: string | null;
					summary?: string | null;
					location?: string | null;
					linkedin_url?: string | null;
					github_handle?: string | null;
					skills?: string[];
					experience?: Json;
					education?: Json;
					preferred_roles?: string[];
					preferred_locations?: string[];
					remote_preference?: string;
					min_salary?: number | null;
					max_salary?: number | null;
					preferred_resume_style?: string;
					role?: UserRole;
					embedding?: number[] | null;
					onboarding_completed?: boolean;
					ideal_job_description?: string | null;
					portfolio_urls?: string[];
					email_preferences?: EmailPreferences;
					learned_preferences?: LearnedPreferences | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			resumes: {
				Row: {
					id: string;
					user_id: string;
					profile_id: string;
					name: string;
					is_default: boolean;
					original_file_url: string | null;
					original_file_name: string | null;
					original_file_type: string | null;
					parsed_content: string | null;
					structured_data: Json | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					profile_id: string;
					name?: string;
					is_default?: boolean;
					original_file_url?: string | null;
					original_file_name?: string | null;
					original_file_type?: string | null;
					parsed_content?: string | null;
					structured_data?: Json | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					profile_id?: string;
					name?: string;
					is_default?: boolean;
					original_file_url?: string | null;
					original_file_name?: string | null;
					original_file_type?: string | null;
					parsed_content?: string | null;
					structured_data?: Json | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			jobs: {
				Row: {
					id: string;
					user_id: string;
					external_id: string | null;
					source: string;
					source_url: string;
					title: string;
					company: string;
					company_logo: string | null;
					location: string | null;
					is_remote: boolean;
					description: string | null;
					requirements: string[] | null;
					benefits: string[] | null;
					salary_min: number | null;
					salary_max: number | null;
					salary_currency: string;
					employment_type: string | null;
					experience_level: string | null;
					match_score: number | null;
					match_reasons: string[] | null;
					embedding: number[] | null;
					status: string;
					user_feedback: string | null;
					feedback_reason: string | null;
					posted_at: string | null;
					discovered_at: string;
					applied_at: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					external_id?: string | null;
					source: string;
					source_url: string;
					title: string;
					company: string;
					company_logo?: string | null;
					location?: string | null;
					is_remote?: boolean;
					description?: string | null;
					requirements?: string[] | null;
					benefits?: string[] | null;
					salary_min?: number | null;
					salary_max?: number | null;
					salary_currency?: string;
					employment_type?: string | null;
					experience_level?: string | null;
					match_score?: number | null;
					match_reasons?: string[] | null;
					embedding?: number[] | null;
					status?: string;
					user_feedback?: string | null;
					feedback_reason?: string | null;
					posted_at?: string | null;
					discovered_at?: string;
					applied_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					external_id?: string | null;
					source?: string;
					source_url?: string;
					title?: string;
					company?: string;
					company_logo?: string | null;
					location?: string | null;
					is_remote?: boolean;
					description?: string | null;
					requirements?: string[] | null;
					benefits?: string[] | null;
					salary_min?: number | null;
					salary_max?: number | null;
					salary_currency?: string;
					employment_type?: string | null;
					experience_level?: string | null;
					match_score?: number | null;
					match_reasons?: string[] | null;
					embedding?: number[] | null;
					status?: string;
					user_feedback?: string | null;
					feedback_reason?: string | null;
					posted_at?: string | null;
					discovered_at?: string;
					applied_at?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			job_applications: {
				Row: {
					id: string;
					user_id: string;
					job_id: string;
					resume_id: string | null;
					tailored_resume: string | null;
					tailored_resume_url: string | null;
					cover_letter: string | null;
					resume_style: string;
					resume_style_name: string | null;
					generation_model: string | null;
					generation_prompt: string | null;
					generation_cost: number | null;
					status: string;
					error_message: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					job_id: string;
					resume_id?: string | null;
					tailored_resume?: string | null;
					tailored_resume_url?: string | null;
					cover_letter?: string | null;
					resume_style?: string;
					resume_style_name?: string | null;
					generation_model?: string | null;
					generation_prompt?: string | null;
					generation_cost?: number | null;
					status?: string;
					error_message?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					job_id?: string;
					resume_id?: string | null;
					tailored_resume?: string | null;
					tailored_resume_url?: string | null;
					cover_letter?: string | null;
					resume_style?: string;
					resume_style_name?: string | null;
					generation_model?: string | null;
					generation_prompt?: string | null;
					generation_cost?: number | null;
					status?: string;
					error_message?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			subscription_tiers: {
				Row: {
					id: string;
					name: string;
					display_name: string;
					description: string | null;
					price_monthly: number;
					price_yearly: number;
					stripe_product_id: string | null;
					stripe_price_monthly_id: string | null;
					stripe_price_yearly_id: string | null;
					generation_limit_weekly: number;
					job_discovery_limit_daily: number;
					features: TierFeatures;
					badge_text: string | null;
					sort_order: number;
					is_active: boolean;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					display_name: string;
					description?: string | null;
					price_monthly?: number;
					price_yearly?: number;
					stripe_product_id?: string | null;
					stripe_price_monthly_id?: string | null;
					stripe_price_yearly_id?: string | null;
					generation_limit_weekly: number;
					job_discovery_limit_daily?: number;
					features?: TierFeatures;
					badge_text?: string | null;
					sort_order?: number;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					display_name?: string;
					description?: string | null;
					price_monthly?: number;
					price_yearly?: number;
					stripe_product_id?: string | null;
					stripe_price_monthly_id?: string | null;
					stripe_price_yearly_id?: string | null;
					generation_limit_weekly?: number;
					job_discovery_limit_daily?: number;
					features?: TierFeatures;
					badge_text?: string | null;
					sort_order?: number;
					is_active?: boolean;
					created_at?: string;
					updated_at?: string;
				};
			};
			user_subscriptions: {
				Row: {
					id: string;
					user_id: string;
					tier_id: string;
					status: SubscriptionStatus;
					stripe_customer_id: string | null;
					stripe_subscription_id: string | null;
					stripe_price_id: string | null;
					billing_interval: BillingInterval;
					current_period_start: string | null;
					current_period_end: string | null;
					trial_start: string | null;
					trial_end: string | null;
					cancel_at_period_end: boolean;
					canceled_at: string | null;
					cancellation_reason: string | null;
					metadata: Json;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					tier_id: string;
					status?: SubscriptionStatus;
					stripe_customer_id?: string | null;
					stripe_subscription_id?: string | null;
					stripe_price_id?: string | null;
					billing_interval?: BillingInterval;
					current_period_start?: string | null;
					current_period_end?: string | null;
					trial_start?: string | null;
					trial_end?: string | null;
					cancel_at_period_end?: boolean;
					canceled_at?: string | null;
					cancellation_reason?: string | null;
					metadata?: Json;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					tier_id?: string;
					status?: SubscriptionStatus;
					stripe_customer_id?: string | null;
					stripe_subscription_id?: string | null;
					stripe_price_id?: string | null;
					billing_interval?: BillingInterval;
					current_period_start?: string | null;
					current_period_end?: string | null;
					trial_start?: string | null;
					trial_end?: string | null;
					cancel_at_period_end?: boolean;
					canceled_at?: string | null;
					cancellation_reason?: string | null;
					metadata?: Json;
					created_at?: string;
					updated_at?: string;
				};
			};
			usage_tracking: {
				Row: {
					id: string;
					user_id: string;
					period_start: string;
					period_end: string;
					generations_used: number;
					jobs_discovered: number;
					api_calls: number;
					usage_details: UsageDetails;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					period_start: string;
					period_end: string;
					generations_used?: number;
					jobs_discovered?: number;
					api_calls?: number;
					usage_details?: UsageDetails;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					period_start?: string;
					period_end?: string;
					generations_used?: number;
					jobs_discovered?: number;
					api_calls?: number;
					usage_details?: UsageDetails;
					created_at?: string;
					updated_at?: string;
				};
			};
			subscription_events: {
				Row: {
					id: string;
					user_id: string;
					event_type: SubscriptionEventType;
					subscription_id: string | null;
					stripe_event_id: string | null;
					data: Json;
					created_at: string;
				};
				Insert: {
					id?: string;
					user_id: string;
					event_type: SubscriptionEventType;
					subscription_id?: string | null;
					stripe_event_id?: string | null;
					data?: Json;
					created_at?: string;
				};
				Update: {
					id?: string;
					user_id?: string;
					event_type?: SubscriptionEventType;
					subscription_id?: string | null;
					stripe_event_id?: string | null;
					data?: Json;
					created_at?: string;
				};
			};
			invited_users: {
				Row: {
					id: string;
					email: string;
					role: UserRole;
					token: string;
					invited_by: string;
					invited_by_email: string | null;
					status: InvitationStatus;
					expires_at: string;
					accepted_at: string | null;
					accepted_by: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: {
					id?: string;
					email: string;
					role?: UserRole;
					token: string;
					invited_by: string;
					invited_by_email?: string | null;
					status?: InvitationStatus;
					expires_at: string;
					accepted_at?: string | null;
					accepted_by?: string | null;
					created_at?: string;
					updated_at?: string;
				};
				Update: {
					id?: string;
					email?: string;
					role?: UserRole;
					token?: string;
					invited_by?: string;
					invited_by_email?: string | null;
					status?: InvitationStatus;
					expires_at?: string;
					accepted_at?: string | null;
					accepted_by?: string | null;
					created_at?: string;
					updated_at?: string;
				};
			};
			waitlist: {
				Row: {
					id: string;
					email: string;
					full_name: string | null;
					source: string | null;
					referral_code: string | null;
					priority: number;
					notes: string | null;
					created_at: string;
					notified_at: string | null;
					converted_at: string | null;
				};
				Insert: {
					id?: string;
					email: string;
					full_name?: string | null;
					source?: string | null;
					referral_code?: string | null;
					priority?: number;
					notes?: string | null;
					created_at?: string;
					notified_at?: string | null;
					converted_at?: string | null;
				};
				Update: {
					id?: string;
					email?: string;
					full_name?: string | null;
					source?: string | null;
					referral_code?: string | null;
					priority?: number;
					notes?: string | null;
					created_at?: string;
					notified_at?: string | null;
					converted_at?: string | null;
				};
			};
			admin_activity_log: {
				Row: {
					id: string;
					admin_id: string;
					admin_email: string | null;
					action: AdminAction;
					target_type: string | null;
					target_id: string | null;
					target_email: string | null;
					details: AdminActivityDetails;
					ip_address: string | null;
					user_agent: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					admin_id: string;
					admin_email?: string | null;
					action: AdminAction;
					target_type?: string | null;
					target_id?: string | null;
					target_email?: string | null;
					details?: AdminActivityDetails;
					ip_address?: string | null;
					user_agent?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					admin_id?: string;
					admin_email?: string | null;
					action?: AdminAction;
					target_type?: string | null;
					target_id?: string | null;
					target_email?: string | null;
					details?: AdminActivityDetails;
					ip_address?: string | null;
					user_agent?: string | null;
					created_at?: string;
				};
			};
		};
		Views: {};
		Functions: {
			match_jobs: {
				Args: {
					query_embedding: number[];
					match_threshold: number;
					match_count: number;
					user_id: string;
				};
				Returns: {
					id: string;
					title: string;
					company: string;
					similarity: number;
				}[];
			};
			check_generation_limit: {
				Args: {
					target_user_id: string;
				};
				Returns: {
					can_generate: boolean;
					generations_used: number;
					generation_limit: number;
					remaining: number;
					tier_name: string;
					resets_at: string;
				}[];
			};
			increment_usage: {
				Args: {
					target_user_id: string;
					usage_type?: string;
					increment_by?: number;
				};
				Returns: {
					success: boolean;
					new_count: number;
					limit_reached: boolean;
				}[];
			};
			get_week_start: {
				Args: {
					ts?: string;
				};
				Returns: string;
			};
			get_week_end: {
				Args: {
					ts?: string;
				};
				Returns: string;
			};
			has_active_learning: {
				Args: {
					target_user_id: string;
				};
				Returns: boolean;
			};
			get_feedback_count: {
				Args: {
					target_user_id: string;
				};
				Returns: number;
			};
			get_learning_stats: {
				Args: {
					target_user_id: string;
				};
				Returns: {
					is_active: boolean;
					feedback_count: number;
					positive_count: number;
					negative_count: number;
					last_updated: string | null;
				}[];
			};
			is_admin: {
				Args: {
					user_id: string;
				};
				Returns: boolean;
			};
			is_root_admin: {
				Args: {
					user_id: string;
				};
				Returns: boolean;
			};
			get_user_role: {
				Args: {
					target_user_id: string;
				};
				Returns: UserRole;
			};
			is_email_invited: {
				Args: {
					target_email: string;
				};
				Returns: boolean;
			};
			validate_invitation_token: {
				Args: {
					token: string;
				};
				Returns: {
					valid: boolean;
					email: string;
					role: UserRole;
					invited_by_name: string | null;
				}[];
			};
			accept_invitation: {
				Args: {
					token: string;
					accepting_user_id: string;
				};
				Returns: boolean;
			};
		};
		Enums: {};
	};
}

// Subscription-related types
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

// Email notification preferences
export type EmailPreferences = {
	jobMatches: boolean;
	resumeReady: boolean;
	weeklySummary: boolean;
	applicationUpdates: boolean;
	marketingEmails: boolean;
};

// Learned preferences types (from feedback learning system)
export type AttributeWeight = {
	value: string;
	positiveCount: number;
	negativeCount: number;
	weight: number;
	confidence: number;
};

export type LearnedPreferences = {
	version: number;
	lastUpdated: string;
	feedbackCount: {
		total: number;
		positive: number;
		negative: number;
	};
	isActive: boolean;
	companies: {
		preferred: AttributeWeight[];
		avoided: AttributeWeight[];
	};
	skills: {
		preferred: AttributeWeight[];
		avoided: AttributeWeight[];
	};
	jobTypes: {
		employmentTypes: AttributeWeight[];
		experienceLevels: AttributeWeight[];
	};
	locations: {
		preferredLocations: AttributeWeight[];
		avoidedLocations: AttributeWeight[];
		remotePreference: {
			weight: number;
			confidence: number;
		};
	};
	salary: {
		preferredMinimum: number | null;
		idealRange: {
			min: number | null;
			max: number | null;
		};
		confidence: number;
	};
	titleKeywords: {
		preferred: AttributeWeight[];
		avoided: AttributeWeight[];
	};
};

// Subscription with tier info (for API responses)
export type SubscriptionWithTier = Database['public']['Tables']['user_subscriptions']['Row'] & {
	tier: Database['public']['Tables']['subscription_tiers']['Row'];
};

// Usage limit check result
export type UsageLimitResult = {
	canGenerate: boolean;
	generationsUsed: number;
	generationLimit: number;
	remaining: number;
	tierName: string;
	resetsAt: Date;
};

// User role types
export type UserRole = 'user' | 'admin' | 'root_admin';
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

// Admin activity types
export type AdminAction =
	| 'invite_user'
	| 'revoke_invitation'
	| 'change_role'
	| 'approve_waitlist'
	| 'remove_waitlist'
	| 'update_user'
	| 'delete_user'
	| 'system_setting_change';

export type AdminActivityDetails = {
	previousValue?: unknown;
	newValue?: unknown;
	reason?: string;
	metadata?: Record<string, unknown>;
};
