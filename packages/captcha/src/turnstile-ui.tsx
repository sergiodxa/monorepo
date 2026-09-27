/**
 * Cloudflare Turnstile's widget as a `remix/ui` component: the container Cloudflare's
 * script renders into, carrying the widget's configuration as `data-*` attributes, then
 * the script itself. Placed inside a form, so the token it mints submits with the form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle } from "remix/ui";

/** Cloudflare's Turnstile loader, which scans for `.cf-turnstile` once it runs. */
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

/** The props {@link TurnstileWidget} accepts. */
export namespace TurnstileWidget {
	/** The widget's configuration; an unset option keeps Cloudflare's default. */
	export interface Props {
		/** The widget's site key, safe to embed in HTML. */
		siteKey: string;
		/** A label Cloudflare reports back on verification, to match against the route. */
		action?: string;
		/** Opaque data Cloudflare reports back on verification. */
		cData?: string;
		/** @default "auto" */
		theme?: "auto" | "light" | "dark";
		/** @default "normal" */
		size?: "normal" | "flexible" | "compact";
		/** When the widget is visible; `interaction-only` shows it only when a visitor must act. */
		appearance?: "always" | "execute" | "interaction-only";
		/** A language code such as `es`, or `auto` for the visitor's browser language. */
		language?: string;
		/**
		 * The form field the token is written into, matching the server's `Turnstile` field.
		 *
		 * @default "cf-turnstile-response"
		 */
		field?: string;
		/** The response's CSP nonce, for a policy that allows scripts by nonce. */
		nonce?: string;
	}
}

/**
 * Renders the widget container followed by Cloudflare's loader, the order its implicit
 * scan needs, since the loader looks for containers already parsed above it.
 *
 * @param handle - Component handle exposing the widget's props
 * @returns A render function producing the widget's markup
 * @example <TurnstileWidget siteKey={siteKey} action="sign-up" theme="auto" />
 */
export function TurnstileWidget(handle: Handle<TurnstileWidget.Props>) {
	return () => {
		let { siteKey, action, cData, theme, size, appearance, language, field, nonce } = handle.props;

		return (
			<>
				<div
					class="cf-turnstile"
					data-sitekey={siteKey}
					data-action={action}
					data-cdata={cData}
					data-theme={theme}
					data-size={size}
					data-appearance={appearance}
					data-language={language}
					data-response-field-name={field}
				/>
				<script src={TURNSTILE_SCRIPT_SRC} async defer nonce={nonce} />
			</>
		);
	};
}
