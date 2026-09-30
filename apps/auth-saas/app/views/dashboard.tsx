/**
 * `remix/ui` views for the platform's own administrative dashboard: the tenant list
 * and create-tenant form, and a tenant's agent-clients list and registration form.
 * Rendered inside `landing.tsx`'s own `PublicDocument` shell, with the same plain
 * English copy and module-level `css()` mixins `signup.tsx` already established —
 * this router carries no i18n middleware, so every string here is written directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { AgentClientBindingRow } from "~/app/models/agent-client-binding";
import type { AdministeredTenant, MembershipRole } from "~/app/models/membership";
import type { ManagementScope } from "~/app/services/management-scopes";

let pageWrap = css({
	minHeight: "100vh",
	display: "flex",
	justifyContent: "center",
	padding: "3rem 1rem",
});

let pageColumn = css({
	width: "100%",
	maxWidth: "42rem",
	display: "flex",
	flexDirection: "column",
	gap: "1.5rem",
});

let topBar = css({ display: "flex", justifyContent: "space-between", alignItems: "center" });

let pageTitle = css({ fontSize: "1.75rem", fontWeight: "700", margin: "0", color: "#111827" });

let signOutButton = css({
	background: "none",
	border: "none",
	color: "#6b7280",
	fontSize: "0.875rem",
	cursor: "pointer",
	textDecoration: "underline",
	padding: "0",
});

let card = css({
	background: "#ffffff",
	borderRadius: "0.75rem",
	padding: "2rem",
	boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
});

let cardTitle = css({
	fontSize: "1.25rem",
	fontWeight: "700",
	margin: "0 0 1rem",
	color: "#111827",
});

let tenantList = css({
	display: "flex",
	flexDirection: "column",
	gap: "0.75rem",
	margin: "0 0 1.5rem",
});

let tenantRow = css({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	padding: "0.75rem 1rem",
	border: "1px solid #e5e7eb",
	borderRadius: "0.5rem",
});

let tenantName = css({ fontWeight: "600", color: "#111827" });

let tenantMeta = css({ fontSize: "0.8125rem", color: "#6b7280" });

let link = css({
	color: "#2563eb",
	textDecoration: "none",
	fontSize: "0.875rem",
	"&:hover": { textDecoration: "underline" },
});

let emptyState = css({ color: "#6b7280", margin: "0 0 1.5rem" });

let formStack = css({ display: "flex", flexDirection: "column", gap: "1rem" });

let fieldLabel = css({
	display: "block",
	fontSize: "0.875rem",
	fontWeight: "500",
	color: "#374151",
	marginBottom: "0.25rem",
});

let fieldInput = css({
	width: "100%",
	boxSizing: "border-box",
	padding: "0.5rem 0.75rem",
	borderRadius: "0.5rem",
	border: "1px solid #e5e7eb",
	fontSize: "1rem",
});

let fieldError = css({ color: "#dc2626", fontSize: "0.8125rem", margin: "0.25rem 0 0" });

let submitButton = css({
	display: "inline-block",
	background: "#2563eb",
	color: "#ffffff",
	padding: "0.625rem 1rem",
	borderRadius: "0.5rem",
	border: "none",
	fontSize: "1rem",
	fontWeight: "500",
	cursor: "pointer",
	"&:hover": { background: "#1d4ed8" },
});

let errorBanner = css({
	background: "#fef2f2",
	color: "#991b1b",
	padding: "0.75rem 1rem",
	borderRadius: "0.5rem",
	fontSize: "0.875rem",
	margin: "0 0 1rem",
});

let secretBanner = css({
	background: "#fffbeb",
	border: "1px solid #fde68a",
	color: "#92400e",
	padding: "1rem",
	borderRadius: "0.5rem",
	margin: "0 0 1.5rem",
});

let secretValue = css({
	display: "block",
	fontFamily: "ui-monospace, monospace",
	fontSize: "0.875rem",
	background: "#ffffff",
	border: "1px solid #fde68a",
	borderRadius: "0.375rem",
	padding: "0.5rem 0.75rem",
	margin: "0.5rem 0",
	wordBreak: "break-all",
});

let scopeGrid = css({ display: "flex", flexDirection: "column", gap: "0.5rem" });

let scopeOption = css({
	display: "flex",
	alignItems: "flex-start",
	gap: "0.5rem",
	fontSize: "0.875rem",
});

let scopeTitle = css({ fontWeight: "500", color: "#111827" });

let scopeDescription = css({ color: "#6b7280", display: "block", fontWeight: "400" });

let mutedText = css({ color: "#6b7280", fontSize: "0.875rem" });

/**
 * Reads the first issue addressed to a field by name, the same `path`-joining
 * convention `signup.tsx`'s own `fieldIssue` follows.
 *
 * @param issues - The submission's validation issues, if any.
 * @param name - The field name to look up.
 * @returns The first matching issue's message, or undefined.
 */
