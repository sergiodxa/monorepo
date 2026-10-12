/**
 * The `UNSUBSCRIBE_SECRET` Secrets Store binding for tests: one shared mock a test can set or
 * fail, laid over the stubbed `cloudflare:workers` env by the test's own `vi.mock` so every
 * other binding keeps its placeholder.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSecretsStoreSecret } from "@sdxc/cloudflare-mocks";

/** The value the mock answers with until a test sets or fails it. */
export const UNSUBSCRIBE_SECRET_VALUE = "test-dedicated-unsubscribe-secret";

/** The binding's mock; one instance per test file, so the test and the subject share it. */
export const UNSUBSCRIBE_SECRET = createSecretsStoreSecret({
	name: "READER_UNSUBSCRIBE_SECRET",
	value: UNSUBSCRIBE_SECRET_VALUE,
});

/**
 * The stubbed env with `UNSUBSCRIBE_SECRET` answered by {@link UNSUBSCRIBE_SECRET}.
 *
 * @param env - The `env` the stubbed `cloudflare:workers` module exports.
 * @example vi.mock("cloudflare:workers", async (original) => ({ ...(await original()), env: withUnsubscribeSecret((await original()).env) }));
 */
export function withUnsubscribeSecret<T extends object>(env: T): T {
	return new Proxy(env, {
		get: (target, property) =>
			property === "UNSUBSCRIBE_SECRET" ? UNSUBSCRIBE_SECRET : Reflect.get(target, property),
	});
}
