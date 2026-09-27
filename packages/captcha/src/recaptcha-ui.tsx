/**
 * Google reCAPTCHA's v2 checkbox as a `remix/ui` component: the container Google's script
 * renders into, carrying its configuration as `data-*` attributes, then the script. Placed
 * inside a form, so the `g-recaptcha-response` token it writes submits with the form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle } from "remix/ui";

/** Google's loader, which renders every `.g-recaptcha` container once it runs. */
const RECAPTCHA_SCRIPT_SRC = "https://www.google.com/recaptcha/api.js";

/** The props {@link ReCaptchaWidget} accepts. */
export namespace ReCaptchaWidget {
	/** The widget's configuration; an unset option keeps Google's default. */
	export interface Props {
		/** A v2 checkbox site key, safe to embed in HTML. */
		siteKey: string;
		/** @default "light" */
		theme?: "light" | "dark";
		/** @default "normal" */
		size?: "normal" | "compact";
		/** The widget's position in the page's tab order. */
		tabIndex?: number;
		/** A language code such as `pt-BR`; unset, Google follows the visitor's browser. */
		language?: string;
		/** The response's CSP nonce, for a policy that allows scripts by nonce. */
		nonce?: string;
	}
}

/**
 * Renders the checkbox container followed by Google's loader, the order its automatic
 * render needs, since the loader looks for containers already parsed above it.
 *
 * @param handle - Component handle exposing the widget's props
 * @returns A render function producing the widget's markup
 * @example <ReCaptchaWidget siteKey={siteKey} theme="dark" />
 */
export function ReCaptchaWidget(handle: Handle<ReCaptchaWidget.Props>) {
	return () => {
		let { siteKey, theme, size, tabIndex, language, nonce } = handle.props;
		let src = language
			? `${RECAPTCHA_SCRIPT_SRC}?hl=${encodeURIComponent(language)}`
			: RECAPTCHA_SCRIPT_SRC;

		return (
			<>
				<div
					class="g-recaptcha"
					data-sitekey={siteKey}
					data-theme={theme}
					data-size={size}
					data-tabindex={tabIndex === undefined ? undefined : String(tabIndex)}
				/>
				<script src={src} async defer nonce={nonce} />
			</>
		);
	};
}
