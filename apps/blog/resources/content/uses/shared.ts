/**
 * The parts of the `/uses` page that read the same in every language: each item's name and
 * where it links. Each language's page groups them into sections and writes its own note on
 * why the author uses it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Every item the page lists, by key, with the product's own name and site. */
export const ITEMS = {
	vscode: { name: "Visual Studio Code", href: "https://code.visualstudio.com" },
	githubTheme: {
		name: "GitHub Theme",
		href: "https://marketplace.visualstudio.com/items?itemName=GitHub.github-vscode-theme",
	},
	oxc: {
		name: "Oxc",
		href: "https://marketplace.visualstudio.com/items?itemName=oxc.oxc-vscode",
	},
	zsh: { name: "Zsh", href: "https://www.zsh.org" },
	claudeCode: { name: "Claude Code", href: "https://www.claude.com/product/claude-code" },
	typescript: { name: "TypeScript", href: "https://www.typescriptlang.org" },
	remix: { name: "Remix", href: "https://remix.run" },
	bun: { name: "Bun", href: "https://bun.sh" },
	vitePlus: { name: "Vite+", href: "https://viteplus.dev" },
	vitest: { name: "Vitest", href: "https://vitest.dev" },
	msw: { name: "Mock Service Worker", href: "https://mswjs.io" },
	sdxc: { name: "@sdxc packages", href: "https://sdxc.dev" },
	workers: { name: "Cloudflare Workers", href: "https://workers.cloudflare.com" },
	d1: { name: "Cloudflare D1, KV and R2", href: "https://developers.cloudflare.com/d1/" },
	github: { name: "GitHub", href: "https://github.com/sergiodxa" },
	actions: { name: "GitHub Actions", href: "https://github.com/features/actions" },
	npm: { name: "npm", href: "https://www.npmjs.com/org/sdxc" },
	safari: { name: "Safari", href: "https://www.apple.com/safari/" },
	githubDesktop: { name: "GitHub Desktop", href: "https://desktop.github.com" },
} as const;
