/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Resolves a CSS environment variable reference: `env({name})`, or
 * `env({name}, {fallback})` when a fallback is given. Returns a plain string,
 * usable anywhere a utility accepts a raw CSS value.
 *
 * @example u.env("safe-area-inset-bottom")
 * @example "env(safe-area-inset-bottom)"
 * @example u.env("safe-area-inset-bottom", "0px")
 * @example "env(safe-area-inset-bottom, 0px)"
 */
function envUtility(name: string, fallback?: string): string {
	return fallback === undefined ? `env(${name})` : `env(${name}, ${fallback})`;
}

export { envUtility as env };
