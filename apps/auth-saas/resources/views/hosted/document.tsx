/**
 * The document shell every hosted sign-in, consent and error screen renders inside:
 * `@sdxc/ui`'s reset and theme, this app's default unbranded palette, a centered
 * single-column page, and the client entry that hydrates the passkey island.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { flex, flexCol, items, justify } from "@sdxc/u/layout";
import { minBs, p } from "@sdxc/u/size";
import { ImportMap } from "remix/component/server";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";
import "~/resources/views/hosted/palette.css";

export namespace HostedDocument {
	export interface Props {
		title: string;
		/**
		 * The request's `ctx.assets`: the stylesheets and client entry to link, and the CSP nonce
		 * the import map and module tags carry where the policy restricts scripts.
		 */
		assets: DocumentAssets;
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
 * return ctx.render(<HostedDocument title={t("hostedSignIn.title")} assets={ctx.assets} locale={ctx.locale}><SignInPage {...} /></HostedDocument>);
 */
export function HostedDocument(handle: Handle<HostedDocument.Props>) {
	return () => {
		let { title, assets, locale, children } = handle.props;
		let { script, stylesheets, nonce } = assets;

		return (
			<html lang={locale} class="system">
				<head>
					<meta charSet="utf-8" />
					<meta name="viewport" content="width=device-width, initial-scale=1" />
					<title>{title}</title>
					<ImportMap value={script.importMap} nonce={nonce} />
					{script.preloads.map((href) => (
						<link key={href} rel="modulepreload" href={href} nonce={nonce} />
					))}
					{stylesheets.map((href) => (
						<link key={href} rel="stylesheet" href={href} />
					))}
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
					<script type="module" async src={script.href} nonce={nonce}></script>
				</body>
			</html>
		);
	};
}
