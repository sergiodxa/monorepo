/**
 * Team access as a mockup: the members with their roles, and the API keys with their
 * scopes and last use, including the `mcp` key an agent connects with. `lead` puts the
 * keys first for a page about the API.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { Badge } from "@sdxc/ui";

import type { ApiKeyScope } from "~/database/schema";

import {
	DrawnButton,
	MockupWindow,
	Mono,
	Muted,
	Name,
	PageTitle,
	Panel,
	Rows,
} from "~/resources/components/marketing/product-mockups/parts";

/** What the mockup leads with. */
export type TeamLead = "members" | "keys";

/** Members: address and role key under `page.members.membersTable.role`. */
const MEMBERS = [
	["owner@example.com", "owner"],
	["oncall@example.com", "admin"],
	["dev@example.com", "member"],
] as const;

/** Keys: name, prefix, scopes and last use (UTC). */
const KEYS: ReadonlyArray<readonly [string, string, readonly ApiKeyScope[], string]> = [
	["CI deploys", "upt_7f3a…", ["monitors:write"], "14:02"],
	["Agent (MCP)", "upt_c91e…", ["mcp", "monitors:read"], "13:58"],
	["Grafana", "upt_04bd…", ["monitors:read"], "11:30"],
];

/** Draws the team's members and API keys, the `lead` panel first. */
export default function TeamMockup(handle: Handle<{ t: Translate; lead: TeamLead }>) {
	return () => {
		let { lead, t } = handle.props;
		let panels: Record<TeamLead, RemixNode> = {
			members: (
				<Panel key="members" title={t("page.members.sections.members.title")} flush>
					<Rows
						columns="minmax(0, 1fr) auto"
						head={[
							t("page.members.membersTable.columns.name"),
							t("page.members.membersTable.columns.role"),
						]}
						rows={MEMBERS.map(([email, role]) => ({
							key: email,
							cells: [
								<Mono>{email}</Mono>,
								<Badge color={role === "owner" ? "brand" : "neutral"} variant="secondary">
									{t(`page.members.membersTable.role.${role}`)}
								</Badge>,
							],
						}))}
					/>
				</Panel>
			),
			keys: (
				<Panel key="keys" title={t("page.apiKeys.table.label")} flush>
					<Rows
						columns="minmax(0, 0.9fr) auto minmax(0, 1.2fr) auto"
						head={[
							t("page.apiKeys.table.columns.name"),
							t("page.apiKeys.table.columns.prefix"),
							t("page.apiKeys.table.columns.scopes"),
							t("page.apiKeys.table.columns.lastUsed"),
						]}
						rows={KEYS.map(([name, prefix, scopes, lastUsed]) => ({
							key: name,
							cells: [
								<Name>{name}</Name>,
								<Mono muted>{prefix}</Mono>,
								<span mix={[hstack({ gap: 1, align: "center" }), raw({ flexWrap: "wrap" })]}>
									{scopes.map((scope) => (
										<Badge key={scope} color="neutral" variant="secondary">
											{scope}
										</Badge>
									))}
								</span>,
								<Muted>{lastUsed}</Muted>,
							],
						}))}
					/>
				</Panel>
			),
		};
		let order: TeamLead[] = lead === "keys" ? ["keys", "members"] : ["members", "keys"];
		return (
			<MockupWindow
				label={t(lead === "keys" ? "landing.mockups.apiKeys" : "landing.mockups.team")}
				title={t(lead === "keys" ? "page.apiKeys.header.title" : "page.members.header.title")}
				active={lead === "keys" ? "apiKeys" : "settings"}
			>
				<PageTitle
					title={t(lead === "keys" ? "page.apiKeys.header.title" : "page.members.header.title")}
					end={
						<DrawnButton>
							{t(
								lead === "keys"
									? "page.apiKeys.header.action.create"
									: "page.members.header.action.invite",
							)}
						</DrawnButton>
					}
				/>
				{order.map((panel) => panels[panel])}
			</MockupWindow>
		);
	};
}
