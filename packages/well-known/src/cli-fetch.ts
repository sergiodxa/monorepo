/**
 * The `sdxc-well-known fetch` handler: builds the URL a document lives at for an identifier,
 * fetches it, validates it with the document's own reader and prints it. NodeInfo follows its
 * links document to the newest schema it names, so the printed document is the server's own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UsageError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { DocumentName } from "./cli-contract.js";
import type { Retrieved } from "./cli-input.js";
import type { WellKnownParseError } from "./parse-error.js";

import * as apiCatalog from "./api-catalog.js";
import { WELL_KNOWN_COMMANDS } from "./cli-contract.js";
import { fetchDocument, readWebUrl, statusIssue } from "./cli-input.js";
import * as signaturesDirectory from "./http-message-signatures-directory.js";
import * as jwks from "./jwks.js";
import * as nodeinfo from "./nodeinfo.js";
import * as authorizationServer from "./oauth-authorization-server.js";
import * as protectedResource from "./oauth-protected-resource.js";
import * as openIdConfiguration from "./openid-configuration.js";
import * as passkeyEndpoints from "./passkey-endpoints.js";
import * as webfinger from "./webfinger.js";
import { wellKnownUrl } from "./well-known-url.js";

/** What `fetch` needs to know about one document. */
interface DocumentReader {
	/** The media types to ask for. */
	accept: string;
	/** Where the document lives for the identifier as typed, or why the flags cannot say. */
	url(identifier: string, flags: { resource?: string; rel: string[] }): Result<URL, UsageError>;
	/** The document's reader, checking it names `identifier` where its specification asks. */
	parse(text: string, identifier: string): Result<unknown, WellKnownParseError>;
}

/**
 * The document `name` serves at the root of the identifier's origin.
 *
 * @param name - The registered name
 */
function atOrigin(name: string): DocumentReader["url"] {
	return (identifier) => success(wellKnownUrl(new URL(identifier).origin, name));
}

/** Every document `fetch` reads; NodeInfo's entry reads the links document it starts from. */
const READERS: Record<DocumentName, DocumentReader> = {
	webfinger: {
		accept: webfinger.MEDIA_TYPE,
		url(identifier, flags) {
			if (flags.resource === undefined) {
				return usage("webfinger needs --resource, such as --resource acct:user@example.com");
			}
			let url = wellKnownUrl(new URL(identifier).origin, webfinger.NAME);
			url.searchParams.set("resource", flags.resource);
			for (let rel of flags.rel) url.searchParams.append("rel", rel);
			return success(url);
		},
		parse: (text) => webfinger.parse(text),
	},
	nodeinfo: {
		accept: nodeinfo.MEDIA_TYPE,
		url: atOrigin(nodeinfo.NAME),
		parse: (text) => nodeinfo.parseLinks(text),
	},
	"oauth-authorization-server": {
		accept: authorizationServer.MEDIA_TYPE,
		url: (identifier) => success(wellKnownUrl(identifier, authorizationServer.NAME)),
		parse: (text, issuer) => authorizationServer.parse(text, { issuer }),
	},
	"openid-configuration": {
		accept: openIdConfiguration.MEDIA_TYPE,
		url: (identifier) => success(wellKnownUrl(identifier, openIdConfiguration.NAME, "append")),
		parse: (text, issuer) => openIdConfiguration.parse(text, { issuer }),
	},
	"oauth-protected-resource": {
		accept: protectedResource.MEDIA_TYPE,
		url: (identifier) => success(protectedResource.metadataUrl(identifier)),
		parse: (text, resource) => protectedResource.parse(text, { resource }),
	},
	"jwks.json": {
		accept: jwks.MEDIA_TYPE,
		url: atOrigin(jwks.NAME),
		parse: (text) => jwks.parse(text),
	},
	"passkey-endpoints": {
		accept: passkeyEndpoints.MEDIA_TYPE,
		url: atOrigin(passkeyEndpoints.NAME),
		parse: (text) => passkeyEndpoints.parse(text),
	},
	"api-catalog": {
		accept: apiCatalog.MEDIA_TYPE,
		url: atOrigin(apiCatalog.NAME),
		parse: (text) => apiCatalog.parse(text),
	},
	"http-message-signatures-directory": {
		accept: signaturesDirectory.MEDIA_TYPE,
		url: atOrigin(signaturesDirectory.NAME),
		parse: (text) => signaturesDirectory.parse(text),
	},
};

