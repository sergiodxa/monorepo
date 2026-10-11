/**
 * The provider guarding the submit form. A configured Turnstile secret puts the board on
 * Cloudflare's challenge; without one it falls back to a word the page prints and the
 * visitor copies, so the board stays guarded on a laptop with no network behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Captcha } from "@sdxc/captcha";

import { MemoryCaptcha } from "@sdxc/captcha/memory";
import { Turnstile } from "@sdxc/captcha/turnstile";
import { env } from "cloudflare:workers";

/** The word the local challenge prints and accepts; every other answer is rejected. */
export const LOCAL_ANSWER = "remix";

/** Form field the local challenge writes, matching the field `MemoryCaptcha` reads. */
export const LOCAL_FIELD = "captcha-response";

/** The Turnstile site key to render a widget for, or `null` when the board runs locally. */
export function turnstileSiteKey(): string | null {
	return env.TURNSTILE_SITE_KEY || null;
}

/** The challenge the board runs offline: it accepts {@link LOCAL_ANSWER} and nothing else. */
export function localCaptcha(): Captcha {
	let local = new MemoryCaptcha({ field: LOCAL_FIELD, unknownTokens: "reject" });
	local.accept(LOCAL_ANSWER);
	return local;
}

/** The provider this deployment verifies with. */
export function captchaProvider(): Captcha {
	let secretKey = env.TURNSTILE_SECRET_KEY;
	return secretKey ? new Turnstile({ secretKey }) : localCaptcha();
}
