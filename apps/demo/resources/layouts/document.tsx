/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags, the
 * page title, and the two stylesheets the board ships. Every page composes into it, so a
 * page decides only its own content. No script is linked: the board is HTML end to end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { colorScheme } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, maxIs, minBs, p } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import resetStyles from "@sdxc/ui/reset.css?url";
import themeStyles from "@sdxc/ui/theme.css?url";

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
			<html lang={locale} mix={[colorScheme("light dark")]}>
				<head>
					<meta charSet="utf-8" data-rmx-key="charset" />
					<meta
						name="viewport"
						content="width=device-width, initial-scale=1"
						data-rmx-key="viewport"
					/>
					<title data-rmx-key="title">{title}</title>
					<link rel="stylesheet" href={resetStyles} data-rmx-key="style-reset" />
					<link rel="stylesheet" href={themeStyles} data-rmx-key="style-theme" />
				</head>
				<body mix={[vstack({ align: "center" }), minBs("100dvh"), font("sans")]}>
					<main mix={[vstack({ gap: 6 }), is("100%"), maxIs("48rem"), p(6)]}>{children}</main>
				</body>
			</html>
		);
	};
}
