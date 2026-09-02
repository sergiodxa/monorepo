/**
 * Credential options: a secret stated directly, or a function that reads it.
 * Some secrets live in a store only readable with an await, which a constructor
 * running at module scope cannot do, so a reader defers that read to the first
 * call needing it and remembers the answer for the life of the instance.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A credential given either directly or as a function resolving it on first use. */
export type Secret = string | (() => string | Promise<string>);

/**
 * Wraps a credential option in the reader a provider asks on every use. The
 * function form is called once however many calls await it, and a rejection is
 * not remembered, so a store that was briefly unavailable is asked again and
 * the instance can still bill later.
 *
 * @param secret - The credential as the caller configured it.
 * @returns A reader answering the credential, which rejects when a resolver does.
 *
 * @example
 * let token = secretReader(() => env.ACCESS_TOKEN.get());
 * request.headers.set("Authorization", `Bearer ${await token()}`);
 */
export function secretReader(secret: Secret): () => Promise<string> {
	if (typeof secret === "string") return async () => secret;

	let resolved: string | undefined;
	let pending: Promise<string> | undefined;

	let resolve = async (): Promise<string> => {
		resolved = await secret();

		return resolved;
	};

	return async () => {
		if (resolved !== undefined) return resolved;

		pending ??= resolve().catch((error: unknown) => {
			pending = undefined;

			throw error;
		});

		return await pending;
	};
}

/**
 * Reads a signing secret for one verification pass, reporting an unreadable one
 * as empty. Every scheme here refuses an empty secret, so a store that cannot
 * be reached leaves a delivery unproven instead of failing the endpoint, which
 * is how a platform decides to stop delivering to it.
 *
 * @param read - Reader built by {@link secretReader} over the signing secret.
 * @returns The secret, or the empty string when it could not be read.
 *
 * @example
 * let secret = await verificationSecret(this.#webhookSecret);
 */
export async function verificationSecret(read: () => Promise<string>): Promise<string> {
	try {
		return await read();
	} catch {
		return "";
	}
}
