import { attr, escape } from "./html";

/** A navigation link in the public site header. */
export interface NavLink {
	href: string;
	label: string;
}

/** Options for the public site document layout. */
export interface LayoutOptions {
	title: string;
	siteTitle: string;
	description?: string;
	/** `:root { … }` theme block from `renderThemeStyle`. */
	themeStyle: string;
	/** Owner-provided custom CSS (emitted last so it wins). */
	customCss: string;
	navLinks: NavLink[];
	/** Inner HTML for `<main>` (already trusted/escaped by the caller). */
	body: string;
}

/** Baseline component styles built on the theme's `--blog-*`/`--ui-*` tokens. */
const BASE_CSS = /* css */ `
*, *::before, *::after { box-sizing: border-box; }
body {
	margin: 0;
	background: var(--ui-bg);
	color: var(--ui-fg);
	font-family: var(--blog-font-body);
	font-size: var(--blog-font-size);
	line-height: 1.6;
}
a { color: var(--ui-accent); }
a:hover { color: var(--ui-accent-hover); }
h1, h2, h3, h4 { font-family: var(--blog-font-heading); line-height: 1.2; }
img { max-width: 100%; height: auto; }
pre { overflow-x: auto; padding: var(--blog-spacing); border-radius: var(--blog-radius); background: var(--ui-surface); }
code { font-family: var(--blog-font-mono, ui-monospace, monospace); }
.blog-container { max-width: var(--blog-measure); margin: 0 auto; padding: calc(var(--blog-spacing) * 2) var(--blog-spacing); }
.blog-header { display: flex; flex-wrap: wrap; gap: var(--blog-spacing); align-items: baseline; justify-content: space-between; border-bottom: 1px solid var(--ui-border); }
.blog-header nav a { margin-left: var(--blog-spacing); }
.blog-site-title { font-weight: 700; font-size: 1.25rem; color: var(--ui-fg); text-decoration: none; }
.blog-list { list-style: none; padding: 0; }
.blog-list li { padding: var(--blog-spacing) 0; border-bottom: 1px solid var(--ui-border); }
.blog-meta { color: var(--ui-muted); font-size: 0.875rem; }
.blog-footer { margin-top: calc(var(--blog-spacing) * 3); padding-top: var(--blog-spacing); border-top: 1px solid var(--ui-border); color: var(--ui-muted); font-size: 0.875rem; }
`;

/**
 * Renders a complete public-site HTML document with the theme style block,
 * baseline component CSS, and owner custom CSS (emitted last so it outranks).
 * @param options - Document content and theme inputs.
 * @returns A full HTML5 document string.
 */
export function documentLayout(options: LayoutOptions): string {
	let nav = options.navLinks
		.map((link) => `<a href="${attr(link.href)}">${escape(link.label)}</a>`)
		.join("");

	return (
		`<!doctype html><html lang="en"><head>` +
		`<meta charset="utf-8">` +
		`<meta name="viewport" content="width=device-width, initial-scale=1">` +
		`<title>${escape(options.title)}</title>` +
		(options.description
			? `<meta name="description" content="${attr(options.description)}">`
			: "") +
		`<link rel="stylesheet" href="/assets/prism.css">` +
		`<style>${options.themeStyle}</style>` +
		`<style>${BASE_CSS}</style>` +
		(options.customCss ? `<style>${sanitizeCustomCss(options.customCss)}</style>` : "") +
		`</head><body><div class="blog-container">` +
		`<header class="blog-header">` +
		`<a class="blog-site-title" href="/">${escape(options.siteTitle)}</a>` +
		`<nav>${nav}</nav>` +
		`</header>` +
		`<main>${options.body}</main>` +
		`<footer class="blog-footer">Powered by the blog engine.</footer>` +
		`</div></body></html>`
	);
}

/** Neutralizes `</style` sequences so custom CSS cannot break out of its block. */
export function sanitizeCustomCss(css: string): string {
	return css.replace(/<\/(style)/gi, "<\\/$1").slice(0, 32 * 1024);
}
