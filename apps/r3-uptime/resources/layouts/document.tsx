/**
 * Root HTML document layout for the r3-uptime app. It renders the outer html/head/body
 * shell with charset and viewport meta tags, an optional page title, the @pkg/r3-ui
 * design-system stylesheets, and the client entry script, switching between the dev
 * source and the built asset path. It exists as the shared document wrapper every
 * server-rendered page is composed into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import resetStyles from "@pkg/r3-ui/reset.css?url";
import themeStyles from "@pkg/r3-ui/theme.css?url";
import { css } from "remix/ui";

import colorStyles from "~/resources/css/colors.css?url";
import { fontMono, neutral } from "~/resources/theme";

/**
 * Raw `@font-face` rule for Mona Sans, the display font the marketing chrome opts
 * into (see `resources/theme.ts`'s `fontSans`). Declared here, once, so every
 * page's `<head>` gets it regardless of which layout it renders through. Emitted
 * as a plain `<style>` tag rather than through the `css()` mixin because that
 * mixin scopes every rule to a generated element class name, which can't express
 * a top-level, unscoped at-rule like this.
 */
const fontFaceCss = `
	@font-face {
		font-family: "Mona Sans";
		font-display: swap;
		font-weight: 100 900;
		src:
			local("Mona Sans"),
			url("/fonts/mona-sans.woff2") format("woff2");
	}
`;

const CLIENT_ENTRY_SRC = import.meta.env.DEV ? "/bootstrap/browser.ts" : "/assets/clientEntry.js";

namespace DocumentLayout {
	export interface Props {
		children: RemixNode;
		title?: string;
		/** The request's detected language (`ctx.locale`), set as `<html lang>`. Defaults to `"en"` for the few call sites that don't have it in scope yet. */
		locale?: string;
	}
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`, with an optional `<title>` and the client entry script. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { title, locale = "en", children } = handle.props;

		return (
			<html lang={locale} class="system">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					{title && <title>{title}</title>}
					<link rel="modulepreload" href={CLIENT_ENTRY_SRC} />
					{/* Order matters: reset first, then semantic theme tokens, then this
					app's own --color-* scales those tokens read through `var()` — CSS
					custom properties resolve at used-value time, so declaration order
					between these three doesn't actually affect which value wins, but
					reading them least-specific-to-most mirrors the token layering. */}
					<link rel="stylesheet" href={resetStyles} />
					<link rel="stylesheet" href={colorStyles} />
					<link rel="stylesheet" href={themeStyles} />
					<style>{fontFaceCss}</style>
				</head>
				<body
					mix={[
						css({
							margin: 0,
							background: neutral[50],
							color: neutral[950],
							fontFamily: fontMono,
							"@media (prefers-color-scheme: dark)": {
								background: neutral[950],
								color: neutral[50],
							},
						}),
					]}
				>
					{children}
					{/* `async`, not the implicit defer of a plain module script — a deferred
					script waits for this whole streamed response to finish parsing, so a
					non-blocking Frame's later-arriving <template> would never get picked up
					until the slowest Frame on the page had already resolved. */}
					<script type="module" async src={CLIENT_ENTRY_SRC}></script>
				</body>
			</html>
		);
	};
}
