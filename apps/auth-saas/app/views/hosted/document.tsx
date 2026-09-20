/**
 * The document shell every hosted sign-in, consent and error screen renders inside:
 * `@sdxc/ui`'s reset and theme, this app's default unbranded palette, and a centered
 * single-column page. Every tenant renders from this one theme until an entitlement
 * exists that can ever apply a brand record over it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { bg, fg } from "@sdxc/u/color";
import { flex, flexCol, items, justify } from "@sdxc/u/layout";
import { minBs, p } from "@sdxc/u/size";
import resetStyles from "@sdxc/ui/reset.css?url";
import themeStyles from "@sdxc/ui/theme.css?url";

import paletteStyles from "./palette.css?url";

export namespace HostedDocument {
	export interface Props {
		title: string;
		/** The resolved request language, set as `<html lang>`. */
		locale: string;
		children: RemixNode;
	}
}

/**
 * Renders the outer `<html>`/`<head>`/`<body>` shell around a hosted screen's
 * content, centering it in a single column that works before any script runs.
 *
 * @param handle - Component handle exposing the shell props.
 * @returns A render function producing the hosted document markup.
 * @example
 * return ctx.render(<HostedDocument title={t("hostedSignIn.title")} locale={ctx.locale}><SignInPage {...} /></HostedDocument>);
 */
export function HostedDocument(handle: Handle<HostedDocument.Props>) {
	return () => {
		let { title, locale, children } = handle.props;

		return (
			<html lang={locale} class="system">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					<link rel="stylesheet" href={resetStyles} />
					<link rel="stylesheet" href={themeStyles} />
					<link rel="stylesheet" href={paletteStyles} />
				</head>
				<body
					mix={[
						bg("neutral.bg-tint"),
						fg("neutral.emphasis"),
						flex(),
						flexCol(),
						items("center"),
						justify("center"),
						minBs("100dvh"),
						p(6),
					]}
				>
					{children}
				</body>
			</html>
		);
	};
}
