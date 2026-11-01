/**
 * Relay's gallery miniature: the inbox's three panes at a glance, mailboxes with an unread
 * pill, two-line rows with blue unread dots and the selected row in the accent, and the
 * open conversation, so the card reads as a Mail-like inbox before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

/** The mailboxes the miniature's sidebar lists, the first current with its unread count. */
const MAILBOXES = [
	{ label: "Inbox", count: "4" },
	{ label: "Mine", count: "3" },
	{ label: "Unassigned", count: "" },
	{ label: "Snoozed", count: "" },
	{ label: "Contacts", count: "" },
] as const;

/** The rows the miniature's list shows: sender, subject, unread, and the selected one. */
const ROWS = [
	{
		from: "Maya Chen",
		subject: "Invoice shows the wrong seat count",
		unread: true,
		selected: false,
	},
	{ from: "Leo Martins", subject: "Can we move to yearly billing?", unread: true, selected: false },
	{
		from: "Priya Nair",
		subject: "SSO login loops back to the start",
		unread: false,
		selected: true,
	},
	{
		from: "Tom Becker",
		subject: "Export to CSV drops the last row",
		unread: false,
		selected: false,
	},
] as const;

/** A grey bar standing in for a line of text, `width` a share of its column. */
function Line(handle: Handle<{ width: string; strong?: boolean }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "block",
					blockSize: "0.3rem",
					inlineSize: handle.props.width,
					borderRadius: "999px",
					background: handle.props.strong
						? "var(--ui-neutral-fg-muted)"
						: "var(--ui-neutral-border)",
				}),
			]}
		/>
	);
}

/** Renders the miniature: sidebar, list and open conversation side by side. */
export function RelayThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateColumns: "26% 38% 1fr",
					background: "var(--ui-neutral-bg-tint)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.2rem",
						padding: "0.625rem 0.5rem",
						overflow: "hidden",
					}),
				]}
			>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.3rem",
							marginBlockEnd: "0.3rem",
							fontWeight: "600",
						}),
					]}
				>
					<span
						mix={[
							raw({
								inlineSize: "0.875rem",
								blockSize: "0.875rem",
								borderRadius: "0.25rem",
								background: "var(--ui-color-brand-600)",
							}),
						]}
					/>
					Relay
				</span>
				{MAILBOXES.map((mailbox, index) => (
					<span
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								gap: "0.25rem",
								paddingInline: "0.3rem",
								paddingBlock: "0.1rem",
								borderRadius: "0.3rem",
								whiteSpace: "nowrap",
								overflow: "hidden",
								background: index === 0 ? "var(--ui-neutral-bg-tint-pressed)" : "transparent",
								fontWeight: index === 0 ? "600" : "400",
							}),
						]}
					>
						<span mix={[raw({ overflow: "hidden", textOverflow: "ellipsis" })]}>
							{mailbox.label}
						</span>
						{mailbox.count ? (
							<span mix={[raw({ color: "var(--ui-brand-fg)", fontWeight: "600" })]}>
								{mailbox.count}
							</span>
						) : null}
					</span>
				))}
			</div>
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.15rem",
						padding: "0.375rem",
						marginBlock: "0.375rem",
						background: "var(--ui-bg)",
						borderRadius: "0.5rem 0 0 0.5rem",
						boxShadow: "0 0 0 1px var(--ui-neutral-border)",
						overflow: "hidden",
					}),
				]}
			>
				<span mix={[raw({ fontWeight: "700", padding: "0.15rem 0.3rem 0.3rem" })]}>Inbox</span>
				{ROWS.map((row) => (
					<span
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "0.35rem 1fr",
								columnGap: "0.3rem",
								alignItems: "center",
								padding: "0.25rem 0.3rem",
								borderRadius: "0.35rem",
								background: row.selected ? "var(--ui-brand-bg-solid)" : "transparent",
								color: row.selected
									? "var(--ui-brand-fg-on-solid)"
									: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "0.35rem",
									blockSize: "0.35rem",
									borderRadius: "999px",
									background: row.unread ? "var(--ui-brand-bg-solid)" : "transparent",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									fontWeight: row.unread ? "700" : "500",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
								}),
							]}
						>
							{row.from}
						</span>
						<span />
						<span
							mix={[
								raw({
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									opacity: row.selected ? "0.85" : "0.7",
								}),
							]}
						>
							{row.subject}
						</span>
					</span>
				))}
			</div>
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.4rem",
						padding: "0.625rem",
						marginBlock: "0.375rem",
						marginInlineEnd: "0.375rem",
						background: "var(--ui-bg)",
						borderRadius: "0 0.5rem 0.5rem 0",
						boxShadow: "0 0 0 1px var(--ui-neutral-border)",
						overflow: "hidden",
					}),
				]}
			>
				<span mix={[raw({ display: "flex", gap: "0.25rem" })]}>
					{["Reply", "Assign", "Archive"].map((action) => (
						<span
							mix={[
								raw({
									paddingInline: "0.3rem",
									borderRadius: "0.25rem",
									boxShadow: "0 0 0 1px var(--ui-neutral-border)",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							{action}
						</span>
					))}
				</span>
				<span mix={[raw({ fontWeight: "700", fontSize: "12px", lineHeight: "1.2" })]}>
					SSO login loops back to the start
				</span>
				<span
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.3rem",
							padding: "0.4rem",
							borderRadius: "0.35rem",
							boxShadow: "0 0 0 1px var(--ui-neutral-border)",
						}),
					]}
				>
					<Line width="40%" strong />
					<Line width="95%" />
					<Line width="80%" />
				</span>
				<span
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.3rem",
							padding: "0.4rem",
							borderRadius: "0.35rem",
							background: "var(--ui-warning-bg-tint)",
						}),
					]}
				>
					<Line width="35%" strong />
					<Line width="85%" />
				</span>
			</div>
		</div>
	);
}
