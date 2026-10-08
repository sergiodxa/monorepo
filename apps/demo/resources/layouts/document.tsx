/**
 * Root HTML document layout. Renders the html/head/body shell: the fixed head tags, the
 * page title, and the three stylesheets the board ships, imported below in cascade order.
 * The client entry is linked only by pages that carry an island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, colorScheme, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, maxIs, minBs, p } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { ImportMap } from "remix/component/server";

import type { DocumentAssets as Assets } from "~/app/lib/assets";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

/**
 * Class the theme layer reads to follow `prefers-color-scheme`. The board offers no theme
 * switch, so the visitor's own system preference is the whole answer.
 */
const THEME_CLASS = "system";

/**
 * Hands the document the assets the renderer looked up, which it reads where a component
 * cannot await them itself.
 */
export function DocumentAssets(handle: Handle<{ value: Assets; children: RemixNode }, Assets>) {
	handle.context.set(handle.props.value);
	return () => handle.props.children;
}

namespace DocumentLayout {
	export interface Props {
		/** The page's content, rendered inside `<body>`. */
		children: RemixNode;
		/** The document title. */
		title: string;
		/** The language the page is written in, as detected for this request. */
		locale: string;
		/**
		 * Whether this page carries an island, which is the only reason to link the client
		 * runtime. A page that carries none is complete as it stands and links no script.
		 */
		hydrates?: boolean;
	}
}

/** Renders the outer `<html>`/`<head>`/`<body>` shell around `children`. */
export default function DocumentLayout(handle: Handle<DocumentLayout.Props>) {
	return () => {
		let { children, hydrates = false, locale, title } = handle.props;
		let { script, stylesheets } = handle.context.get(DocumentAssets);

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
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} data-rmx-key={href} />
					))}
					{hydrates ? (
						<>
							<ImportMap value={script.importMap} />
							{script.preloads.map((href) => (
								<link key={href} rel="modulepreload" href={href} data-rmx-key={href} />
							))}
						</>
					) : null}
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
					{hydrates ? <script type="module" src={script.href}></script> : null}
				</body>
			</html>
		);
	};
}
