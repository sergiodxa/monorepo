/**
 * The platform's Turnstile verifier, read from the Worker's own `TURNSTILE_SECRET_KEY`.
 * Both routers publish it as `ctx.turnstile`, so every form that can challenge verifies
 * through this one instance while a test installs a `MemoryCaptcha` in its place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Captcha } from "@sdxc/captcha";

import { Turnstile } from "@sdxc/captcha/turnstile";
import { env } from "cloudflare:workers";

/** Reaches Cloudflare only when a submission's token is verified, so building it is free. */
export const turnstile: Captcha = new Turnstile({ secretKey: env.TURNSTILE_SECRET_KEY });
