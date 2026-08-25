/**
 * The OAuth 2.0 Form Post Response Mode page: a self-submitting form that POSTs the
 * authorization response parameters to the relying party's redirect URI, with a
 * no-script fallback button for browsers that skip the script.
 *
 * Every value is rendered as a text node or an attribute, so JSX escaping is what
 * keeps a hostile `state` from breaking out of the markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

/**
 * The one line of script this page carries: submitting the form as soon as it renders.
 *
 * Kept as a plain string, it renders as a text node and satisfies the "no HTML
 * strings" rule while still performing the Form Post Response Mode auto-submit.
 */
const SUBMIT_SCRIPT = "document.forms[0].submit()";

namespace FormPostView {
	export interface Setup {
		/** The relying party's registered redirect URI, already validated by the caller. */
		action: string;
		/** The authorization response parameters, posted as hidden fields. */
		params: Record<string, string>;
		/** Label of the fallback button, translated by the caller. */
		submitLabel: string;
		/** Sentence explaining the fallback, shown in the no-script case. */
		noscriptMessage: string;
		/** Document title, translated by the caller. */
		title: string;
	}
}

/**
 * Renders the auto-submitting authorization response form.
 *
 * The submit runs as a one-line `<script>` text node, the shape of inline script
 * `remix/ui` supports; the `<noscript>` button covers browsers that skip it.
 */
export default function FormPostView(handle: Handle<FormPostView.Setup>) {
	return () => {
		let { action, params, submitLabel, noscriptMessage, title } = handle.props;
		let fields = Object.entries(params);

		return (
			<html lang="en">
				<head>
					<meta charSet="utf-8" />
					<title>{title}</title>
				</head>
				<body>
					<form method="post" action={action}>
						{fields.map(([name, value]) => (
							<input key={name} type="hidden" name={name} value={value} />
						))}
						<noscript>
							<p>{noscriptMessage}</p>
							<button type="submit">{submitLabel}</button>
						</noscript>
					</form>
					<script>{SUBMIT_SCRIPT}</script>
				</body>
			</html>
		);
	};
}
