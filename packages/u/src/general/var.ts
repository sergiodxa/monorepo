/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Resolves a custom property reference: `var(--{name})`, or with a fallback,
 * `var(--{name}, {fallback})`. `name` omits the leading `--`, matching
 * `u.vars()`; the raw string fits anywhere a utility takes a CSS value.
 *
 * @example u.var("sidebar-width")
 * @example "var(--sidebar-width)"
 * @example u.var("sidebar-width", "18rem")
 * @example "var(--sidebar-width, 18rem)"
 */
function varUtility(name: string, fallback?: string): string {
	return fallback === undefined ? `var(--${name})` : `var(--${name}, ${fallback})`;
}

export { varUtility as var };
