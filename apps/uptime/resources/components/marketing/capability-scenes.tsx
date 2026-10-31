/**
 * Product scenes for the capability cards: certificates counting down to expiry, tracked
 * DNS records, alert channels, a flow run, a browser spec and the MCP tools an agent calls.
 * Each shares the card frame of the monitor, alert and status page scenes, so a grid lines up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { CheckIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";
import { Badge } from "@sdxc/ui";

import type { BadgeTone } from "~/resources/components/badge";

import { badgeVariant } from "~/resources/components/badge";
import { sceneFrame, sceneHost, scenePanel } from "~/resources/components/marketing/product-scenes";

/** Days a certificate's bar spans when full: the 90-day lifetime of an ACME certificate. */
const CERTIFICATE_DAYS = 90;

/** Sample certificates: host, days left, and the status key under `page.monitor.ssl.status`. */
const CERTIFICATES = [
	["api.example.com", 64, "valid"],
	["example.com", 41, "valid"],
	["status.example.com", 9, "expiring"],
] as const;

/** The badge tone each certificate status draws in. */
const CERTIFICATE_TONE: Record<(typeof CERTIFICATES)[number][2], BadgeTone> = {
	valid: "up",
	expiring: "degraded",
};

/** Sample tracked records: type, value, and the state key under `page.dnsMonitorDetail.records.state`. */
const RECORDS = [
	["A", "203.0.113.10", "ok"],
	["MX", "10 mail.example.com", "ok"],
	["CNAME", "example.com", "ok"],
	["TXT", "v=spf1 include:_spf.example.net ~all", "changed"],
] as const;

/** The badge tone each record state draws in. */
const RECORD_TONE: Record<(typeof RECORDS)[number][2], BadgeTone> = {
	ok: "up",
	changed: "degraded",
};

/** Sample alert channels: the channel's name and its type key under `page.alerts.table.types`. */
const CHANNELS = [
	["#incidents", "slack"],
	["On-call", "pagerduty"],
	["#ops", "discord"],
	["Ops inbox", "email"],
	["deploy-hook", "webhook"],
] as const;

/** The documented sign-in flow: each step's label key beside the spec line it runs. */
const FLOW_STEPS = [
	["landing.flows.diagram.signIn", 'http.post "/api/sessions" form { … }'],
	["landing.flows.diagram.token", "session.json.token"],
	["landing.flows.diagram.call", 'http.get "/v1/account" bearer session.json.token'],
	["landing.flows.diagram.check", "expect account.status 200"],
] as const;

/** The sign-in browser spec's actions, in the spec language, which stays English everywhere. */
const BROWSER_STEPS = [
	'browser.fill textbox "Email"',
	'browser.fill textbox "Password"',
	'browser.click button "Sign in"',
	'expect browser.heading "Dashboard"',
] as const;

/** Tools an agent calls over a working session, named as the MCP server lists them. */
const MCP_TOOLS = [
	"list_monitors",
	"get_monitor_stats",
	"list_alert_events",
	"create_monitor",
	"create_maintenance",
] as const;

/** One row of a scene: content at the start, a status at the end, ruled from the row above. */
function sceneRow() {
	return raw({
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "0.5rem",
		minInlineSize: "0",
		paddingBlock: "0.625rem",
		borderBlockStart: "1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))",
	});
}

/** A spec or tool line in mono, truncated rather than wrapped. */
function codeLine() {
	return raw({
		fontFamily: "var(--ui-font-mono)",
		fontSize: "0.75rem",
		color: "var(--ui-neutral-fg-muted)",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
		minInlineSize: "0",
	});
}

/** A passed step's mark: a check in the success ink. */
function Passed() {
	return () => (
		<CheckIcon
			size={14}
			strokeWidth={2}
			mix={[raw({ flexShrink: "0", color: "var(--ui-success-fg)" })]}
		/>
	);
}

/** Wraps a scene's rows in the shared frame and panel; the rows rule themselves apart. */
function Scene(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div aria-hidden="true" mix={[sceneFrame()]}>
			<div
				mix={[
					scenePanel(),
					raw({ gap: "0", paddingBlock: "0.375rem" }),
					when("& > :first-child", raw({ borderBlockStart: "none" })),
				]}
			>
				{handle.props.children}
			</div>
		</div>
	);
}

