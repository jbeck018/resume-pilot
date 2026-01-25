/**
 * Greenhouse ATS Company Directory
 *
 * Companies verified to use Greenhouse for their job boards.
 * Prioritized by hiring volume and tech relevance.
 *
 * Priority levels based on typical job counts (verified January 2026):
 * - high: Large tech companies with frequent job postings (100+ open roles typically)
 * - medium: Mid-size companies with regular hiring (20-100 roles)
 * - low: Smaller companies or less frequent hiring (<20 roles)
 *
 * API Pattern: https://api.greenhouse.io/v1/boards/{slug}/jobs
 */

export interface ATSCompany {
	slug: string;
	name: string;
	priority: 'high' | 'medium' | 'low';
}

export const GREENHOUSE_COMPANIES: ATSCompany[] = [
	// ============================================
	// HIGH PRIORITY - Major tech companies (100+ jobs typically)
	// Verified working as of January 2026
	// ============================================

	// FAANG-adjacent / Big Tech
	{ slug: 'stripe', name: 'Stripe', priority: 'high' }, // 500+ jobs
	{ slug: 'anthropic', name: 'Anthropic', priority: 'high' }, // 450+ jobs
	{ slug: 'okta', name: 'Okta', priority: 'high' }, // 250+ jobs
	{ slug: 'toast', name: 'Toast', priority: 'high' }, // 227+ jobs
	{ slug: 'databricks', name: 'Databricks', priority: 'high' }, // 200+ jobs
	{ slug: 'cloudflare', name: 'Cloudflare', priority: 'high' }, // 200+ jobs
	{ slug: 'rocketlab', name: 'Rocket Lab', priority: 'high' }, // 200+ jobs
	{ slug: 'samsara', name: 'Samsara', priority: 'high' }, // 186+ jobs
	{ slug: 'figma', name: 'Figma', priority: 'high' }, // 168+ jobs
	{ slug: 'gleanwork', name: 'Glean', priority: 'high' }, // 158+ jobs
	{ slug: 'waymo', name: 'Waymo', priority: 'high' }, // 155+ jobs
	{ slug: 'brex', name: 'Brex', priority: 'high' }, // 152+ jobs
	{ slug: 'scaleai', name: 'Scale AI', priority: 'high' }, // 151+ jobs
	{ slug: 'airbnb', name: 'Airbnb', priority: 'high' }, // 150+ jobs
	{ slug: 'lyft', name: 'Lyft', priority: 'high' }, // 150+ jobs
	{ slug: 'verkada', name: 'Verkada', priority: 'high' }, // 150+ jobs
	{ slug: 'astranis', name: 'Astranis', priority: 'high' }, // 150+ jobs
	{ slug: 'zscaler', name: 'Zscaler', priority: 'high' }, // 150+ jobs
	{ slug: 'gitlab', name: 'GitLab', priority: 'high' }, // 146+ jobs
	{ slug: 'aurorainnovation', name: 'Aurora Innovation', priority: 'high' }, // 145+ jobs
	{ slug: 'gotion', name: 'Gotion', priority: 'high' }, // 139+ jobs
	{ slug: 'fivetran', name: 'Fivetran', priority: 'high' }, // 127+ jobs
	{ slug: 'sentinellabs', name: 'SentinelOne', priority: 'high' }, // 127+ jobs
	{ slug: 'drweng', name: 'DRW', priority: 'high' }, // 127+ jobs
	{ slug: 'robinhood', name: 'Robinhood', priority: 'high' }, // 127+ jobs
	{ slug: 'twilio', name: 'Twilio', priority: 'high' }, // 122+ jobs
	{ slug: 'asana', name: 'Asana', priority: 'high' }, // 121+ jobs
	{ slug: 'flexport', name: 'Flexport', priority: 'high' }, // 120+ jobs
	{ slug: 'pinterest', name: 'Pinterest', priority: 'high' }, // 119+ jobs
	{ slug: 'affirm', name: 'Affirm', priority: 'high' }, // 118+ jobs
	{ slug: 'andurilindustries', name: 'Anduril Industries', priority: 'high' }, // 100+ jobs
	{ slug: 'datadog', name: 'Datadog', priority: 'high' }, // 100+ jobs
	{ slug: 'instacart', name: 'Instacart', priority: 'high' }, // 100+ jobs
	{ slug: 'ripple', name: 'Ripple', priority: 'high' }, // 100+ jobs
	{ slug: 'carta', name: 'Carta', priority: 'high' }, // 100+ jobs
	{ slug: 'elastic', name: 'Elastic', priority: 'high' }, // 100+ jobs
	{ slug: 'gusto', name: 'Gusto', priority: 'high' }, // 101+ jobs
	{ slug: 'spacex', name: 'SpaceX', priority: 'high' }, // 100+ jobs
	{ slug: 'coinbase', name: 'Coinbase', priority: 'high' }, // 100+ jobs

	// ============================================
	// MEDIUM PRIORITY - Growing tech companies (20-100 jobs)
	// Verified working as of January 2026
	// ============================================

	// Tech & Software
	{ slug: 'mozilla', name: 'Mozilla', priority: 'medium' }, // 97+ jobs
	{ slug: 'c3iot', name: 'C3 AI', priority: 'medium' }, // 93+ jobs
	{ slug: 'nuro', name: 'Nuro', priority: 'medium' }, // 92+ jobs
	{ slug: 'benchling', name: 'Benchling', priority: 'medium' }, // 75+ jobs
	{ slug: 'grafanalabs', name: 'Grafana Labs', priority: 'medium' }, // 75+ jobs
	{ slug: 'cargurus', name: 'CarGurus', priority: 'medium' }, // 73+ jobs
	{ slug: 'discord', name: 'Discord', priority: 'medium' }, // 70+ jobs
	{ slug: 'mongodb', name: 'MongoDB', priority: 'medium' }, // 70+ jobs
	{ slug: 'amplitude', name: 'Amplitude', priority: 'medium' }, // 69+ jobs
	{ slug: 'duolingo', name: 'Duolingo', priority: 'medium' }, // 63+ jobs
	{ slug: 'gemini', name: 'Gemini', priority: 'medium' }, // 61+ jobs
	{ slug: 'dropbox', name: 'Dropbox', priority: 'medium' }, // 60+ jobs
	{ slug: 'reddit', name: 'Reddit', priority: 'medium' }, // 60+ jobs
	{ slug: 'squarespace', name: 'Squarespace', priority: 'medium' }, // 59+ jobs
	{ slug: 'twitch', name: 'Twitch', priority: 'medium' }, // 59+ jobs
	{ slug: 'tripadvisor', name: 'Tripadvisor', priority: 'medium' }, // 55+ jobs
	{ slug: 'webflow', name: 'Webflow', priority: 'medium' }, // 54+ jobs
	{ slug: 'newrelic', name: 'New Relic', priority: 'medium' }, // 53+ jobs
	{ slug: 'opendoor', name: 'Opendoor', priority: 'medium' }, // 52+ jobs
	{ slug: 'sofi', name: 'SoFi', priority: 'medium' }, // 50+ jobs
	{ slug: 'airtable', name: 'Airtable', priority: 'medium' }, // 49+ jobs
	{ slug: 'pagerduty', name: 'PagerDuty', priority: 'medium' }, // 48+ jobs
	{ slug: 'chime', name: 'Chime', priority: 'medium' }, // 48+ jobs
	{ slug: 'checkr', name: 'Checkr', priority: 'medium' }, // 48+ jobs
	{ slug: 'pendo', name: 'Pendo', priority: 'medium' }, // 41+ jobs
	{ slug: 'caylent', name: 'Caylent', priority: 'medium' }, // 39+ jobs
	{ slug: 'peloton', name: 'Peloton', priority: 'medium' }, // 38+ jobs
	{ slug: 'fastly', name: 'Fastly', priority: 'medium' }, // 36+ jobs
	{ slug: 'mixpanel', name: 'Mixpanel', priority: 'medium' }, // 32+ jobs
	{ slug: 'corelight', name: 'Corelight', priority: 'medium' }, // 31+ jobs
	{ slug: 'betterment', name: 'Betterment', priority: 'medium' }, // 27+ jobs
	{ slug: 'heygen', name: 'HeyGen', priority: 'medium' }, // 25+ jobs
	{ slug: 'cockroachlabs', name: 'Cockroach Labs', priority: 'medium' }, // 25+ jobs
	{ slug: 'bayasystems', name: 'Baya Systems', priority: 'medium' }, // 22+ jobs
	{ slug: 'marqeta', name: 'Marqeta', priority: 'medium' }, // 21+ jobs
	{ slug: 'metronome', name: 'Metronome', priority: 'medium' }, // 20+ jobs

	// ============================================
	// LOW PRIORITY - Smaller companies (<20 jobs) or unverified
	// Some verified, some may need different slugs
	// ============================================

	// Verified working with low job counts
	{ slug: 'calendly', name: 'Calendly', priority: 'low' }, // 18+ jobs
	{ slug: 'voxmedia', name: 'Vox Media', priority: 'low' }, // 12+ jobs
	{ slug: 'builtin', name: 'Built In', priority: 'low' }, // 5+ jobs
	{ slug: 'zenrows', name: 'ZenRows', priority: 'low' }, // 5+ jobs
	{ slug: 'anellophotonics', name: 'Anello Photonics', priority: 'low' }, // 3+ jobs
	{ slug: 'retool', name: 'Retool', priority: 'low' }, // 2+ jobs
	{ slug: 'mercari', name: 'Mercari', priority: 'low' }, // 1+ jobs
	{ slug: 'allbirds', name: 'Allbirds', priority: 'low' }, // 1+ jobs

	// Companies with known Greenhouse usage (may need slug verification)
	// Fintech & Payments
	{ slug: 'plaid', name: 'Plaid', priority: 'medium' },
	{ slug: 'ramp', name: 'Ramp', priority: 'medium' },
	{ slug: 'klarna', name: 'Klarna', priority: 'medium' },
	{ slug: 'wise', name: 'Wise', priority: 'medium' },
	{ slug: 'revolut', name: 'Revolut', priority: 'medium' },
	{ slug: 'nubank', name: 'Nubank', priority: 'medium' },

	// Developer Tools
	{ slug: 'vercel', name: 'Vercel', priority: 'medium' },
	{ slug: 'supabase', name: 'Supabase', priority: 'medium' },
	{ slug: 'linear', name: 'Linear', priority: 'medium' },
	{ slug: 'planetscale', name: 'PlanetScale', priority: 'low' },
	{ slug: 'railway', name: 'Railway', priority: 'low' },
	{ slug: 'render', name: 'Render', priority: 'low' },
	{ slug: 'neon', name: 'Neon', priority: 'low' },
	{ slug: 'turso', name: 'Turso', priority: 'low' },
	{ slug: 'deno', name: 'Deno', priority: 'low' },
	{ slug: 'bun', name: 'Bun', priority: 'low' },
	{ slug: 'fly', name: 'Fly.io', priority: 'low' },

	// AI / ML Companies
	{ slug: 'cohere', name: 'Cohere', priority: 'medium' },
	{ slug: 'huggingface', name: 'Hugging Face', priority: 'medium' },
	{ slug: 'replicate', name: 'Replicate', priority: 'medium' },
	{ slug: 'anyscale', name: 'Anyscale', priority: 'medium' },
	{ slug: 'weights-and-biases', name: 'Weights & Biases', priority: 'medium' },
	{ slug: 'stability', name: 'Stability AI', priority: 'medium' },
	{ slug: 'runway', name: 'Runway', priority: 'medium' },
	{ slug: 'midjourney', name: 'Midjourney', priority: 'medium' },
	{ slug: 'perplexity', name: 'Perplexity', priority: 'medium' },
	{ slug: 'character', name: 'Character.AI', priority: 'medium' },
	{ slug: 'adept', name: 'Adept', priority: 'medium' },
	{ slug: 'inflection', name: 'Inflection AI', priority: 'medium' },
	{ slug: 'covariant', name: 'Covariant', priority: 'medium' },
	{ slug: 'figureai', name: 'Figure AI', priority: 'medium' },

	// Autonomous Vehicles & Aerospace
	{ slug: 'cruise', name: 'Cruise', priority: 'medium' },
	{ slug: 'zoox', name: 'Zoox', priority: 'medium' },
	{ slug: 'argo', name: 'Argo AI', priority: 'medium' },
	{ slug: 'motional', name: 'Motional', priority: 'medium' },
	{ slug: 'pony', name: 'Pony.ai', priority: 'medium' },
	{ slug: 'tusimple', name: 'TuSimple', priority: 'medium' },
	{ slug: 'relativityspace', name: 'Relativity Space', priority: 'medium' },
	{ slug: 'spire', name: 'Spire Global', priority: 'medium' },
	{ slug: 'planet', name: 'Planet Labs', priority: 'medium' },
	{ slug: 'boom-supersonic', name: 'Boom Supersonic', priority: 'medium' },
	{ slug: 'joby', name: 'Joby Aviation', priority: 'medium' },
	{ slug: 'archer', name: 'Archer Aviation', priority: 'medium' },
	{ slug: 'zipline', name: 'Zipline', priority: 'medium' },

	// Enterprise Software
	{ slug: 'hashicorp', name: 'HashiCorp', priority: 'medium' },
	{ slug: 'confluent', name: 'Confluent', priority: 'medium' },
	{ slug: 'snowflake', name: 'Snowflake', priority: 'high' },
	{ slug: 'dbtlabs', name: 'dbt Labs', priority: 'medium' },
	{ slug: 'temporal', name: 'Temporal', priority: 'medium' },
	{ slug: 'pulumi', name: 'Pulumi', priority: 'medium' },
	{ slug: 'harness', name: 'Harness', priority: 'medium' },
	{ slug: 'launchdarkly', name: 'LaunchDarkly', priority: 'medium' },
	{ slug: 'circleci', name: 'CircleCI', priority: 'medium' },
	{ slug: 'snyk', name: 'Snyk', priority: 'medium' },
	{ slug: 'jfrog', name: 'JFrog', priority: 'medium' },
	{ slug: 'split', name: 'Split', priority: 'low' },
	{ slug: 'dagster', name: 'Dagster', priority: 'low' },
	{ slug: 'prefect', name: 'Prefect', priority: 'low' },
	{ slug: 'airbyte', name: 'Airbyte', priority: 'low' },
	{ slug: 'meltano', name: 'Meltano', priority: 'low' },

	// Data & Analytics
	{ slug: 'segment', name: 'Segment', priority: 'medium' },
	{ slug: 'hightouch', name: 'Hightouch', priority: 'medium' },
	{ slug: 'census', name: 'Census', priority: 'low' },
	{ slug: 'rudderstack', name: 'RudderStack', priority: 'low' },
	{ slug: 'heap', name: 'Heap', priority: 'low' },
	{ slug: 'posthog', name: 'PostHog', priority: 'low' },
	{ slug: 'june', name: 'June', priority: 'low' },
	{ slug: 'koala', name: 'Koala', priority: 'low' },
	{ slug: 'mode', name: 'Mode', priority: 'low' },
	{ slug: 'hex', name: 'Hex', priority: 'low' },
	{ slug: 'preset', name: 'Preset', priority: 'low' },
	{ slug: 'clickhouse', name: 'ClickHouse', priority: 'medium' },
	{ slug: 'materialize', name: 'Materialize', priority: 'low' },
	{ slug: 'singlestore', name: 'SingleStore', priority: 'low' },
	{ slug: 'yugabyte', name: 'Yugabyte', priority: 'low' },
	{ slug: 'timescale', name: 'Timescale', priority: 'low' },

	// Consumer & Marketplace
	{ slug: 'doordash', name: 'DoorDash', priority: 'high' },
	{ slug: 'faire', name: 'Faire', priority: 'medium' },
	{ slug: 'servicetitan', name: 'ServiceTitan', priority: 'medium' },
	{ slug: 'procore', name: 'Procore', priority: 'medium' },
	{ slug: 'qualtrics', name: 'Qualtrics', priority: 'medium' },
	{ slug: 'medallia', name: 'Medallia', priority: 'medium' },
	{ slug: 'sprinklr', name: 'Sprinklr', priority: 'medium' },
	{ slug: 'braze', name: 'Braze', priority: 'medium' },
	{ slug: 'iterable', name: 'Iterable', priority: 'medium' },
	{ slug: 'sendgrid', name: 'SendGrid', priority: 'medium' },
	{ slug: 'postman', name: 'Postman', priority: 'medium' },
	{ slug: 'sonarqube', name: 'SonarSource', priority: 'medium' },

	// Productivity & Collaboration
	{ slug: 'notion', name: 'Notion', priority: 'medium' },
	{ slug: 'miro', name: 'Miro', priority: 'medium' },
	{ slug: 'loom', name: 'Loom', priority: 'medium' },
	{ slug: 'canva', name: 'Canva', priority: 'medium' },
	{ slug: 'framer', name: 'Framer', priority: 'medium' },
	{ slug: 'mux', name: 'Mux', priority: 'low' },
	{ slug: 'descript', name: 'Descript', priority: 'medium' },
	{ slug: 'clickup', name: 'ClickUp', priority: 'medium' },
	{ slug: 'monday', name: 'Monday.com', priority: 'medium' },
	{ slug: 'coda', name: 'Coda', priority: 'low' },
	{ slug: 'almanac', name: 'Almanac', priority: 'low' },
	{ slug: 'slite', name: 'Slite', priority: 'low' },
	{ slug: 'nuclino', name: 'Nuclino', priority: 'low' },
	{ slug: 'slab', name: 'Slab', priority: 'low' },
	{ slug: 'guru', name: 'Guru', priority: 'low' },
	{ slug: 'gitbook', name: 'GitBook', priority: 'low' },
	{ slug: 'readme', name: 'ReadMe', priority: 'low' },
	{ slug: 'mintlify', name: 'Mintlify', priority: 'low' },

	// HR & Recruiting
	{ slug: 'rippling', name: 'Rippling', priority: 'medium' },
	{ slug: 'lattice', name: 'Lattice', priority: 'medium' },
	{ slug: 'greenhouse', name: 'Greenhouse', priority: 'medium' },
	{ slug: 'lever', name: 'Lever', priority: 'medium' },
	{ slug: 'ashby', name: 'Ashby', priority: 'medium' },

	// Customer Support & Communication
	{ slug: 'intercom', name: 'Intercom', priority: 'medium' },
	{ slug: 'drift', name: 'Drift', priority: 'medium' },
	{ slug: 'freshworks', name: 'Freshworks', priority: 'medium' },
	{ slug: 'zendesk', name: 'Zendesk', priority: 'medium' },
	{ slug: 'gorgias', name: 'Gorgias', priority: 'low' },
	{ slug: 'kustomer', name: 'Kustomer', priority: 'low' },
	{ slug: 'front', name: 'Front', priority: 'low' },
	{ slug: 'superhuman', name: 'Superhuman', priority: 'low' },
	{ slug: 'shortwave', name: 'Shortwave', priority: 'low' },

	// Low-code / No-code
	{ slug: 'appsmith', name: 'Appsmith', priority: 'low' },
	{ slug: 'tooljet', name: 'ToolJet', priority: 'low' },
	{ slug: 'budibase', name: 'Budibase', priority: 'low' },
	{ slug: 'superblocks', name: 'Superblocks', priority: 'low' },
	{ slug: 'airplane', name: 'Airplane', priority: 'low' },
	{ slug: 'baseten', name: 'Baseten', priority: 'low' },
	{ slug: 'bubble', name: 'Bubble', priority: 'low' },
	{ slug: 'flutterflow', name: 'FlutterFlow', priority: 'low' },
	{ slug: 'glide', name: 'Glide', priority: 'low' },
	{ slug: 'softr', name: 'Softr', priority: 'low' },
	{ slug: 'stacker', name: 'Stacker', priority: 'low' },
	{ slug: 'adalo', name: 'Adalo', priority: 'low' },

	// E-commerce & CMS
	{ slug: 'storyblok', name: 'Storyblok', priority: 'low' },
	{ slug: 'contentful', name: 'Contentful', priority: 'medium' },
	{ slug: 'sanity', name: 'Sanity', priority: 'low' },
	{ slug: 'strapi', name: 'Strapi', priority: 'low' },
	{ slug: 'ghost', name: 'Ghost', priority: 'low' },
	{ slug: 'builder', name: 'Builder.io', priority: 'low' },
	{ slug: 'plasmic', name: 'Plasmic', priority: 'low' },
	{ slug: 'swell', name: 'Swell', priority: 'low' },
	{ slug: 'medusa', name: 'Medusa', priority: 'low' },
	{ slug: 'commercetools', name: 'Commercetools', priority: 'medium' },
	{ slug: 'bigcommerce', name: 'BigCommerce', priority: 'medium' },

	// Developer Experience & AI Coding
	{ slug: 'replit', name: 'Replit', priority: 'medium' },
	{ slug: 'gitpod', name: 'Gitpod', priority: 'low' },
	{ slug: 'coder', name: 'Coder', priority: 'low' },
	{ slug: 'stackblitz', name: 'StackBlitz', priority: 'low' },
	{ slug: 'codesandbox', name: 'CodeSandbox', priority: 'low' },
	{ slug: 'sourcegraph', name: 'Sourcegraph', priority: 'medium' },
	{ slug: 'tabnine', name: 'Tabnine', priority: 'low' },
	{ slug: 'codium', name: 'CodiumAI', priority: 'low' },
	{ slug: 'cursor', name: 'Cursor', priority: 'medium' },
	{ slug: 'codeium', name: 'Codeium', priority: 'low' },
	{ slug: 'phind', name: 'Phind', priority: 'low' },
	{ slug: 'deepnote', name: 'Deepnote', priority: 'low' },
	{ slug: 'observable', name: 'Observable', priority: 'low' },

	// Gaming & Entertainment
	{ slug: 'roblox', name: 'Roblox', priority: 'medium' },
	{ slug: 'unity', name: 'Unity', priority: 'medium' },
	{ slug: 'epicgames', name: 'Epic Games', priority: 'medium' },
	{ slug: 'niantic', name: 'Niantic', priority: 'medium' },
	{ slug: 'riot', name: 'Riot Games', priority: 'medium' },

	// Healthcare & Biotech
	{ slug: 'modernhealth', name: 'Modern Health', priority: 'medium' },
	{ slug: 'headspace', name: 'Headspace', priority: 'medium' },
	{ slug: 'calm', name: 'Calm', priority: 'medium' },
	{ slug: 'tempus', name: 'Tempus', priority: 'medium' },
	{ slug: 'veracyte', name: 'Veracyte', priority: 'medium' },
	{ slug: 'ginkgo', name: 'Ginkgo Bioworks', priority: 'medium' },
	{ slug: 'insitro', name: 'Insitro', priority: 'medium' },
	{ slug: 'recursion', name: 'Recursion', priority: 'medium' },
	{ slug: 'atomwise', name: 'Atomwise', priority: 'low' },

	// Security
	{ slug: 'crowdstrike', name: 'CrowdStrike', priority: 'high' },
	{ slug: 'lacework', name: 'Lacework', priority: 'medium' },
	{ slug: 'wiz', name: 'Wiz', priority: 'high' },
	{ slug: 'vanta', name: 'Vanta', priority: 'medium' },
	{ slug: 'orca', name: 'Orca Security', priority: 'medium' },
	{ slug: 'tines', name: 'Tines', priority: 'medium' },
	{ slug: 'cybereason', name: 'Cybereason', priority: 'medium' },
	{ slug: 'abnormal', name: 'Abnormal Security', priority: 'medium' },
	{ slug: 'material', name: 'Material Security', priority: 'low' },
	{ slug: 'tessian', name: 'Tessian', priority: 'low' },

	// Real Estate & PropTech
	{ slug: 'compass', name: 'Compass', priority: 'medium' },
	{ slug: 'zillow', name: 'Zillow', priority: 'medium' },
	{ slug: 'redfin', name: 'Redfin', priority: 'medium' },
	{ slug: 'offerpad', name: 'Offerpad', priority: 'medium' },

	// Education
	{ slug: 'coursera', name: 'Coursera', priority: 'medium' },
	{ slug: 'udemy', name: 'Udemy', priority: 'medium' },
	{ slug: 'masterclass', name: 'MasterClass', priority: 'medium' },
	{ slug: 'outschool', name: 'Outschool', priority: 'medium' },
	{ slug: 'brilliant', name: 'Brilliant', priority: 'medium' },
	{ slug: 'quizlet', name: 'Quizlet', priority: 'medium' },

	// Food & Delivery
	{ slug: 'sweetgreen', name: 'Sweetgreen', priority: 'medium' },
	{ slug: 'grubhub', name: 'Grubhub', priority: 'medium' },
	{ slug: 'caviar', name: 'Caviar', priority: 'low' },
	{ slug: 'zerocater', name: 'Zerocater', priority: 'low' },

	// Travel & Transportation
	{ slug: 'hopper', name: 'Hopper', priority: 'medium' },
	{ slug: 'getaround', name: 'Getaround', priority: 'medium' },
	{ slug: 'turo', name: 'Turo', priority: 'medium' },
	{ slug: 'bird', name: 'Bird', priority: 'low' },
	{ slug: 'lime', name: 'Lime', priority: 'medium' },

	// Crypto & Web3
	{ slug: 'opensea', name: 'OpenSea', priority: 'medium' },
	{ slug: 'alchemy', name: 'Alchemy', priority: 'medium' },
	{ slug: 'consensys', name: 'ConsenSys', priority: 'medium' },
	{ slug: 'chainalysis', name: 'Chainalysis', priority: 'medium' },
	{ slug: 'fireblocks', name: 'Fireblocks', priority: 'medium' },
	{ slug: 'anchorage', name: 'Anchorage Digital', priority: 'medium' },
	{ slug: 'circle', name: 'Circle', priority: 'medium' },
	{ slug: 'phantom', name: 'Phantom', priority: 'medium' },
	{ slug: 'rainbow', name: 'Rainbow', priority: 'low' },

	// Media & Content
	{ slug: 'buzzfeed', name: 'BuzzFeed', priority: 'medium' },
	{ slug: 'medium', name: 'Medium', priority: 'medium' },
	{ slug: 'substack', name: 'Substack', priority: 'medium' },
	{ slug: 'patreon', name: 'Patreon', priority: 'medium' },
	{ slug: 'spotify', name: 'Spotify', priority: 'high' },
	{ slug: 'soundcloud', name: 'SoundCloud', priority: 'medium' }
];

