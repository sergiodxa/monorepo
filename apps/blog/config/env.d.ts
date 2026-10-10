/**
 * Ambient type declarations for the blog application environment. Augments the
 * global `App.Env` interface with the resolved secrets, flags, and KV-backed
 * bindings that request middleware injects into the router's request context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SendEmailBinding } from "@sdxc/mail/cloudflare";

declare global {
	namespace App {
		interface Env {
			IS_PROD: boolean;
			CLIENT_ID: string;
			CLIENT_SECRET: string;
			COOKIE_SESSION_SECRET: string;
			AUTH: KVNamespace;
			REDIRECTS: KVNamespace;
			CACHE: KVNamespace;
			/** Present only once the deployment's bindings include a `ratelimits` entry. */
			MCP_RATE_LIMITER: RateLimit | undefined;
			/** The Webmention endpoint's budget; absent from a deployment predating the binding. */
			WEBMENTION_RATE_LIMITER?: RateLimit;
			/** The ActivityPub inbox's budget; absent from a deployment predating the binding. */
			ACTIVITYPUB_RATE_LIMITER?: RateLimit;
			/** Delivers support requests; absent from a deployment without the `send_email` binding. */
			EMAIL?: SendEmailBinding;
			/** Where Encore support requests are delivered, set as a Worker secret. */
			SUPPORT_INBOX?: string;
			/** Signs GitHub's sponsorship webhook; unset refuses every delivery. */
			GITHUB_SPONSORS_WEBHOOK_SECRET?: string;
			/** The Encore support form's per-address budget. */
			SUPPORT_RATE_LIMITER?: RateLimit;
			/** Lets a deferred write finish after the response has been sent. */
			waitUntil(promise: Promise<unknown>): void;
		}
	}
}

export {};