/** Three certificates, each with the days it has left as a bar; the nearest is expiring. */
export function SslScene(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;

		return (
			<Scene>
				{CERTIFICATES.map(([host, days, status]) => (
					<div
						key={host}
						mix={[sceneRow(), raw({ display: "grid", gap: "0.375rem", justifyContent: "stretch" })]}
					>
						<span mix={[raw({ display: "flex", justifyContent: "space-between", gap: "0.5rem" })]}>
							<span mix={[sceneHost()]}>{host}</span>
							<Badge {...badgeVariant(CERTIFICATE_TONE[status])}>
								{t(`page.monitor.ssl.status.${status}`)}
							</Badge>
						</span>
						<span
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
									color: "var(--ui-neutral-fg-muted)",
									fontSize: "0.75rem",
								}),
							]}
						>
							<span
								mix={[
									raw({
										flex: "1",
										blockSize: "0.375rem",
										borderRadius: "9999px",
										backgroundColor: "var(--ui-neutral-bg-tint)",
										overflow: "hidden",
									}),
								]}
							>
								<span
									mix={[
										raw({
											display: "block",
											blockSize: "100%",
											inlineSize: `${Math.round((days / CERTIFICATE_DAYS) * 100)}%`,
											borderRadius: "inherit",
											backgroundColor:
												status === "valid"
													? "var(--ui-success-bg-solid)"
													: "var(--ui-warning-bg-solid)",
										}),
									]}
								/>
							</span>
							{t("page.monitor.ssl.expiresIn", { days })}
						</span>
					</div>
				))}
			</Scene>
		);
	};
}

/** A domain's tracked records with their state; the SPF record has changed. */
export function DnsScene(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;

		return (
			<Scene>
				{RECORDS.map(([type, value, state]) => (
					<div key={type} mix={[sceneRow()]}>
						<span
							mix={[
								raw({ display: "flex", alignItems: "center", gap: "0.5rem", minInlineSize: "0" }),
							]}
						>
							<Badge color="neutral" variant="secondary">
								{type}
							</Badge>
							<span mix={[sceneHost()]}>{value}</span>
						</span>
						<Badge {...badgeVariant(RECORD_TONE[state])}>
							{t(`page.dnsMonitorDetail.records.state.${state}`)}
						</Badge>
					</div>
				))}
			</Scene>
		);
	};
}

/** One alert sent to every kind of channel the product delivers to. */
export function IntegrationsScene(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;

		return (
			<Scene>
				{CHANNELS.map(([name, type]) => (
					<div key={type} mix={[sceneRow()]}>
						<span
							mix={[
								raw({ display: "flex", alignItems: "center", gap: "0.5rem", minInlineSize: "0" }),
							]}
						>
							<Passed />
							<span mix={[sceneHost()]}>{name}</span>
						</span>
						<Badge color="neutral" variant="secondary">
							{t(`page.alerts.table.types.${type}`)}
						</Badge>
					</div>
				))}
			</Scene>
		);
	};
}

/** A passed run of the sign-in flow: each step over the spec line it ran. */
export function FlowScene(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;

		return (
			<Scene>
				<div mix={[sceneRow()]}>
					<span mix={[raw({ fontWeight: "600", color: "var(--ui-neutral-fg-emphasis)" })]}>
						{t("landing.flows.diagram.passed")}
					</span>
					<Badge {...badgeVariant("up")}>{t("page.flowMonitors.table.status.up")}</Badge>
				</div>
				{FLOW_STEPS.map(([key, code]) => (
					<div key={key} mix={[sceneRow(), raw({ justifyContent: "start" })]}>
						<Passed />
						<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
							<span mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>{t(key)}</span>
							<span mix={[codeLine()]}>{code}</span>
						</span>
					</div>
				))}
			</Scene>
		);
	};
}

/** A browser spec run against a sign-in page: the page's address, then each action passing. */
export function BrowserScene() {
	return () => (
		<Scene>
			<div mix={[sceneRow(), raw({ justifyContent: "start" })]}>
				<span mix={[raw({ display: "flex", gap: "0.25rem" })]}>
					{["a", "b", "c"].map((dot) => (
						<span
							key={dot}
							mix={[
								raw({
									inlineSize: "0.5rem",
									blockSize: "0.5rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-neutral-border)",
								}),
							]}
						/>
					))}
				</span>
				<span
					mix={[
						sceneHost(),
						raw({
							flex: "1",
							paddingBlock: "0.25rem",
							paddingInline: "0.625rem",
							borderRadius: "9999px",
							fontSize: "0.75rem",
							backgroundColor: "var(--ui-neutral-bg-tint)",
						}),
					]}
				>
					app.example.com/login
				</span>
			</div>
			{BROWSER_STEPS.map((step) => (
				<div key={step} mix={[sceneRow(), raw({ justifyContent: "start" })]}>
					<Passed />
					<span mix={[codeLine(), raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>{step}</span>
				</div>
			))}
		</Scene>
	);
}

/** An agent's session against the MCP server: each tool it called, answered. */
export function McpScene() {
	return () => (
		<Scene>
			{MCP_TOOLS.map((tool) => (
				<div key={tool} mix={[sceneRow(), raw({ justifyContent: "start" })]}>
					<Passed />
					<span mix={[codeLine(), raw({ color: "var(--ui-neutral-fg-emphasis)" })]}>{tool}</span>
				</div>
			))}
		</Scene>
	);
}
