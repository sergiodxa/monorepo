/**
 * HTML document shell for the marketing landing: fonts, stylesheets, title and
 * a full-bleed body that carries the page composition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { css } from "remix/component";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/** Bunny Fonts origin for Outfit and IBM Plex Mono. */
const FONTS_STYLESHEET =
	"https://fonts.bunny.net/css?family=ibm-plex-mono:400,500|outfit:400,500,600,700";

namespace DocumentLayout {
	export interface Props {
		/** Page body. */
		children: RemixNode;
		/** Stylesheets and client entry from `ctx.assets`. */
		assets: DocumentAssets;
		/** Document title. */
		title: string;
		/** Meta description. */
		description: string;
		/** Absolute canonical URL. */
		canonical: string;
	}
}

/**
 * Renders the outer document. Pages stay static (no client entry) so agents and
 * humans share one HTML response without hydration.
 */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { assets, canonical, children, description, title } = handle.props;
		let { stylesheets } = assets;

		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" data-rmx-key="charset" />
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1"
						data-rmx-key="viewport"
					/>
					<meta name="description" content={description} data-rmx-key="description" />
					<meta name="theme-color" content="#e8eef2" data-rmx-key="theme-color" />
					<link rel="canonical" href={canonical} data-rmx-key="canonical" />
					<title data-rmx-key="title">{title}</title>
					<link rel="preconnect" href="https://fonts.bunny.net" data-rmx-key="fonts-preconnect" />
					<link rel="stylesheet" href={FONTS_STYLESHEET} data-rmx-key="fonts" />
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} data-rmx-key={href} />
					))}
				</head>
				<body
					mix={css({
						margin: 0,
						minHeight: "100dvh",
						color: "var(--apis-ink)",
						backgroundColor: "var(--apis-paper)",
						fontFamily: "var(--ui-font-sans)",
						lineHeight: 1.5,
						WebkitFontSmoothing: "antialiased",
					})}
				>
					{children}
				</body>
			</html>
		);
	};
}