/** A fetched document read: where it came from, its body, and its parsed form or its issues. */
interface Outcome {
	retrieved: Retrieved;
	data: unknown;
	issues: WellKnownParseError.Issue[];
}

/**
 * Reads a fetched body, turning a non-2xx status into the outcome's only issue.
 *
 * @param retrieved - The fetched document
 * @param parse - The document's reader
 */
function read(
	retrieved: Retrieved,
	parse: (text: string) => Result<unknown, WellKnownParseError>,
): Outcome {
	let unavailable = statusIssue(retrieved);
	if (unavailable !== null) return { retrieved, data: null, issues: [unavailable] };
	let parsed = parse(retrieved.text);
	if (isFailure(parsed)) return { retrieved, data: null, issues: parsed.error.issues };
	return { retrieved, data: parsed.data, issues: [] };
}

/**
 * The served body for people: indented when it is JSON, verbatim otherwise.
 *
 * @param text - The body as served
 */
function pretty(text: string): string {
	try {
		return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
	} catch {
		return text.endsWith("\n") ? text : `${text}\n`;
	}
}

/**
 * Prints the validated body on stdout, or each problem as `<pointer>: message` on stderr;
 * `--json` prints `{ document, url, valid, issues, data }` with the parsed, camelCase document.
 * NodeInfo answers 2.1 when its links name it, else 2.0.
 */
export default createCommand(WELL_KNOWN_COMMANDS.fetch, async (ctx) => {
	let { identifier, document } = ctx.arguments;
	let checked = readWebUrl(identifier);
	if (isFailure(checked)) return checked;

	let reader = READERS[document];
	let url = reader.url(identifier, ctx.flags);
	if (isFailure(url)) return url;
	let retrieved = await fetchDocument(url.data, reader.accept, ctx);
	if (isFailure(retrieved)) return retrieved;
	let outcome = read(retrieved.data, (text) => reader.parse(text, identifier));

	if (document === "nodeinfo" && outcome.issues.length === 0) {
		let { links } = outcome.data as nodeinfo.NodeInfoLinks;
		let link =
			links.find((entry) => entry.rel === nodeinfo.NODEINFO_2_1) ??
			links.find((entry) => entry.rel === nodeinfo.NODEINFO_2_0);
		if (link === undefined) {
			outcome = {
				...outcome,
				data: null,
				issues: [{ at: "/links", message: "No link names a NodeInfo 2.0 or 2.1 schema." }],
			};
		} else {
			let linked = await fetchDocument(new URL(link.href), nodeinfo.DOCUMENT_MEDIA_TYPE, ctx);
			if (isFailure(linked)) return linked;
			outcome = read(linked.data, nodeinfo.parse);
		}
	}

	let valid = outcome.issues.length === 0;
	if (ctx.flags.json) {
		let report = {
			document,
			url: outcome.retrieved.from,
			valid,
			issues: outcome.issues,
			data: outcome.data,
		};
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
	} else if (valid) {
		ctx.stdout(pretty(outcome.retrieved.text));
	} else {
		ctx.stderr(`${outcome.retrieved.from}\n`);
		for (let issue of outcome.issues) {
			let at = issue.at === "" || issue.at === 0 ? "(document)" : String(issue.at);
			ctx.stderr(`  ${at}: ${issue.message}\n`);
		}
	}
	return valid ? success() : exit(1);
});
