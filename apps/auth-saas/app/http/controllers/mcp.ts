/**
 * The MCP endpoint: a Streamable HTTP server exposing the management API as tools, for
 * an agent connecting with a bearer token obtained through an ordinary interactive OAuth
 * flow against the platform tenant. Every refusal happens here, before any tool ever
 * runs, so a token that does not verify never reaches a forwarded request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { RequestContext, RequestHandler } from "remix/router";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { stringify } from "@sdxc/auth/bearer-challenge";
import { metadataUrl } from "@sdxc/well-known/oauth-protected-resource";
import { env } from "cloudflare:workers";

import { verifyManagementBearerToken } from "~/app/http/middleware/management-auth";
import { callManagementTool, listManagementTools } from "~/app/mcp/tools";

/** The MCP server's own identity, unrelated to the management API's own version. */
const SERVER_INFO = { name: "auth-saas-management-mcp", version: "1.0.0" };

/** Where this server's own RFC 9728 metadata is served, from its bare resource identifier. */
function resourceMetadataUrl(): URL {
	return metadataUrl(`https://${env.PLATFORM_DOMAIN}`);
}

/** A `401` whose challenge points at this server's own resource metadata. */
function unauthorized(detail: string, error?: "invalid_token"): Response {
	let headers = new Headers({
		"WWW-Authenticate": stringify({ error, resourceMetadata: resourceMetadataUrl() }),
	});
	return Response.json(
		{ error: "unauthorized", error_description: detail },
		{ status: 401, headers },
	);
}

/**
 * Builds the MCP server for one request, its tool call handler closing over the
 * caller's own already-verified bearer token so every forwarded request carries it.
 *
 * @param token - The caller's bearer token, forwarded unchanged to every tool call.
 */
function buildServer(token: string): Server {
	let server = new Server(SERVER_INFO, { capabilities: { tools: {} } });

	server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listManagementTools() }));

	server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
		let args = (request.params.arguments ?? {}) as Record<string, unknown>;
		return callManagementTool(request.params.name, args, token);
	});

	return server;
}

/**
 * Handles `/mcp`: refuses a request with no bearer token, or one that does not
 * verify against the platform tenant's own published keys, before an MCP server is
 * even built for it. A verified token gets a fresh, stateless MCP server whose
 * tool calls forward that same token to the real management route.
 *
 * @param ctx - The request context.
 * @returns The `401` refusal, or the Streamable HTTP transport's own response.
 */
const mcp: RequestHandler = async (ctx: RequestContext): Promise<Response> => {
	let authorization = ctx.request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) {
		return unauthorized("A bearer token is required.");
	}

	let token = authorization.slice("Bearer ".length).trim();
	if (!token) return unauthorized("A bearer token is required.");

	let verified = await verifyManagementBearerToken(token);
	if (verified === null) return unauthorized("The bearer token did not verify.", "invalid_token");

	let server = buildServer(token);
	let transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true,
	});
	await server.connect(transport);

	return await transport.handleRequest(ctx.request);
};

export default mcp;