function fieldIssue(
	issues: ReadonlyArray<Form.Issue> | undefined,
	name: string,
): string | undefined {
	return issues?.find((issue) => issue.path?.[0] === name)?.message;
}

/**
 * Every issue with no field path at all — a refusal decided before any field
 * was reached.
 *
 * @param issues - The submission's validation issues, if any.
 * @returns The form-level issues' messages, joined for display.
 */
function formIssue(issues: ReadonlyArray<Form.Issue> | undefined): string | undefined {
	let messages = issues?.filter((issue) => !issue.path?.length).map((issue) => issue.message);
	return messages?.length ? messages.join(" ") : undefined;
}

/** The sign-out control every dashboard page carries in its top bar. */
export function SignOutForm(handle: Handle<{ action: string }>) {
	return () => (
		<form method="post" action={handle.props.action}>
			<button mix={[signOutButton]} type="submit">
				Sign out
			</button>
		</form>
	);
}

export namespace DashboardHomePage {
	export interface Props {
		/** Every tenant the signed-in subject administers, paired with their role there. */
		tenants: ReadonlyArray<AdministeredTenant>;
		/** Where the create-tenant form posts back to. */
		createTenantAction: string;
		/** Builds the href to a tenant's own agent-clients page. */
		agentClientsHref: (tenantId: string) => string;
		/** Where the sign-out form posts back to. */
		signOutAction: string;
		organizationName?: string;
		issues?: ReadonlyArray<Form.Issue>;
	}
}

/**
 * `GET /dashboard` — every tenant the signed-in subject administers, and a form to
 * create another one under the same customer.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the dashboard home page's markup.
 */
export function DashboardHomePage(handle: Handle<DashboardHomePage.Props>) {
	return () => {
		let { tenants, createTenantAction, agentClientsHref, signOutAction, organizationName, issues } =
			handle.props;
		let topIssue = formIssue(issues);

		return (
			<div mix={[pageWrap]}>
				<div mix={[pageColumn]}>
					<div mix={[topBar]}>
						<h1 mix={[pageTitle]}>Your tenants</h1>
						<SignOutForm action={signOutAction} />
					</div>

					<div mix={[card]}>
						{tenants.length === 0 ? (
							<p mix={[emptyState]}>You don't administer any tenant yet.</p>
						) : (
							<div mix={[tenantList]}>
								{tenants.map(({ tenant, role }) => (
									<div mix={[tenantRow]} key={tenant.id}>
										<div>
											<div mix={[tenantName]}>{tenant.name}</div>
											<div mix={[tenantMeta]}>
												{tenant.slug} · {tenant.issuer} · {tenant.plan_slug} · {role}
											</div>
										</div>
										<a mix={[link]} href={agentClientsHref(tenant.id)}>
											Agent clients
										</a>
									</div>
								))}
							</div>
						)}

						<h2 mix={[cardTitle]}>Create a tenant</h2>
						{topIssue && <div mix={[errorBanner]}>{topIssue}</div>}
						<form method="post" action={createTenantAction} mix={[formStack]}>
							<div>
								<label mix={[fieldLabel]} htmlFor="organizationName">
									Organization name
								</label>
								<input
									mix={[fieldInput]}
									id="organizationName"
									name="organizationName"
									type="text"
									required
									value={organizationName}
								/>
								{fieldIssue(issues, "organizationName") && (
									<p mix={[fieldError]}>{fieldIssue(issues, "organizationName")}</p>
								)}
							</div>
							<button mix={[submitButton]} type="submit">
								Create tenant
							</button>
						</form>
					</div>
				</div>
			</div>
		);
	};
}

