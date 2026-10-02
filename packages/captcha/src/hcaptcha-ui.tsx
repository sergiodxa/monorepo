/**
 * hCaptcha's widget as a `remix/component` component: the container hCaptcha's script renders
 * into, carrying the widget's configuration as `data-*` attributes, then the script. Placed
 * inside a form, so the `h-captcha-response` token it writes submits with the form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Handle } from "remix/component";

/** hCaptcha's loader, which renders every `.h-captcha` container once it runs. */
const HCAPTCHA_SCRIPT_SRC = "https://js.hcaptcha.com/1/api.js";

/** The props {@link HCaptchaWidget} accepts. */
export namespace HCaptchaWidget {
	/** The widget's configuration; an unset option keeps hCaptcha's default. */
	export interface Props {
		/** The site key, safe to embed in HTML. */
		siteKey: string;
		/** @default "light" */
		theme?: "light" | "dark";
		/** @default "normal" */
		size?: "normal" | "compact";
		/** The widget's position in the page's tab order. */
		tabIndex?: number;
		/** A language code such as `es`; unset, hCaptcha follows the visitor's browser. */
		language?: string;
		/** The response's CSP nonce, for a policy that allows scripts by nonce. */
		nonce?: string;
	}
}

/**
 * Renders the widget container followed by hCaptcha's loader, the order its automatic
 * render needs, since the loader looks for containers already parsed above it.
 *
 * @param handle - Component handle exposing the widget's props
 * @returns A render function producing the widget's markup
 * @example <HCaptchaWidget siteKey={siteKey} theme="dark" />
 */
export function HCaptchaWidget(handle: Handle<HCaptchaWidget.Props>) {
	return () => {
		let { siteKey, theme, size, tabIndex, language, nonce } = handle.props;
		let src = language
			? `${HCAPTCHA_SCRIPT_SRC}?hl=${encodeURIComponent(language)}`
			: HCAPTCHA_SCRIPT_SRC;

		return (
			<>
				<div
					class="h-captcha"
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
