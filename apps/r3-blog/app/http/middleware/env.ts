import middleware from "@pkg/remix-helpers/middleware";
import { getContext } from "remix/async-context-middleware";
import { createContextKey } from "remix/fetch-router";

const envKey = createContextKey<App.Env>();

/**
 * Creates middleware that stores `App.Env` in request context.
 *
 * @param env Environment bindings available to downstream handlers.
 * @returns Middleware that injects `env` into the request context.
 */
export default function createEnvMiddleware(env: App.Env) {
	return middleware((ctx, next) => {
		ctx.set(envKey, env);
		return next();
	});
}

/**
 * Reads an environment value from request context.
 *
 * @template key Environment key type.
 * @param key Environment key to resolve.
 * @returns The value mapped to `key`.
 * @throws {MissingEnvError} When the key is missing.
 */
export function getEnv<key extends keyof App.Env>(key: key): App.Env[key];
/**
 * Reads an environment value from request context with a fallback.
 *
 * @template key Environment key type.
 * @param key Environment key to resolve.
 * @param fallback Fallback value used when the key is undefined.
 * @returns The resolved value or `fallback`.
 */
export function getEnv<key extends keyof App.Env>(key: key, fallback: App.Env[key]): App.Env[key];
/**
 * Resolves an environment value and enforces presence when needed.
 *
 * @template key Environment key type.
 * @param key Environment key to resolve.
 * @param fallback Optional fallback used when the key is undefined.
 * @returns The resolved environment value.
 * @throws {MissingEnvError} When no value or fallback is available.
 */
export function getEnv<key extends keyof App.Env>(key: key, fallback?: App.Env[key]): App.Env[key] {
	let env = getContext().get(envKey);
	let value = env[key] ?? fallback;
	if (typeof value === "undefined") throw new MissingEnvError(key);
	return value;
}

/**
 * Error thrown when an environment key cannot be resolved.
 */
export class MissingEnvError extends ReferenceError {
	override name = "MissingEnvError";

	/**
	 * Creates an error for a missing environment key.
	 *
	 * @param key Environment key that could not be resolved.
	 */
	constructor(public key: keyof App.Env) {
		super(`Failed to retrieve environment variable: ${key}`);
	}
}
