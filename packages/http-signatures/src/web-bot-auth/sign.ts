/**
 * Signs an outgoing request as a Web Bot Auth agent: RFC 9421 under `tag="web-bot-auth"`,
 * the key's thumbprint as `keyid`, a bounded lifetime, and a covered `Signature-Agent`
 * member naming where any origin finds the key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { failure, isFailure } from "@sdxc/result";

import type { Component } from "../types.js";

import { HttpSignatureError } from "../errors.js";
import { sign } from "../sign.js";

import type { WebBotAuthKey } from "./key.js";
import type { SignatureAgent } from "./signature-agent.js";

import {
	DEFAULT_AGENT_TYPE,
	parseSignatureAgent,
	stringifySignatureAgent,
} from "./signature-agent.js";

/** The `tag` every Web Bot Auth request signature carries. */
export const WEB_BOT_AUTH_TAG = "web-bot-auth";

/** What a signature covers by default: the authority the draft requires, narrowed to one method and path. */
const DEFAULT_COMPONENTS = ["@authority", "@method", "@path"];

/** How long a signature stays valid unless the caller says otherwise; the draft caps it at a day. */
const DEFAULT_EXPIRES_IN = "5 minutes";

/** The label a signature is written under when the caller names none. */
const DEFAULT_LABEL = "sig1";

/** How a Web Bot Auth agent signs. */
export interface WebBotAuthSignOptions {
	key: WebBotAuthKey;
	/** The https origin serving the key directory, such as `https://bot.example.com`. */
	agent: string;
	/** How `agent` resolves to keys. @default "directory" */
	agentType?: string;
	/**
	 * What to cover beside the `Signature-Agent` member, which is always added. It must
	 * include `@authority` or `@target-uri`. @default ["@authority", "@method", "@path"]
	 */
	components?: Array<string | Component>;
	/** @default new Date() */
	created?: Date;
	/** How long the signature is valid for. @default "5 minutes" */
	expiresIn?: DurationInput;
	nonce?: string;
	/** @default "sig1" */
	label?: string;
}

/**
 * Signs a request as a Web Bot Auth agent, answering a copy with `Signature-Agent`,
 * `Signature-Input` and `Signature`. A request already carrying signatures keeps them, and
 * its `Signature-Agent` keeps the other labels' members.
 *
 * @param request - The request to sign; its body is carried over.
 * @param options - The key, the agent URL, coverage and lifetime.
 * @returns The signed copy, `insufficient-coverage` without `@authority` or `@target-uri`,
 *   `malformed` for an agent that is no https URL, or a signing failure.
 * @example await signWebBotAuth(request, { key, agent: "https://bot.example.com" })
 */
export async function signWebBotAuth(
	request: Request,
	options: WebBotAuthSignOptions,
): Promise<Result<Request, HttpSignatureError>> {
	let label = options.label ?? DEFAULT_LABEL;
	let components: Component[] = (options.components ?? DEFAULT_COMPONENTS).map((component) =>
		typeof component === "string" ? { name: component } : component,
	);
	if (!components.some(({ name }) => name === "@authority" || name === "@target-uri")) {
		return failure(
			new HttpSignatureError(
				"insufficient-coverage",
				"A Web Bot Auth signature covers @authority or @target-uri",
			),
		);
	}
	components = [
		...components.filter(({ name }) => name !== "signature-agent"),
		{ name: "signature-agent", params: { key: label } },
	];

	let agent: SignatureAgent = { uri: options.agent, type: options.agentType ?? DEFAULT_AGENT_TYPE };
	let header = signatureAgentWith(request.headers.get("signature-agent"), label, agent);
	if (isFailure(header)) return header;

	let headers = new Headers([...request.headers]);
	headers.set("signature-agent", header.data);

	let created = options.created ?? new Date();
	let expires = new Date(created.getTime() + toMs(options.expiresIn ?? DEFAULT_EXPIRES_IN));
	return await sign(new Request(request, { headers }), {
		scheme: "rfc9421",
		key: {
			id: options.key.keyid,
			privateKey: options.key.privateKey,
			algorithm: options.key.algorithm,
		},
		components,
		created,
		expires,
		...(options.nonce !== undefined && { nonce: options.nonce }),
		tag: WEB_BOT_AUTH_TAG,
		label,
	});
}

/**
 * A signer for `follow`'s `sign` option from `@sdxc/outbound`, signing every hop with the
 * same key and agent.
 *
 * @param options - What `signWebBotAuth` takes.
 * @example follow(url, { sign: webBotAuthSigner({ key, agent: "https://bot.example.com" }) })
 */
export function webBotAuthSigner(
	options: WebBotAuthSignOptions,
): (request: Request) => Promise<Result<Request, HttpSignatureError>> {
	return (request) => signWebBotAuth(request, options);
}

/**
 * `Signature-Agent` with the label's member set: other members are kept, and a value that
 * is no Dictionary of agents, such as the legacy bare String, is replaced.
 *
 * @param existing - The request's current value.
 * @param label - The signature label the member is keyed by.
 * @param agent - The member.
 */
function signatureAgentWith(
	existing: string | null,
	label: string,
	agent: SignatureAgent,
): Result<string, HttpSignatureError> {
	if (!URL.canParse(agent.uri) || new URL(agent.uri).protocol !== "https:") {
		return failure(new HttpSignatureError("malformed", "The agent is not an https URL"));
	}

	let parsed = existing === null ? null : parseSignatureAgent(existing);
	let agents = parsed !== null && !isFailure(parsed) ? parsed.data : {};
	return stringifySignatureAgent({ ...agents, [label]: agent });
}
