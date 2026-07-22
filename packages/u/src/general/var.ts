/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Resolves a custom property reference: `var(--{name})`, or
 * `var(--{name}, {fallback})` when a fallback is given. The leading `--` is
 * omitted from `name`, mirroring `u.vars()`'s convention for defining the
 * same custom properties. A plain string resolver, not a mixin — use it
 * anywhere a utility accepts a raw CSS value, such as `u.p(u.var("gap"))`.
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
