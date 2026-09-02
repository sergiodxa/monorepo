/**
 * The public-site HTML document component ({@link Layout}) plus its props and the
 * `sanitizeCustomCss` guard. Renders the theme `:root` block, resets, content
 * typography, header/nav, and owner custom CSS around each page's children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle, RemixNode } from "remix/ui";

import * as s from "./styles";

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

/**
 * The public-site HTML document. Styling uses `remix/ui` `css()` mixins (see
 * `./styles`); the only rule-set `<style>` blocks are the theme `:root` variables,
 * a box-sizing reset, content typography, and owner custom CSS.
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
					<link rel="stylesheet" href="/assets/highlight.css" />
					<style>{themeStyle}</style>
					<style>{s.RESET_CSS}</style>
					<style>{s.CONTENT_CSS}</style>
					{customCss && <style>{sanitizeCustomCss(customCss)}</style>}
				</head>
				<body mix={[s.body]}>
					<div mix={[s.container]}>
						<header mix={[s.siteHeader]}>
							<a mix={[s.siteTitle]} href="/">
								{siteTitle}
							</a>
							<nav>
								{navLinks.map((link) => (
									<a mix={[s.navLink]} href={link.href} key={link.href}>
										{link.label}
									</a>
								))}
							</nav>
						</header>
						<main>{children}</main>
						<footer mix={[s.footer]}>Powered by the blog engine.</footer>
					</div>
				</body>
			</html>
		);
	};
}

/**
 * Neutralizes `</style` sequences so owner-provided custom CSS cannot break out of
 * its `<style>` block, and caps the length at 32 KiB (an injection guard).
 * @param css - The owner-provided custom CSS.
 * @returns The sanitized, length-capped CSS safe to inline.
 */
export function sanitizeCustomCss(css: string): string {
	return css.replace(/<\/(style)/gi, "<\\/$1").slice(0, 32 * 1024);
}
