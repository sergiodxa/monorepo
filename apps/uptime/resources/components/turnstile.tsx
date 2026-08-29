/**
 * The Cloudflare Turnstile challenge, included in every public form that can spend a
 * free probe. Container and loader render as one component, since a container with
 * no loader behind it writes no token and turns a submission into a silent refusal.
 *
 * The loader sits inside the form, after the container, because Turnstile's implicit
 * scan for `.cf-turnstile` runs only once `api.js` loads, after the markup above it
 * has already parsed.
 *
 * The site key arrives as a prop: reading it here would pull `cloudflare:workers`
 * into the `resources/` bundle, a break only `bun run build` catches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { TURNSTILE_FIELD } from "~/app/http/validators/trial";

/** Cloudflare's Turnstile loader. Fetched only when this deployment has a site key. */
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

export namespace Turnstile {
	/** Props accepted by {@link Turnstile}. */
	export interface Props {
		/**
		 * This deployment's site key, or `null` when none is configured, in which case
		 * nothing renders. A form with no widget submits no token, and a probe with no
		 * token is refused, so a deployment missing the key runs no checks by design.
		 */
		siteKey: string | null;
	}
}

/**
 * Renders the challenge the enclosing form submits a token from, or nothing.
 *
 * @example <Turnstile siteKey={trialTurnstileSiteKey()} />
 */
export default function Turnstile(handle: Handle<Turnstile.Props>) {
	return () => {
		let { siteKey } = handle.props;
		if (siteKey === null) return null;

		return (
			<>
				<div
					class="cf-turnstile"
					data-sitekey={siteKey}
					data-response-field-name={TURNSTILE_FIELD}
					data-theme="auto"
				/>
				<script src={TURNSTILE_SCRIPT} async defer />
			</>
		);
	};
}
