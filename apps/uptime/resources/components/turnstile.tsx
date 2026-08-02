/**
 * The Cloudflare Turnstile challenge, as every public form that can spend a free probe
 * carries it.
 *
 * Container and loader are one component rather than two things a page has to remember to
 * pair up, because half of the pair is worse than neither half: a `.cf-turnstile` div with
 * no `api.js` behind it is an inert box that renders nothing, writes no token into the
 * form, and turns every submission from that page into a `failed-challenge` refusal —
 * silently, and only in the deployments that have a site key at all. That is exactly the
 * shape the landing page shipped in, so the two parts are no longer separable.
 *
 * The loader sits after the container and inside the same form, rather than at the end of
 * the document. Turnstile's implicit rendering scans for `.cf-turnstile` when `api.js`
 * runs, and a script tag cannot run before the markup above it has been parsed, so the
 * container is always in the DOM by then. A `<script>` generates no box, so it costs the
 * form's layout nothing wherever it lands.
 *
 * The site key arrives as a prop rather than being read here. Everything under
 * `resources/` is globbed into the browser bundle by `bootstrap/browser.ts`, so reaching
 * for the key's own accessor would drag `cloudflare:workers` into a build that has no such
 * module — a break the type checker and the test suite both let through, and only
 * `bun run build` catches. Resolving the key is therefore the caller's job; deciding what
 * to do when there isn't one stays here, so no caller can gate one half and forget the
 * other.
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
		 * This deployment's site key, or `null` when none is configured — in which case
		 * nothing renders at all, matching `guardTrialProbe` skipping the challenge under
		 * that same condition.
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
