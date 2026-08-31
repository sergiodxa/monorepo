/**
 * The failure every protocol violation in this package is reported as: a bad `state`,
 * a mismatched `nonce`, an invalid signature, a step-up request the provider left
 * unsatisfied. Each carries a stable code a route branches on and a log groups by.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Why an authentication step failed. Closed, so a caller can exhaust every case
 * and a log dashboard groups failures by a stable value.
 */
export const AuthErrorCode = {
	/** Discovery metadata could not be fetched or parsed. */
	DiscoveryFailed: "discovery_failed",
	/** The issuer's document names an issuer other than the one asked for. */
	IssuerMismatch: "issuer_mismatch",
	/** The endpoint a step needs is absent from the issuer's metadata. */
	EndpointUnsupported: "endpoint_unsupported",
	/** The JWKS could not be fetched or held no usable key. */
	JwksFailed: "jwks_failed",
	/** No login transaction was in the session when the callback ran. */
	MissingTransaction: "missing_transaction",
	/** The `state` the provider returned differs from the transaction's. */
	StateMismatch: "state_mismatch",
	/** The `nonce` in the ID token differs from the transaction's. */
	NonceMismatch: "nonce_mismatch",
	/** The authorization response carried an error, or no readable response at all. */
	AuthorizationFailed: "authorization_failed",
	/** The callback carried neither a code nor an error. */
	MissingCode: "missing_code",
	/** The token endpoint refused the grant or answered unusably. */
	TokenRequestFailed: "token_request_failed",
	/** The grant response carried no ID token where one was required. */
	MissingIdToken: "missing_id_token",
	/** An ID token or access token failed verification. */
	InvalidToken: "invalid_token",
	/** `at_hash` was present and differs from the access token beside it. */
	AtHashMismatch: "at_hash_mismatch",
	/** `acr_values` was requested and no requested value came back. */
	AcrNotSatisfied: "acr_not_satisfied",
	/** `max_age` was requested and `auth_time` is absent or outside the window. */
	MaxAgeNotSatisfied: "max_age_not_satisfied",
	/** The userinfo endpoint refused the call or answered unusably. */
	UserInfoFailed: "user_info_failed",
	/** Extending the session requires a refresh token the token set is missing. */
	MissingRefreshToken: "missing_refresh_token",
	/** The introspection endpoint refused the call or answered unusably. */
	IntrospectionFailed: "introspection_failed",
	/** The revocation endpoint refused the call or answered unusably. */
	RevocationFailed: "revocation_failed",
	/** A rate limit refused the attempt before it reached the issuer. */
	RateLimited: "rate_limited",
	/** A reserved authorization or token parameter was supplied by a caller. */
	ReservedParameter: "reserved_parameter",
} as const;

/** The reason an {@link AuthError} carries, exhaustive so a `switch` over it closes. */
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

/** Diagnostic context attached to an {@link AuthError}. */
export interface AuthErrorOptions {
	/** Why the step failed, for branching and for grouping in logs. */
	code: AuthErrorCode;
	/** Underlying error or rejection value, preserved for the stack trace. */
	cause?: unknown;
	/** The provider's own `error` code, when the failure came from its response. */
	providerError?: string;
	/** The provider's `error_description`, when it sent one. */
	providerErrorDescription?: string;
}

/**
 * Error thrown when a protocol step cannot be completed safely. Every code it carries
 * means the request has to stop.
 */
export class AuthError extends Error {
	/** Why the step failed. */
	readonly code: AuthErrorCode;

	/** The provider's own `error` code, when the failure came from its response. */
	readonly providerError: string | null;

	/** The provider's `error_description`, when it sent one. */
	readonly providerErrorDescription: string | null;

	/**
	 * Builds an error carrying its code alongside the message.
	 *
	 * @param message - What went wrong, phrased for an operator reading a log.
	 * @param options - The code, the cause, and any provider-supplied detail.
	 */
	constructor(message: string, options: AuthErrorOptions) {
		super(message, { cause: options.cause });
		this.name = "AuthError";
		this.code = options.code;
		this.providerError = options.providerError ?? null;
		this.providerErrorDescription = options.providerErrorDescription ?? null;
	}

	/**
	 * Reports whether a value is an `AuthError` carrying one specific code, giving a
	 * catch block a single narrowing test to branch on.
	 *
	 * @param error - The caught value.
	 * @param code - The code to test for.
	 */
	static is(error: unknown, code: AuthErrorCode): error is AuthError {
		return error instanceof AuthError && error.code === code;
	}
}
