/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags, the
 * page title, and the three stylesheets the board ships — the reset, the palette the
 * semantic tokens derive from, and the theme that derives them. Every page composes into
 * it, so a page decides only its own content, and no script is linked at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, colorScheme, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, maxIs, minBs, p } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import resetStyles from "@sdxc/ui/reset.css?url";
import themeStyles from "@sdxc/ui/theme.css?url";

import colorStyles from "~/resources/css/colors.css?url";

/**
 * Class the theme layer reads to follow `prefers-color-scheme`. The board offers no theme
 * switch, so the visitor's own system preference is the whole answer.
 */
const THEME_CLASS = "system";

namespace DocumentLayout {
	export interface Props {
		/** The page's content, rendered inside `<body>`. */
		children: RemixNode;
		/** The document title. */
		title: string;
		/** The language the page is written in, as detected for this request. */
		locale: string;
	}
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { children, locale, title } = handle.props;

		return (
			<html lang={locale} class={THEME_CLASS} mix={[colorScheme("light dark")]}>
				<head>
					<meta charSet="utf-8" data-rmx-key="charset" />
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1"
						data-rmx-key="viewport"
					/>
					<title data-rmx-key="title">{title}</title>
					<link rel="stylesheet" href={resetStyles} data-rmx-key="style-reset" />
					<link rel="stylesheet" href={colorStyles} data-rmx-key="style-colors" />
					<link rel="stylesheet" href={themeStyles} data-rmx-key="style-theme" />
				</head>
				<body
					mix={[
						vstack({ align: "center" }),
						minBs("100dvh"),
						font("sans"),
						bg("neutral.bg-tint"),
						fg("neutral.emphasis"),
					]}
				>
					<main mix={[vstack({ gap: 8 }), is("100%"), maxIs("48rem"), p(6)]}>{children}</main>
				</body>
			</html>
		);
	};
}
