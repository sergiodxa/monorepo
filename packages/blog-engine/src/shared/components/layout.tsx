import type { Handle, RemixNode } from "remix/ui";

/** A navigation link in the public site header. */
export interface NavLink {
	href: string;
	label: string;
}

/** Props for the public site document layout. */
export interface LayoutProps {
	title: string;
	siteTitle: string;
	description?: string;
	/** `:root { … }` theme block from `renderThemeStyle`. */
	themeStyle: string;
	/** Owner-provided custom CSS (emitted last so it wins). */
	customCss: string;
	navLinks: NavLink[];
	children: RemixNode;
}

/** Baseline element styles built on the theme's `--blog-*`/`--ui-*` tokens. */
const BASE_CSS = /* css */ `
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--ui-bg);color:var(--ui-fg);font-family:var(--blog-font-body);font-size:var(--blog-font-size);line-height:1.6}
a{color:var(--ui-accent)}a:hover{color:var(--ui-accent-hover)}
h1,h2,h3,h4{font-family:var(--blog-font-heading);line-height:1.2}
img{max-width:100%;height:auto}
pre{overflow-x:auto;padding:var(--blog-spacing);border-radius:var(--blog-radius);background:var(--ui-surface)}
.container{max-width:var(--blog-measure);margin:0 auto;padding:calc(var(--blog-spacing) * 2) var(--blog-spacing)}
.site-header{display:flex;flex-wrap:wrap;gap:var(--blog-spacing);align-items:baseline;justify-content:space-between;border-bottom:1px solid var(--ui-border)}
.site-header nav a{margin-left:var(--blog-spacing)}
.site-title{font-weight:700;font-size:1.25rem;color:var(--ui-fg);text-decoration:none}
.post-list{list-style:none;padding:0}
.post-list li{padding:var(--blog-spacing) 0;border-bottom:1px solid var(--ui-border)}
.meta{color:var(--ui-muted);font-size:.875rem}
.tag{display:inline-block;padding:.1em .5em;border-radius:var(--blog-radius);background:var(--ui-surface);font-size:.85em}
.site-footer{margin-top:calc(var(--blog-spacing) * 3);padding-top:var(--blog-spacing);border-top:1px solid var(--ui-border);color:var(--ui-muted);font-size:.875rem}
`;

/**
 * The public-site HTML document: theme style block, baseline element CSS, and owner
 * custom CSS (emitted last so it outranks). Rendered with `remix/ui`.
 * @param handle - Component handle exposing the layout props.
 * @returns A render function producing the document markup.
 */
export function Layout(handle: Handle<LayoutProps>) {
	return () => {
		let { title, siteTitle, description, themeStyle, customCss, navLinks, children } = handle.props;
		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					{description && <meta name="description" content={description} />}
					<link rel="stylesheet" href="/assets/prism.css" />
					<style>{themeStyle}</style>
					<style>{BASE_CSS}</style>
					{customCss && <style>{sanitizeCustomCss(customCss)}</style>}
				</head>
				<body>
					<div class="container">
						<header class="site-header">
							<a class="site-title" href="/">
								{siteTitle}
							</a>
							<nav>
								{navLinks.map((link) => (
									<a href={link.href} key={link.href}>
										{link.label}
									</a>
								))}
							</nav>
						</header>
						<main>{children}</main>
						<footer class="site-footer">Powered by the blog engine.</footer>
					</div>
				</body>
			</html>
		);
	};
}

/** Neutralizes `</style` sequences so custom CSS cannot break out of its block. */
export function sanitizeCustomCss(css: string): string {
	return css.replace(/<\/(style)/gi, "<\\/$1").slice(0, 32 * 1024);
}
