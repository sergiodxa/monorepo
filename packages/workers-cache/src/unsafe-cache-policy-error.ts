/**
 * The error a refused declaration throws in development. Production downgrades
 * the response and logs, but locally a route that asked to cache something
 * unsafe should stop the request, because the alternative is a log line nobody
 * reads until the content leaks between visitors in production.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Why a declaration was refused and downgraded to a non-cacheable policy. */
export type CacheRefusalReason = "set-cookie" | "session-with-public-policy";

/** How each refusal reason reads in an error message and a log payload. */
const REASON_DESCRIPTIONS: Record<CacheRefusalReason, string> = {
	"set-cookie": "the response carries a Set-Cookie header",
	"session-with-public-policy": "the request carried a session and the declared policy is public",
};

/**
 * Error thrown in development when a cache declaration is refused, naming the
 * route and the policy so the offending declaration is findable from the stack.
 */
export class UnsafeCachePolicyError extends Error {
	/** Why the declaration was refused. */
	readonly reason: CacheRefusalReason;

	/** The policy the route declared, kept verbatim for the message and logs. */
	readonly policy: string;

	/**
	 * Builds an error that explains the refusal in terms of the response, not the
	 * middleware, so the fix is obvious from the message alone.
	 *
	 * @param reason - Which refusal rule matched.
	 * @param policy - The declared `Cache-Control` value.
	 * @param path - Pathname of the request whose response was refused.
	 */
	constructor(reason: CacheRefusalReason, policy: string, path: string) {
		super(
			`Refused to cache ${path} with "${policy}" because ${REASON_DESCRIPTIONS[reason]}. ` +
				"The response was downgraded to a non-cacheable policy.",
		);
		this.name = "UnsafeCachePolicyError";
		this.reason = reason;
		this.policy = policy;
	}
}