// Priority order for sorting (lower number = higher priority)
export const PRIORITY_ORDER: Record<ATSCompany['priority'], number> = {
	high: 0,
	medium: 1,
	low: 2
};

/**
 * Get companies sorted by priority
 */
export function getPrioritizedCompanies(limit?: number): ATSCompany[] {
	const sorted = [...GREENHOUSE_COMPANIES].sort(
		(a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
	);
	return limit ? sorted.slice(0, limit) : sorted;
}

/**
 * Get companies by priority level
 */
export function getCompaniesByPriority(priority: ATSCompany['priority']): ATSCompany[] {
	return GREENHOUSE_COMPANIES.filter((c) => c.priority === priority);
}

/**
 * Get unique company slugs (removes any duplicates)
 */
export function getUniqueCompanies(): ATSCompany[] {
	const seen = new Set<string>();
	return GREENHOUSE_COMPANIES.filter((c) => {
		if (seen.has(c.slug)) return false;
		seen.add(c.slug);
		return true;
	});
}

/**
 * Statistics about the company list
 */
export function getCompanyStats() {
	const unique = getUniqueCompanies();
	return {
		total: unique.length,
		high: unique.filter((c) => c.priority === 'high').length,
		medium: unique.filter((c) => c.priority === 'medium').length,
		low: unique.filter((c) => c.priority === 'low').length
	};
}
