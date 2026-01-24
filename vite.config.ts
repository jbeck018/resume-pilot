import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	resolve: {
		alias: {
			// Replace ai/mcp-stdio with a stub for Cloudflare Workers
			// The stdio transport requires child_process which doesn't exist on edge
			'ai/mcp-stdio': path.resolve(__dirname, 'src/lib/server/mcp/stdio-stub.ts')
		}
	},
	build: {
		rollupOptions: {
			// Ensure these Node.js-only modules don't cause build failures
			external: ['child_process', 'fs', 'path', 'os', 'crypto', 'stream', 'util', 'events', 'buffer', 'url', 'http', 'https', 'net', 'tls', 'zlib']
		}
	}
});
