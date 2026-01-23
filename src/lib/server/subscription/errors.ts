/**
 * Subscription Errors
 *
 * Custom error classes for subscription-related operations
 */

export class SubscriptionError extends Error {
	constructor(
		message: string,
		public code: string,
		public statusCode: number = 400
	) {
		super(message);
		this.name = 'SubscriptionError';
	}
}

export class UsageLimitExceededError extends SubscriptionError {
	constructor(
		public remaining: number,
		public limit: number,
		public resetsAt: Date
	) {
		super(
			`Usage limit exceeded. You have ${remaining} of ${limit} generations remaining. Resets at ${resetsAt.toISOString()}`,
			'USAGE_LIMIT_EXCEEDED',
			429
		);
		this.name = 'UsageLimitExceededError';
	}
}

export class SubscriptionNotFoundError extends SubscriptionError {
	constructor(userId: string) {
		super(`No subscription found for user ${userId}`, 'SUBSCRIPTION_NOT_FOUND', 404);
		this.name = 'SubscriptionNotFoundError';
	}
}

export class TierNotFoundError extends SubscriptionError {
	constructor(tierId: string) {
		super(`Subscription tier ${tierId} not found`, 'TIER_NOT_FOUND', 404);
		this.name = 'TierNotFoundError';
	}
}

export class InvalidBillingIntervalError extends SubscriptionError {
	constructor(interval: string) {
		super(`Invalid billing interval: ${interval}`, 'INVALID_BILLING_INTERVAL', 400);
		this.name = 'InvalidBillingIntervalError';
	}
}

export class StripeCustomerNotFoundError extends SubscriptionError {
	constructor(userId: string) {
		super(`No Stripe customer found for user ${userId}`, 'STRIPE_CUSTOMER_NOT_FOUND', 404);
		this.name = 'StripeCustomerNotFoundError';
	}
}

export class StripeWebhookError extends SubscriptionError {
	constructor(message: string) {
		super(message, 'STRIPE_WEBHOOK_ERROR', 400);
		this.name = 'StripeWebhookError';
	}
}

export class SubscriptionInactiveError extends SubscriptionError {
	constructor(status: string) {
		super(`Subscription is not active. Current status: ${status}`, 'SUBSCRIPTION_INACTIVE', 403);
		this.name = 'SubscriptionInactiveError';
	}
}
