/**
 * The signing keys of the blog's one ActivityPub actor, imported from the
 * `ACTIVITYPUB_PRIVATE_KEY` Secrets Store binding the first time something signs, and kept
 * for the rest of the isolate so each delivery pays for neither the read nor the import.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KeyProvider } from "@sdxc/activitypub";
import type { Result } from "@sdxc/result";

import { ActorKeys } from "@sdxc/activitypub";
import { isSuccess, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import { ACTOR_ID } from "~/config/activitypub";

/**
 * The actor's keys for `ACTOR_ID` and `null` for any other actor. A missing or empty secret
 * also answers `null`, and a secret that is not a PKCS#8 RSA key is a failure; neither is
 * kept, so setting or fixing the secret takes effect on the next call.
 */
export class BlogKeyProvider implements KeyProvider {
	readonly #readPrivateKey: () => Promise<string | null>;
	#imported: Promise<Result<ActorKeys | null, Error>> | null = null;

	/** @param readPrivateKey Reads the PKCS#8 PEM, `null` when it is not set. */
	constructor(readPrivateKey: () => Promise<string | null>) {
		this.#readPrivateKey = readPrivateKey;
	}

	/** Concurrent first calls share one read and import of the secret. */
	async keysOf(actor: string): Promise<Result<ActorKeys | null, Error>> {
		if (actor !== ACTOR_ID) return success(null);

		this.#imported ??= this.#import();
		let imported = await this.#imported;
		if (!isSuccess(imported) || imported.data === null) this.#imported = null;
		return imported;
	}

	/** Reads the secret and imports it, once per isolate when it succeeds. */
	async #import(): Promise<Result<ActorKeys | null, Error>> {
		let privateKeyPem = await this.#readPrivateKey();
		if (!privateKeyPem) return success(null);
		return ActorKeys.import({ actor: ACTOR_ID, privateKeyPem });
	}
}

/**
 * The PEM in the `ACTIVITYPUB_PRIVATE_KEY` binding, or `null` when it cannot be read, which
 * leaves the actor unable to sign until the secret is set.
 */
async function readSecret(): Promise<string | null> {
	try {
		return (await env.ACTIVITYPUB_PRIVATE_KEY.get()) || null;
	} catch {
		return null;
	}
}

/** The provider every request and job in this isolate signs with, so the import happens once. */
export const BLOG_KEYS = new BlogKeyProvider(readSecret);
