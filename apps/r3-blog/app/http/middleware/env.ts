import middleware from "@pkg/remix-helpers/middleware";
import { getContext } from "remix/async-context-middleware";
import { createContextKey } from "remix/fetch-router";

const envKey = createContextKey<App.Env>();

export default function createEnvMiddleware(env: App.Env) {
	return middleware((ctx, next) => {
		ctx.set(envKey, env);
		return next();
	});
}

export function getEnv<key extends keyof App.Env>(key: key): App.Env[key];
export function getEnv<key extends keyof App.Env>(key: key, fallback: App.Env[key]): App.Env[key];
export function getEnv<key extends keyof App.Env>(key: key, fallback?: App.Env[key]): App.Env[key] {
	let env = getContext().get(envKey);
	let value = env[key] ?? fallback;
	if (typeof value === "undefined") throw new MissingEnvError(key);
	return value;
}

export class MissingEnvError extends ReferenceError {
	override name = "MissingEnvError";

	constructor(public key: keyof App.Env) {
		super(`Failed to retrieve environment variable: ${key}`);
	}
}
