/**
 * The reader's Web Bot Auth identity: the key in `WEB_BOT_AUTH_KEY` signs every feed and
 * article request, and `/.well-known/http-message-signatures-directory` publishes its
 * public half, so a publisher can verify which reader is polling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WebBotAuthKey } from "@sdxc/http-signatures/web-bot-auth";
import type { Result } from "@sdxc/result";

import {
	importWebBotAuthKey,
	signDirectoryResponse,
	webBotAuthSigner,
} from "@sdxc/http-signatures/web-bot-auth";
import { currentLog } from "@sdxc/logger";
import { isFailure } from "@sdxc/result";
import {
	build,
	httpMessageSignaturesDirectory,
} from "@sdxc/well-known/http-message-signatures-directory";
import { serve } from "@sdxc/well-known/middleware";
import { env } from "cloudflare:workers";

/** Each secret's imported key, by the secret's text, so a rotated secret imports afresh. */
const IMPORTED_KEYS = new Map<string, Promise<WebBotAuthKey | null>>();

/**
 * The signing key, imported once per isolate, or `null` while the deployment carries no
 * `WEB_BOT_AUTH_KEY`, which leaves requests unsigned and the directory unserved. A secret
 * that is no usable private JWK is logged and treated as unset.
 *
 * @example let key = await webBotAuthKey();
 */
export function webBotAuthKey(): Promise<WebBotAuthKey | null> {
	let secret = env.WEB_BOT_AUTH_KEY;
	if (!secret) return Promise.resolve(null);

	let imported = IMPORTED_KEYS.get(secret) ?? importSecret(secret);
	IMPORTED_KEYS.set(secret, imported);
	return imported;
}

/**
 * Reads the secret as a private JWK and imports it.
 *
 * @param secret - The JSON text of the private JWK.
 */
async function importSecret(secret: string): Promise<WebBotAuthKey | null> {
	let jwk: unknown;
	try {
		jwk = JSON.parse(secret);
	} catch {
		currentLog()?.warn("web-bot-auth.key.invalid", { reason: "WEB_BOT_AUTH_KEY is not JSON" });
		return null;
	}

	let key = await importWebBotAuthKey(jwk as Parameters<typeof importWebBotAuthKey>[0]);
	if (isFailure(key)) {
		currentLog()?.warn("web-bot-auth.key.invalid", { reason: key.error.message });
		return null;
	}
	return key.data;
}

/**
 * The `sign` option for outbound fetches: a Web Bot Auth signer naming this app's origin
 * as the agent, or `undefined` without a key, so a fetch goes out unsigned.
 *
 * @example await Feed.fetch(url, { sign: await requestSigner() });
 */
export async function requestSigner(): Promise<
	((request: Request) => Promise<Result<Request, Error>>) | undefined
> {
	let key = await webBotAuthKey();
	if (key === null) return undefined;
	return webBotAuthSigner({ key, agent: new URL(env.APP_URL).origin });
}

/**
 * The key directory, signed with the key it publishes so a verifier can bind it to this
 * origin. Without a key it falls through to the next handler, a 404. A signing failure is
 * logged and the directory served unsigned, since verifying a request needs only the keys.
 */
export const signaturesDirectory = serve(
	httpMessageSignaturesDirectory,
	async () => {
		let key = await webBotAuthKey();
		if (key === null) return null;
		let directory = build([key.publicKey]);
		return isFailure(directory) ? null : directory.data;
	},
	{
		async sign(response, request) {
			let key = await webBotAuthKey();
			if (key === null || request === undefined) return response;
			let signed = await signDirectoryResponse(response, request, { keys: [key] });
			if (isFailure(signed)) {
				currentLog()?.warn("web-bot-auth.directory.unsigned", { reason: signed.error.message });
				return response;
			}
			return signed.data;
		},
	},
);
