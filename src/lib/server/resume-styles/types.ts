/**
 * Resume Style Type Definitions
 * Defines the structure for resume style configurations
 */

// ============================================================================
// Section Configuration
// ============================================================================

export type SectionId =
	| 'contact'
	| 'summary'
	| 'experience'
	| 'education'
	| 'skills'
	| 'projects'
	| 'certifications'
	| 'publications'
	| 'awards'
	| 'activities'
	| 'languages'
	| 'interests'
	| 'references'
	| 'portfolio'
	| 'achievements'
	| 'leadership'
	| 'board_positions'
	| 'research'
	| 'presentations'
	| 'teaching'
	| 'service'
	| 'coursework'
	| 'job_info'; // Federal-specific

export interface SectionConfig {
	id: SectionId;
	name: string;
	required: boolean;
	order: number;
	/** Whether this section should be prominent (larger, highlighted) */
	prominent?: boolean;
	/** Maximum number of items to show (for lists) */
	maxItems?: number;
	/** Custom formatting instructions for LLM */
	formatInstructions?: string;
	/** Subsections within this section */
	subsections?: string[];
}

// ============================================================================
// Typography Configuration
// ============================================================================

export type FontFamily =
	| 'georgia'
	| 'garamond'
	| 'times'
	| 'inter'
	| 'roboto'
	| 'helvetica'
	| 'arial'
	| 'calibri'
	| 'montserrat'
	| 'open-sans'
	| 'lato'
	| 'system';

export interface TypographyConfig {
	/** Primary font for body text */
	bodyFont: FontFamily;
	/** Font for headings (can be same as body) */
	headingFont: FontFamily;
	/** Base font size in points */
	baseFontSize: number;
	/** Line height multiplier */
	lineHeight: number;
	/** Heading sizes relative to base */
	headingSizes: {
		h1: number;
		h2: number;
		h3: number;
	};
	/** Use bold for headings */
	boldHeadings: boolean;
	/** Use uppercase for section headings */
	uppercaseHeadings: boolean;
}

// ============================================================================
// Color Configuration
// ============================================================================

export interface ColorConfig {
	/** Primary text color */
	primary: string;
	/** Secondary/muted text color */
	secondary: string;
	/** Accent color for highlights, links, section headers */
	accent: string;
	/** Background color */
	background: string;
	/** Border/divider color */
	border: string;
	/** Whether to use colored section headers */
	coloredHeaders: boolean;
}

// ============================================================================
// Layout Configuration
// ============================================================================

export type LayoutType = 'single-column' | 'two-column' | 'sidebar' | 'hybrid';

export interface LayoutConfig {
	/** Overall layout type */
	type: LayoutType;
	/** Page margins in inches */
	margins: {
		top: number;
		right: number;
		bottom: number;
		left: number;
	};
	/** Space between sections */
	sectionSpacing: number;
	/** Maximum pages (1-2 typically, CV can be more) */
	maxPages: number;
	/** Use horizontal rules between sections */
	useHorizontalRules: boolean;
	/** Bullet point style */
	bulletStyle: 'disc' | 'circle' | 'square' | 'dash' | 'none';
	/** Date format preference */
	dateFormat: 'full' | 'short' | 'month-year' | 'year-only';
	/** Contact info layout */
	contactLayout: 'horizontal' | 'vertical' | 'centered' | 'split';
}

// ============================================================================
// Experience Level
// ============================================================================

export type ExperienceLevel = 'entry' | 'mid' | 'senior' | 'executive';

// ============================================================================
// Industry Categories
// ============================================================================

export type Industry =
	| 'corporate'
	| 'finance'
	| 'legal'
	| 'consulting'
	| 'tech'
	| 'startup'
	| 'software'
	| 'data'
	| 'design'
	| 'marketing'
	| 'media'
	| 'creative'
	| 'executive'
	| 'leadership'
	| 'engineering'
	| 'it'
	| 'cybersecurity'
	| 'academic'
	| 'research'
	| 'education'
	| 'government'
	| 'federal'
	| 'military'
	| 'nonprofit'
	| 'healthcare'
	| 'entry'
	| 'student'
	| 'recent-grad';

// ============================================================================
// Main Resume Style Interface
// ============================================================================

export interface ResumeStyle {
	/** Unique identifier */
	id: string;
	/** Display name */
	name: string;
	/** Short description */
	description: string;
	/** Detailed description for tooltip/help */
	longDescription?: string;
	/** Industries this style is best suited for */
	industries: Industry[];
	/** Experience levels this style works well for */
	experienceLevels: ExperienceLevel[];
	/** Section configurations in order */
	sections: SectionConfig[];
	/** Typography settings */
	typography: TypographyConfig;
	/** Color palette */
	colors: ColorConfig;
	/** Layout configuration */
	layout: LayoutConfig;
	/** Is this style ATS-optimized */
	atsOptimized: boolean;
	/** Special formatting instructions for LLM */
	formatInstructions: string;
	/** Preview image path */
	previewImage: string;
	/** Tags for filtering */
	tags: string[];
	/** Is this a premium style (requires subscription) */
	premium: boolean;
}

// ============================================================================
// Style Selection Context
// ============================================================================

export interface StyleSelectionContext {
	/** User's industry preference */
	industry?: Industry;
	/** User's experience level */
	experienceLevel?: ExperienceLevel;
	/** Job title applying for */
	jobTitle?: string;
	/** Company name */
	companyName?: string;
	/** Job description keywords */
	keywords?: string[];
	/** User's subscription tier */
	subscriptionTier?: 'free' | 'pro' | 'premium';
}

// ============================================================================
// Style Recommendation
// ============================================================================

export interface StyleRecommendation {
	styleId: string;
	score: number;
	reasons: string[];
}

// ============================================================================
// Generated Resume Metadata
// ============================================================================

export interface GeneratedResumeMetadata {
	styleId: string;
	styleName: string;
	generatedAt: string;
	sectionsIncluded: SectionId[];
	pageCount: number;
	wordCount: number;
	atsScore?: number;
}
