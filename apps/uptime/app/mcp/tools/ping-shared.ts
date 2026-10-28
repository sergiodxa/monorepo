/**
 * Shared ad-hoc ping execution for the three MCP tools that mirror `POST /api/v1/ping`'s
 * HTTP, DNS and TCP arms — one tool each, because MCP tool inputs must be a root object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyRequestContext } from "@sdxc/mcp/server";

import { ToolError } from "@sdxc/mcp/server";
import { generateUUID } from "@sdxc/uuid/v7";

import type { ContentCheckRule } from "~/app/models/content-checks";
import type { PingStatus } from "~/app/services/analytics";
import type { DnsRecordType } from "~/app/services/dns/record-value";

import abilities from "~/app/policies/abilities";
import { recordAdhocPing } from "~/app/services/adhoc-ping";
import { apportionCostByTeam } from "~/app/services/cost";
import { checkDns } from "~/app/services/dns/check";
import { HttpCheck } from "~/app/services/http-check";
import { checkTcpConnection } from "~/app/services/tcp-check";
import { encodeId } from "~/app/services/typed-id";

/** One content-check rule as the HTTP ping tool accepts it. */
export interface PingContentCheckInput {
	type: "contains" | "not_contains" | "regex";
	value: string;
	caseSensitive: boolean;
}

/** Arguments for an HTTP ad-hoc ping tool call. */
export interface PingHttpInput {
	url: string;
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
	expectedStatus: number;
	timeoutSeconds: number;
	degradedAfterMs: number;
	region: "wnam" | "enam" | "sam" | "weur" | "eeur" | "apac" | "oc" | "afr" | "me";
	headers?: Record<string, string>;
	body?: string;
	contentChecks: PingContentCheckInput[];
}

/** Arguments for a DNS ad-hoc ping tool call. */
export interface PingDnsInput {
	domain: string;
	recordType: DnsRecordType;
	expectedValue?: string;
}

/** Arguments for a TCP ad-hoc ping tool call. */
export interface PingTcpInput {
	host: string;
	port: number;
	timeoutMs: number;
}

interface PingResult {
	status: PingStatus;
	responseTimeMs: number;
	details: Record<string, unknown>;
}

/** Turns a tool content check into the rule the evaluator takes. */
function toContentCheckRule(check: PingContentCheckInput): ContentCheckRule {
	return {
		type: check.type,
		value: check.value,
		case_sensitive: check.caseSensitive,
		is_enabled: true,
	};
}

/**
 * Ensures the key may reach the ad-hoc ping API and that billing allows a check.
 *
 * @param ctx - The authenticated MCP request.
 */
async function assertPingAllowed(ctx: AnyRequestContext): Promise<void> {
	await ctx.access.load(abilities.ping.api);
	if (!ctx.access.can(abilities.ping.api)) {
		throw new ToolError("Ad-hoc pings are unavailable");
	}

	await ctx.access.load(abilities.checks.run);
	if (!ctx.access.can(abilities.checks.run)) {
		throw new ToolError("An active subscription is required to run a ping");
	}
}

/**
 * Records and returns one ad-hoc ping result under the team's cost attribution.
 *
 * @param ctx - The authenticated MCP request.
 * @param type - Which arm of the REST ping body this tool stands for.
 * @param result - What the probe observed.
 */
function finish(
	ctx: AnyRequestContext,
	type: "http" | "dns" | "tcp",
	result: PingResult,
): { ping: Record<string, unknown> } {
	apportionCostByTeam([ctx.apiTeam.id]);
	let id = generateUUID();

	recordAdhocPing(ctx.billing, {
		id,
		team: ctx.apiTeam,
		status: result.status,
		responseTimeMs: result.responseTimeMs,
	});

	return {
		ping: {
			id: encodeId("ping", id),
			type,
			status: result.status,
			responseTimeMs: result.responseTimeMs,
			checkedAt: new Date().toISOString(),
			...result.details,
		},
	};
}

/**
 * Runs one throwaway HTTP check for the MCP `ping_http` tool.
 *
 * @param ctx - The authenticated MCP request.
 * @param input - The tool's validated arguments.
 */
export async function runPingHttp(ctx: AnyRequestContext, input: PingHttpInput) {
	await assertPingAllowed(ctx);

	let check = new HttpCheck({
		url: input.url,
		method: input.method,
		headers: input.headers,
		body: input.body,
		expectedStatus: input.expectedStatus,
		degradedAfterMs: input.degradedAfterMs,
		timeoutSeconds: input.timeoutSeconds,
		locationHint: input.region,
		shardKey: input.url,
		contentChecks: input.contentChecks.map(toContentCheckRule),
	});

	let { outcome, contentChecksPassed, status } = await check.run();

	return finish(ctx, "http", {
		status,
		responseTimeMs: outcome.responseTimeMs ?? 0,
		details: { responseStatus: outcome.responseStatus, contentChecksPassed },
	});
}

/**
 * Runs one throwaway DNS lookup for the MCP `ping_dns` tool.
 *
 * @param ctx - The authenticated MCP request.
 * @param input - The tool's validated arguments.
 */
export async function runPingDns(ctx: AnyRequestContext, input: PingDnsInput) {
	await assertPingAllowed(ctx);

	let result = await checkDns(input.domain, input.recordType, input.expectedValue ?? null, null);

	return finish(ctx, "dns", {
		status: result.status,
		responseTimeMs: result.responseTimeMs,
		details: {
			resolvedValue: result.resolvedValue,
			errorMessage: result.errorMessage ?? null,
		},
	});
}

/**
 * Runs one throwaway TCP connect for the MCP `ping_tcp` tool.
 *
 * @param ctx - The authenticated MCP request.
 * @param input - The tool's validated arguments.
 */
export async function runPingTcp(ctx: AnyRequestContext, input: PingTcpInput) {
	await assertPingAllowed(ctx);

	let result = await checkTcpConnection(input.host, input.port, input.timeoutMs);

	return finish(ctx, "tcp", {
		status: result.status,
		responseTimeMs: result.responseTimeMs ?? 0,
		details: { errorMessage: result.errorMessage ?? null },
	});
}
