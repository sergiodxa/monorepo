/**
 * The honeypot every page form carries: a hidden trap field a person never fills, and a token
 * signing when the form was rendered. The page middleware refuses a submission that fails
 * either, so a form needs only to render the fields.
 */

import { Honeypot } from "@sdxc/honeypot";
import { env } from "cloudflare:workers";

/** Signs with `HONEYPOT_SECRET`; set it with `cf workers secrets update` before deploying. */
export const honeypot = new Honeypot({ secret: env.HONEYPOT_SECRET });
