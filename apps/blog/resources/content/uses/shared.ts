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
	macbookPro: { name: "MacBook Pro M5", href: "https://www.apple.com/macbook-pro/" },
	mv7: { name: "Shure MV7", href: "https://www.shure.com/en-US/products/microphones/mv7" },
	terminal: { name: "Terminal", href: "https://support.apple.com/guide/terminal/welcome/mac" },
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
	mail: { name: "Mail", href: "https://support.apple.com/guide/mail/welcome/mac" },
	calendar: { name: "Calendar", href: "https://support.apple.com/guide/calendar/welcome/mac" },
	cursor: { name: "Cursor", href: "https://cursor.com" },
	xcode: { name: "Xcode", href: "https://developer.apple.com/xcode/" },
	figma: { name: "Figma", href: "https://www.figma.com" },
	chatgpt: { name: "ChatGPT", href: "https://chatgpt.com" },
	claude: { name: "Claude", href: "https://claude.ai/download" },
	docker: { name: "Docker Desktop", href: "https://www.docker.com/products/docker-desktop/" },
} as const;