export namespace AgentClientsPage {
	export interface Props {
		tenant: { id: string; name: string };
		role: MembershipRole;
		clients: ReadonlyArray<AgentClientBindingRow>;
		scopes: ReadonlyArray<ManagementScope>;
		scopeTitles: Record<ManagementScope, string>;
		scopeDescriptions: Record<ManagementScope, string>;
		/** Where the registration form posts back to. */
		registerAction: string;
		/** Where the sign-out form posts back to. */
		signOutAction: string;
		backHref: string;
		name?: string;
		selectedScopes?: ReadonlyArray<string>;
		issues?: ReadonlyArray<Form.Issue>;
		/** The client id and plaintext secret a registration just minted, shown exactly once. */
		justRegistered?: { clientId: string; secret: string } | null;
	}
}

/**
 * `GET/POST /dashboard/tenants/:tenantId/agent-clients` — every machine credential
 * registered against a tenant, and a form to register another one. A registration's
 * plaintext secret is rendered once, on the response to that same submission; no
 * later load of this page ever shows it again, since nothing but this response ever
 * carries it.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the agent-clients page's markup.
 */
export function AgentClientsPage(handle: Handle<AgentClientsPage.Props>) {
	return () => {
		let {
			tenant,
			role,
			clients,
			scopes,
			scopeTitles,
			scopeDescriptions,
			registerAction,
			signOutAction,
			backHref,
			name,
			selectedScopes,
			issues,
			justRegistered,
		} = handle.props;
		let topIssue = formIssue(issues);
		let selected = new Set(selectedScopes ?? []);

		return (
			<div mix={[pageWrap]}>
				<div mix={[pageColumn]}>
					<div mix={[topBar]}>
						<div>
							<a mix={[link]} href={backHref}>
								&larr; Your tenants
							</a>
							<h1 mix={[pageTitle]}>{tenant.name} — agent clients</h1>
						</div>
						<SignOutForm action={signOutAction} />
					</div>

					{justRegistered && (
						<div mix={[secretBanner]}>
							<strong>Copy this secret now — you won't see it again.</strong>
							<span mix={[mutedText]}>Client id</span>
							<code mix={[secretValue]}>{justRegistered.clientId}</code>
							<span mix={[mutedText]}>Secret</span>
							<code mix={[secretValue]}>{justRegistered.secret}</code>
						</div>
					)}

					<div mix={[card]}>
						<h2 mix={[cardTitle]}>Registered clients</h2>
						{clients.length === 0 ? (
							<p mix={[emptyState]}>No agent clients registered yet.</p>
						) : (
							<div mix={[tenantList]}>
								{clients.map((client) => (
									<div mix={[tenantRow]} key={client.client_id}>
										<div>
											<div mix={[tenantName]}>{client.client_id}</div>
											<div mix={[tenantMeta]}>
												Registered {new Date(client.created_at).toLocaleString()}
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>

					{role !== "member" && (
						<div mix={[card]}>
							<h2 mix={[cardTitle]}>Register a new agent client</h2>
							{topIssue && <div mix={[errorBanner]}>{topIssue}</div>}
							<form method="post" action={registerAction} mix={[formStack]}>
								<div>
									<label mix={[fieldLabel]} htmlFor="name">
										Name
									</label>
									<input
										mix={[fieldInput]}
										id="name"
										name="name"
										type="text"
										required
										value={name}
									/>
									{fieldIssue(issues, "name") && (
										<p mix={[fieldError]}>{fieldIssue(issues, "name")}</p>
									)}
								</div>

								<div>
									<span mix={[fieldLabel]}>Scopes</span>
									<div mix={[scopeGrid]}>
										{scopes.map((scope) => (
											<label mix={[scopeOption]} key={scope}>
												<input
													type="checkbox"
													name="scopes"
													value={scope}
													checked={selected.has(scope)}
												/>
												<span mix={[scopeTitle]}>
													{scopeTitles[scope]}
													<span mix={[scopeDescription]}>{scopeDescriptions[scope]}</span>
												</span>
											</label>
										))}
									</div>
									{fieldIssue(issues, "scopes") && (
										<p mix={[fieldError]}>{fieldIssue(issues, "scopes")}</p>
									)}
								</div>

								<button mix={[submitButton]} type="submit">
									Register client
								</button>
							</form>
						</div>
					)}
				</div>
			</div>
		);
	};
}
