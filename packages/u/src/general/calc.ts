/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Wraps a CSS `calc()` expression: `calc({expression})`. A plain string
 * builder, not a mixin — use it anywhere a utility accepts a raw CSS value,
 * typically together with `u.var()` to combine a custom property with an
 * arithmetic operation.
 *
 * @example u.calc(`${u.var("overlay-arrow-offset", "0.5rem")} * -1`)
 * @example "calc(var(--ui-overlay-arrow-offset, 0.5rem) * -1)"
 */
function calcUtility(expression: string): string {
	return `calc(${expression})`;
}

export { calcUtility as calc };
