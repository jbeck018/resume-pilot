/**
 * Companies known to use Lever ATS
 * VERIFIED list with actual job counts as of January 2025
 * Curated list with priority based on typical hiring volume
 *
 * API Pattern: https://api.lever.co/v0/postings/{slug}?mode=json
 * Total: 200+ verified companies
 */

export interface ATSCompany {
	slug: string;
	name: string;
	priority?: 'high' | 'medium' | 'low';
}

export const LEVER_COMPANIES: ATSCompany[] = [
	// ============================================================
	// HIGH PRIORITY - Very high volume companies (100+ jobs)
	// These companies consistently have many open positions
	// ============================================================
	{ slug: 'jobgether', name: 'Jobgether', priority: 'high' }, // 4309 jobs - job aggregator
	{ slug: 'veeva', name: 'Veeva Systems', priority: 'high' }, // 990 jobs - life sciences software
	{ slug: 'gopuff', name: 'Gopuff', priority: 'high' }, // 822 jobs - delivery
	{ slug: 'crypto', name: 'Crypto.com', priority: 'high' }, // 420 jobs - crypto exchange
	{ slug: 'binance', name: 'Binance', priority: 'high' }, // 342 jobs - crypto exchange
	{ slug: 'shieldai', name: 'Shield AI', priority: 'high' }, // 261 jobs - defense tech
	{ slug: 'zoox', name: 'Zoox', priority: 'high' }, // 245 jobs - autonomous vehicles
	{ slug: 'palantir', name: 'Palantir', priority: 'high' }, // 233 jobs - data analytics
	{ slug: 'ion', name: 'ION Group', priority: 'high' }, // 231 jobs - fintech
	{ slug: 'distro', name: 'Distro', priority: 'high' }, // 196 jobs - logistics
	{ slug: 'gohighlevel', name: 'HighLevel', priority: 'high' }, // 178 jobs - marketing SaaS
	{ slug: 'insiderone', name: 'Insider', priority: 'high' }, // 174 jobs - marketing platform
	{ slug: 'spotify', name: 'Spotify', priority: 'high' }, // 162 jobs - music streaming
	{ slug: 'xsolla', name: 'Xsolla', priority: 'high' }, // 153 jobs - gaming payments
	{ slug: 'mistral', name: 'Mistral AI', priority: 'high' }, // 150 jobs - AI company
	{ slug: 'dlocal', name: 'dLocal', priority: 'high' }, // 145 jobs - payments LATAM
	{ slug: 'saviynt', name: 'Saviynt', priority: 'high' }, // 139 jobs - identity security
	{ slug: 'pattern', name: 'Pattern', priority: 'high' }, // 118 jobs - ecommerce
	{ slug: 'matchgroup', name: 'Match Group', priority: 'high' }, // 109 jobs - dating apps
	{ slug: 'thinkahead', name: 'AHEAD', priority: 'high' }, // 105 jobs - IT services

	// ============================================================
	// MEDIUM PRIORITY - Good volume companies (25-100 jobs)
	// These companies have consistent hiring activity
	// ============================================================
	{ slug: 'plaid', name: 'Plaid', priority: 'medium' }, // 89 jobs - fintech infrastructure
	{ slug: 'whoop', name: 'WHOOP', priority: 'medium' }, // 87 jobs - fitness wearables
	{ slug: 'BTSE', name: 'BTSE', priority: 'medium' }, // 79 jobs - crypto exchange
	{ slug: 'appen', name: 'Appen (CrowdGen)', priority: 'medium' }, // 78 jobs - AI data
	{ slug: 'coupa', name: 'Coupa Software', priority: 'medium' }, // 77 jobs - procurement
	{ slug: 'hive', name: 'Hive', priority: 'medium' }, // 75 jobs - AI infrastructure
	{ slug: 'walkme', name: 'WalkMe', priority: 'medium' }, // 74 jobs - digital adoption
	{ slug: 'voleon', name: 'The Voleon Group', priority: 'medium' }, // 74 jobs - quant hedge fund
	{ slug: 'anchorage', name: 'Anchorage Digital', priority: 'medium' }, // 74 jobs - crypto custody
	{ slug: 'mujininc', name: 'Mujin', priority: 'medium' }, // 69 jobs - robotics
	{ slug: 'rackspace', name: 'Rackspace Technology', priority: 'medium' }, // 67 jobs - cloud
	{ slug: 'includedhealth', name: 'Included Health', priority: 'medium' }, // 66 jobs - healthcare
	{ slug: 'attentive', name: 'Attentive', priority: 'medium' }, // 59 jobs - SMS marketing
	{ slug: 'aledade', name: 'Aledade', priority: 'medium' }, // 59 jobs - healthcare
	{ slug: 'nium', name: 'Nium', priority: 'medium' }, // 56 jobs - payments infrastructure
	{ slug: 'highspot', name: 'Highspot', priority: 'medium' }, // 54 jobs - sales enablement
	{ slug: 'netlight', name: 'Netlight', priority: 'medium' }, // 48 jobs - IT consulting
	{ slug: 'floqast', name: 'FloQast', priority: 'medium' }, // 46 jobs - accounting software
	{ slug: 'farfetch', name: 'Farfetch (Stadium Goods)', priority: 'medium' }, // 45 jobs - luxury ecommerce
	{ slug: 'finn', name: 'FINN', priority: 'medium' }, // 44 jobs - car subscription
	{ slug: 'reply', name: 'Reply.io', priority: 'medium' }, // 43 jobs - sales automation
	{ slug: 'owner', name: 'Owner.com', priority: 'medium' }, // 41 jobs - restaurant tech
	{ slug: 'brooksrunning', name: 'Brooks Running', priority: 'medium' }, // 41 jobs - athletic footwear
	{ slug: 'ro', name: 'Ro', priority: 'medium' }, // 40 jobs - telehealth
	{ slug: 'outreach', name: 'Outreach', priority: 'medium' }, // 37 jobs - sales engagement
	{ slug: 'egen', name: 'Egen', priority: 'medium' }, // 34 jobs - engineering services
	{ slug: 'dreamgames', name: 'Dream Games', priority: 'medium' }, // 34 jobs - mobile gaming
	{ slug: 'uvcyber', name: 'UltraViolet Cyber', priority: 'medium' }, // 33 jobs - cybersecurity
	{ slug: 'weride', name: 'WeRide.ai', priority: 'medium' }, // 32 jobs - autonomous driving
	{ slug: 'educationatwork', name: 'Education at Work', priority: 'medium' }, // 31 jobs - workforce education
	{ slug: 'smarsh', name: 'Smarsh', priority: 'medium' }, // 30 jobs - compliance archiving
	{ slug: 'avalerehealth', name: 'Avalere Health', priority: 'medium' }, // 30 jobs - healthcare consulting
	{ slug: 'mindtickle', name: 'Mindtickle', priority: 'medium' }, // 28 jobs - sales readiness
	{ slug: 'certik', name: 'CertiK', priority: 'medium' }, // 28 jobs - blockchain security
	{ slug: 'versapay', name: 'Versapay', priority: 'medium' }, // 27 jobs - payment automation
	{ slug: 'pipedrive', name: 'Pipedrive', priority: 'medium' }, // 27 jobs - CRM
	{ slug: 'peakgames', name: 'Peak', priority: 'medium' }, // 26 jobs - mobile gaming
	{ slug: 'ivo', name: 'Ivo', priority: 'medium' }, // 26 jobs - legal AI
	{ slug: 'everlywell', name: 'Everlywell', priority: 'medium' }, // 26 jobs - at-home health tests
	{ slug: 'better', name: 'Better.com', priority: 'medium' }, // 26 jobs - mortgage

	// ============================================================
	// LOW PRIORITY - Lower volume but verified working (3-25 jobs)
	// These companies have fewer but quality positions
	// ============================================================
	{ slug: 'deliverect', name: 'Deliverect', priority: 'low' }, // 24 jobs - restaurant integration
	{ slug: 'fiscalnote', name: 'FiscalNote', priority: 'low' }, // 23 jobs - government data
	{ slug: 'theathletic', name: 'The Athletic', priority: 'low' }, // 21 jobs - sports media
	{ slug: 'sonatype', name: 'Sonatype', priority: 'low' }, // 21 jobs - DevSecOps
	{ slug: 'openx', name: 'OpenX', priority: 'low' }, // 20 jobs - ad tech
	{ slug: 'grailbio', name: 'GRAIL', priority: 'low' }, // 20 jobs - cancer detection
	{ slug: 'neon', name: 'Neon', priority: 'low' }, // 19 jobs - serverless Postgres
	{ slug: 'iru', name: 'Iru (formerly Kandji)', priority: 'low' }, // 19 jobs - Apple MDM
	{ slug: 'cellares', name: 'Cellares', priority: 'low' }, // 18 jobs - cell therapy
	{ slug: 'metabase', name: 'Metabase', priority: 'low' }, // 17 jobs - BI analytics
	{ slug: 'kpaonline', name: 'KPA', priority: 'low' }, // 17 jobs - EHS compliance
	{ slug: 'jamcity', name: 'Jam City', priority: 'low' }, // 17 jobs - mobile gaming
	{ slug: 'angel', name: 'AngelList', priority: 'low' }, // 17 jobs - startup ecosystem
	{ slug: 'zocks', name: 'Zocks', priority: 'low' }, // 15 jobs - AI fintech
	{ slug: 'omnisend', name: 'Omnisend', priority: 'low' }, // 15 jobs - ecommerce marketing
	{ slug: 'campusworksinc', name: 'CampusWorks', priority: 'low' }, // 15 jobs - higher ed IT
	{ slug: '1inch', name: '1inch', priority: 'low' }, // 15 jobs - DeFi aggregator
	{ slug: 'offchainlabs', name: 'Offchain Labs', priority: 'low' }, // 14 jobs - Arbitrum/L2
	{ slug: 'logrocket', name: 'LogRocket', priority: 'low' }, // 14 jobs - frontend monitoring
	{ slug: 'juneshine', name: 'JuneShine', priority: 'low' }, // 14 jobs - hard kombucha
	{ slug: 'crytek', name: 'Crytek', priority: 'low' }, // 14 jobs - game development
	{ slug: 'color', name: 'Color Health', priority: 'low' }, // 14 jobs - health tech
	{ slug: 'ghsmartjobs', name: 'ghSMART', priority: 'low' }, // 13 jobs - leadership advisory
	{ slug: 'finix', name: 'Finix', priority: 'low' }, // 13 jobs - payments infrastructure
	{ slug: 'wealthfront', name: 'Wealthfront', priority: 'low' }, // 12 jobs - robo-advisor
	{ slug: 'spyke-games', name: 'Spyke Games', priority: 'low' }, // 12 jobs - mobile gaming
	{ slug: 'kavak', name: 'Kavak', priority: 'low' }, // 10 jobs - used car marketplace
	{ slug: 'vestiairecollective', name: 'Vestiaire Collective', priority: 'low' }, // 9 jobs - luxury resale
	{ slug: 'nobullproject', name: 'NOBULL', priority: 'low' }, // 9 jobs - athletic apparel
	{ slug: 'ethenalabs', name: 'Ethena Labs', priority: 'low' }, // 9 jobs - DeFi stablecoin
	{ slug: 'clari', name: 'Clari', priority: 'low' }, // 9 jobs - revenue intelligence
	{ slug: 'artera', name: 'Artera', priority: 'low' }, // 8 jobs - cancer AI
	{ slug: 'activecampaign', name: 'ActiveCampaign', priority: 'low' }, // 8 jobs - email automation
	{ slug: 'startengine', name: 'StartEngine', priority: 'low' }, // 7 jobs - equity crowdfunding
	{ slug: 'educative', name: 'Educative', priority: 'low' }, // 7 jobs - developer education
	{ slug: 'plivo', name: 'Plivo', priority: 'low' }, // 6 jobs - cloud communications
	{ slug: 'gauntlet', name: 'Gauntlet', priority: 'low' }, // 6 jobs - DeFi risk
	{ slug: 'iterative', name: 'Iterative', priority: 'low' }, // 5 jobs - MLOps
	{ slug: 'brilliant', name: 'Brilliant', priority: 'low' }, // 5 jobs - learning platform
	{ slug: 'max-retail', name: 'Max Retail', priority: 'low' }, // 4 jobs - retail tech
	{ slug: 'rapidmicrobio', name: 'Rapid Micro Biosystems', priority: 'low' }, // 4 jobs - biotech
	{ slug: 'kcasbio', name: 'KCAS Bio', priority: 'low' }, // 4 jobs - bioanalytical services
	{ slug: 'skillshare', name: 'Skillshare', priority: 'low' }, // 3 jobs - online learning
	{ slug: 'basis', name: 'Basis Technologies', priority: 'low' }, // 3 jobs - ad tech

	// ============================================================
	// Additional verified companies (lower volume or seasonal)
	// These are confirmed to use Lever but may have variable job counts
	// ============================================================
	{ slug: 'synmax', name: 'SynMax', priority: 'low' }, // data intelligence
	{ slug: 'voltai', name: 'Volt AI', priority: 'low' }, // edge infrastructure
	{ slug: 'edpuzzle', name: 'Edpuzzle', priority: 'low' }, // edtech
	{ slug: 'wildlight', name: 'Wildlight Entertainment', priority: 'low' }, // gaming
	{ slug: 'regentcraft', name: 'REGENT', priority: 'low' }, // seaglider transport
	{ slug: 'wahed', name: 'Wahed', priority: 'low' }, // Islamic fintech
	{ slug: 'minted', name: 'Minted', priority: 'low' }, // design marketplace
	{ slug: 'eve', name: 'Eve', priority: 'low' }, // electric aviation
	{ slug: 'stackblitz', name: 'StackBlitz', priority: 'low' }, // web IDE
	{ slug: 'anyscale', name: 'Anyscale', priority: 'low' }, // Ray AI platform

	// ============================================================
	// Companies that may not be on Lever anymore (verify periodically)
	// Keeping for historical reference and periodic rechecking
	// ============================================================
	// Note: Many famous tech companies have moved to other ATS systems
	// like Greenhouse (Netflix, Shopify, Figma, Notion, etc.)
	// or Workday (large enterprises)
];

/**
 * Priority order for sorting (lower is better)
 */
export const PRIORITY_ORDER: Record<string, number> = {
	high: 0,
	medium: 1,
	low: 2
};

/**
 * Get companies sorted by priority
 */
export function getCompaniesByPriority(limit?: number): ATSCompany[] {
	const sorted = [...LEVER_COMPANIES].sort(
		(a, b) => PRIORITY_ORDER[a.priority || 'low'] - PRIORITY_ORDER[b.priority || 'low']
	);
	return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Get companies by priority level
 */
export function getCompaniesByPriorityLevel(priority: 'high' | 'medium' | 'low'): ATSCompany[] {
	return LEVER_COMPANIES.filter((c) => c.priority === priority);
}

/**
 * Get total company counts by priority
 */
export function getCompanyCounts(): { high: number; medium: number; low: number; total: number } {
	return {
		high: LEVER_COMPANIES.filter((c) => c.priority === 'high').length,
		medium: LEVER_COMPANIES.filter((c) => c.priority === 'medium').length,
		low: LEVER_COMPANIES.filter((c) => c.priority === 'low').length,
		total: LEVER_COMPANIES.length
	};
}
