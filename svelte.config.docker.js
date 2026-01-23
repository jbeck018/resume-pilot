// =============================================================================
// SvelteKit Configuration for Docker/Node.js Deployment
// =============================================================================
// This configuration uses the Node adapter instead of Cloudflare
// Used when building for Docker containers or self-hosted deployments
//
// Build with: BUILD_ADAPTER=node npm run build
// Or copy this file to svelte.config.js before building
// =============================================================================

import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			// Output directory for the build
			out: 'build',
			// Precompress assets with gzip and brotli
			precompress: true,
			// Environment variable for the port
			envPrefix: ''
		}),
		alias: {
			$components: 'src/lib/components',
			$server: 'src/lib/server'
		}
	}
};

export default config;
