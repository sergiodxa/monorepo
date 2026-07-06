/**
 * Typed, validated access to matched route params. A router only invokes a handler
 * after its path pattern matched, so the pattern's params are guaranteed present at
 * runtime — but `Record<string, string>` access is typed `string | undefined`. This
 * reads the named params as non-nullable, throwing if one is unexpectedly absent (a
 * routing/config bug, never user input), so handlers avoid non-null assertions (`!`)
 * and unsafe request-context casts at every call site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Thrown when a required route param is absent from the matched request. */
export class MissingRouteParamError extends Error {
	/**
	 * @param param - The name of the route param that was expected but missing.
	 */
	constructor(readonly param: string) {
		super(`Missing required route param: ${param}`);
		this.name = "MissingRouteParamError";
	}
}

/**
 * Reads the named route params as a non-nullable object.
 *
 * @param params - The matched route params (e.g. `getContext().params`).
 * @param keys - The param names the handler requires.
 * @returns An object mapping each requested key to its present string value.
 * @throws {MissingRouteParamError} When any requested param is missing.
 * @example
 * let { id } = requireParams(getContext().params, "id");
 * @example
 * let { tenantId, clientId } = requireParams(getContext().params, "tenantId", "clientId");
 */
export function requireParams<const Keys extends readonly string[]>(
	params: Record<string, string | undefined>,
	...keys: Keys
): { [Key in Keys[number]]: string } {
	let result = {} as { [Key in Keys[number]]: string };
	for (let key of keys) {
		let value = params[key];
		if (value === undefined) throw new MissingRouteParamError(key);
		result[key as Keys[number]] = value;
	}
	return result;
}
