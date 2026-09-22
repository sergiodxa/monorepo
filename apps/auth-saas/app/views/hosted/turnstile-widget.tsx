/**
 * Cloudflare's Turnstile challenge: its own script renders the widget and
 * mints the token every protected form posts back as `cf-turnstile-response`,
 * so no verification logic lives in the browser here. Placed inside a
 * `Form`/`form` so the token it mints submits along with the rest of the
 * screen's fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

/** Cloudflare's own Turnstile widget script. */
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export namespace TurnstileWidget {
	export interface Props {
		/** The platform's Turnstile site key (`TURNSTILE_SITE_KEY`), safe to embed in HTML. */
		siteKey: string;
	}
}

/**
 * Renders Cloudflare's own script tag and the widget `div` it mounts into.
 *
 * @param handle - Component handle exposing the widget's props.
 * @returns A render function producing the widget's markup.
 * @example
 * {challenge && <TurnstileWidget siteKey={turnstileSiteKey} />}
 */
export function TurnstileWidget(handle: Handle<TurnstileWidget.Props>) {
	return () => {
		let { siteKey } = handle.props;

		return (
			<>
				<script src={TURNSTILE_SCRIPT_SRC} async defer />
				<div class="cf-turnstile" data-sitekey={siteKey} />
			</>
		);
	};
}
