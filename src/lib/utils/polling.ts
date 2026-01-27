import { invalidateAll } from '$app/navigation';
import { onDestroy } from 'svelte';

export interface PollingOptions {
	/** Interval in ms when actively processing (default: 5000) */
	fastInterval?: number;
	/** Interval in ms for general updates (default: 30000) */
	slowInterval?: number;
	/** Whether to poll faster (e.g., when background jobs are running) */
	isProcessing?: boolean;
}

/**
 * Creates a smart polling mechanism that:
 * - Polls faster when isProcessing is true
 * - Pauses when tab is hidden
 * - Resumes and refreshes when tab becomes visible
 * - Cleans up on component destroy
 */
export function createPolling(options: PollingOptions = {}) {
	const { fastInterval = 5000, slowInterval = 30000 } = options;

	let pollInterval: ReturnType<typeof setInterval> | null = null;
	let lastPollTime = Date.now();
	let isProcessing = options.isProcessing ?? false;

	function getInterval() {
		return isProcessing ? fastInterval : slowInterval;
	}

	function start() {
		stop();
		pollInterval = setInterval(async () => {
			if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
				lastPollTime = Date.now();
				await invalidateAll();
			}
		}, getInterval());
	}

	function stop() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	function setProcessing(processing: boolean) {
		if (isProcessing !== processing) {
			isProcessing = processing;
			start(); // Restart with new interval
		}
	}

	function handleVisibilityChange() {
		if (typeof document === 'undefined') return;

		if (document.visibilityState === 'visible') {
			// Refresh immediately if it's been more than slowInterval since last poll
			if (Date.now() - lastPollTime > slowInterval) {
				invalidateAll();
			}
			start();
		} else {
			stop();
		}
	}

	// Initialize
	if (typeof document !== 'undefined') {
		document.addEventListener('visibilitychange', handleVisibilityChange);
		start();
	}

	// Return cleanup and control functions
	return {
		stop,
		start,
		setProcessing,
		destroy() {
			stop();
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', handleVisibilityChange);
			}
		}
	};
}
