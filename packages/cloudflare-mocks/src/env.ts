/**
 * Assembles the `env` object a Worker receives from a set of mock bindings, typed against
 * the app's generated binding type. Reading a binding the test forgot to supply throws by
 * name instead of surfacing later as `undefined is not a function`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
/**
 * Property names that must resolve to `undefined` rather than throw, because runtimes and
 * test matchers probe for them on arbitrary objects.
 */
const PROBED_PROPERTIES = new Set([
	"then",
	"catch",
	"finally",
	"toJSON",
	"toString",
	"valueOf",
	"constructor",
	"inspect",
	"nodeType",
]);

/** Options for {@link createEnv}. */
export interface EnvMockOptions {
	/**
	 * Whether reading a binding that was not supplied throws. Defaults to `true`, which is
	 * the point: a forgotten binding fails at the access that needed it. Set `false` when
	 * the code under test genuinely treats a binding as optional.
	 */
	strict?: boolean;
}

/**
 * Builds the `env` object a Worker expects from the bindings a test supplies.
 *
 * Pass the app's generated binding type as the type argument to have the supplied
 * bindings checked against it, so a mock of the wrong shape fails typecheck.
 * @param bindings Bindings to expose, keyed by binding name.
 * @param options Whether unknown bindings throw.
 * @returns An object usable as a Worker's `env`.
 * @example let env = createEnv<Env>({ DB: createD1Database(), CACHE: createKVNamespace() });
 * @example let env = createEnv({ CACHE: createKVNamespace() }, { strict: false });
 */
export function createEnv<Env extends object = Record<string, unknown>>(
	bindings: Partial<Env> & Record<string, unknown>,
	options?: EnvMockOptions,
): Env {
	let target = { ...bindings };

	if (options?.strict === false) return target as Env;

	// A Proxy is the only way to fail on the *read* of a missing binding; a plain object
	// would hand back `undefined` and defer the error to somewhere unrelated.
	return new Proxy(target, {
		/**
		 * Reads a binding, failing by name when it was never supplied.
		 * @param source Bindings the test provided.
		 * @param property Binding name being read.
		 */
		get(source: Record<string, unknown>, property: string | symbol): unknown {
			if (typeof property === "symbol") return Reflect.get(source, property);
			if (Object.prototype.hasOwnProperty.call(source, property)) return source[property];
			if (PROBED_PROPERTIES.has(property)) return undefined;

			throw new Error(
				`env.${property} was not provided to createEnv(); add it to the bindings or pass { strict: false }`,
			);
		},
	}) as Env;
}
