/**
 * The CAPTCHA a form asks a visitor to pass before its action runs: Cloudflare Turnstile,
 * verified on the server with `TURNSTILE_SECRET_KEY`. A form renders the widget with
 * `TURNSTILE_SITE_KEY` and its action declares `captcha(turnstile)`.
 */

import { Turnstile } from "@sdxc/captcha/turnstile";
import { env } from "cloudflare:workers";

/** Verifies the token the widget writes into the form, once per submission. */
export const turnstile = new Turnstile({ secretKey: env.TURNSTILE_SECRET_KEY });
