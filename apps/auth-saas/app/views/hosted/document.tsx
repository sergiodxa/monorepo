/**
 * The document shell every hosted sign-in, consent and error screen renders inside:
 * `@sdxc/ui`'s reset and theme, this app's default unbranded palette, a centered
 * single-column page, and the client entry that hydrates the passkey island. Every tenant
 * renders from this one theme until an entitlement can apply a brand record over it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { flex, flexCol, items, justify } from "@sdxc/u/layout";
import { minBs, p } from "@sdxc/u/size";
import { ImportMap } from "remix/component/server";

import type { DocumentAssets as Assets } from "~/app/services/assets";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";
import "./palette.css";

/** What the renderer hands the document: the asset manifest's lookups and the CSP nonce. */
export interface DocumentContext extends Assets {
	/**
	 * The response's CSP nonce for the import map and module tags, or `undefined` where no
	 * policy restricts scripts. Reading it advertises it in the response's policy.
	 */
	readonly nonce: string | undefined;
}

/**
 * Hands the document the assets the renderer looked up, which it reads where a component
 * cannot await them itself.
 */
export function DocumentAssets(
	handle: Handle<{ value: DocumentContext; children: RemixNode }, DocumentContext>,
) {
	handle.context.set(handle.props.value);
	return () => handle.props.children;
}

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
		let { script, stylesheets, nonce } = handle.context.get(DocumentAssets);

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
