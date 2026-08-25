/**
 * Value Object for OAuth 2.0 scope handling.
 * Provides type-safe operations for parsing, validating, and serializing scopes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Immutable-ish set of OAuth 2.0 scope strings with helpers for parsing from
 * space-separated/JSON forms, validating against allowed scopes, and serializing
 * back for storage or responses.
 * @example
 * let requested = ScopeSet.fromString("openid profile email");
 * requested.isSubsetOf(client.allowedScopes);
 */
export default class ScopeSet {
	private readonly scopes: Set<string>;

	/**
	 * Creates a new ScopeSet from an array of scope strings.
	 * @param scopes - Array of scope strings
	 */
	constructor(scopes: string[] = []) {
		this.scopes = new Set(scopes);
	}

	/**
	 * Parses a space-separated scope string into a ScopeSet.
	 * @param scopeString - Space-separated scope string (e.g., "openid profile email")
	 * @returns New ScopeSet containing the parsed scopes
	 * @example
	 * ScopeSet.fromString("openid email").toArray(); // ["openid", "email"]
	 */
	static fromString(scopeString: string | null | undefined): ScopeSet {
		if (!scopeString) return new ScopeSet();
		return new ScopeSet(scopeString.split(" ").filter(Boolean));
	}

	/**
	 * Parses a JSON-encoded array of scopes (as stored in database).
	 * Returns an empty ScopeSet if parsing fails.
	 * @param json - JSON string containing array of scope strings
	 * @returns New ScopeSet containing the parsed scopes
	 */
	static fromJson(json: string | null | undefined): ScopeSet {
		if (!json) return new ScopeSet();
		try {
			let parsed: unknown = JSON.parse(json);
			if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
				return new ScopeSet(parsed as string[]);
			}
		} catch {}
		return new ScopeSet();
	}

	/**
	 * Serializes the scopes to a space-separated string.
	 * @returns Space-separated scope string (e.g., "openid profile email")
	 */
	toString(): string {
		return Array.from(this.scopes).join(" ");
	}

	/**
	 * Serializes the scopes to a JSON-encoded array.
	 * @returns JSON string containing array of scope strings
	 */
	toJson(): string {
		return JSON.stringify(this.toArray());
	}

	/**
	 * Converts the scope set to an array.
	 * @returns Array of scope strings
	 */
	toArray(): string[] {
		return Array.from(this.scopes);
	}

	/**
	 * Checks if the set contains a specific scope.
	 * @param scope - Scope to check
	 * @returns True if the scope is present
	 */
	has(scope: string): boolean {
		return this.scopes.has(scope);
	}

	/**
	 * Checks if the set is empty.
	 * @returns True if no scopes are present
	 */
	isEmpty(): boolean {
		return this.scopes.size === 0;
	}

	/**
	 * Returns the number of scopes in the set.
	 */
	get size(): number {
		return this.scopes.size;
	}

	/**
	 * Validates that all scopes in this set are allowed.
	 * @param allowedScopes - ScopeSet of allowed scopes
	 * @returns Array of invalid scopes (empty if all valid)
	 */
	getInvalidScopes(allowedScopes: ScopeSet): string[] {
		return this.toArray().filter((scope) => !allowedScopes.has(scope));
	}

	/**
	 * Checks if all scopes in this set are allowed.
	 * @param allowedScopes - ScopeSet of allowed scopes
	 * @returns True if all scopes are allowed
	 */
	isSubsetOf(allowedScopes: ScopeSet): boolean {
		return this.getInvalidScopes(allowedScopes).length === 0;
	}

	/**
	 * Returns the intersection of this set with another.
	 * @param other - ScopeSet to intersect with
	 * @returns New ScopeSet containing only scopes present in both sets
	 */
	intersection(other: ScopeSet): ScopeSet {
		return new ScopeSet(this.toArray().filter((scope) => other.has(scope)));
	}

	/**
	 * Allows iteration over scopes.
	 */
	[Symbol.iterator](): Iterator<string> {
		return this.scopes[Symbol.iterator]();
	}
}
