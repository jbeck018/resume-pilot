import DOMPurify from 'isomorphic-dompurify';

/**
 * Configuration options for HTML sanitization
 */
interface SanitizeConfig {
	ALLOWED_TAGS?: string[];
	ALLOWED_ATTR?: string[];
	ALLOWED_URI_REGEXP?: RegExp;
	ALLOW_DATA_ATTR?: boolean;
	ADD_ATTR?: string[];
	FORBID_ATTR?: string[];
	FORBID_TAGS?: string[];
}

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @param options - Optional sanitization configuration
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(
	html: string,
	options?: SanitizeConfig
): string {
	const defaultConfig: SanitizeConfig = {
		ALLOWED_TAGS: [
			'p', 'br', 'strong', 'em', 'u', 'b', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
			'ul', 'ol', 'li', 'a', 'span', 'div', 'blockquote', 'pre', 'code',
			'table', 'thead', 'tbody', 'tr', 'th', 'td'
		],
		ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
		ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
		ALLOW_DATA_ATTR: false,
		// Ensure links open in new tab and have noopener noreferrer for security
		ADD_ATTR: ['target', 'rel'],
		// Remove potentially dangerous attributes
		FORBID_ATTR: ['onerror', 'onload', 'onclick'],
		FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
	};

	const config = { ...defaultConfig, ...options };

	// DOMPurify.sanitize returns TrustedHTML in some environments, convert to string
	const result = DOMPurify.sanitize(html, config);
	return typeof result === 'string' ? result : String(result);
}

/**
 * Sanitizes HTML and preserves line breaks by converting \n to <br>
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML with line breaks preserved
 */
export function sanitizeHtmlWithLineBreaks(html: string): string {
	// First sanitize, then replace newlines with <br> tags
	const sanitized = sanitizeHtml(html);
	return sanitized.replace(/\n/g, '<br>');
}
