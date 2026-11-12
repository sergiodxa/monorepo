/**
 * Tern's gallery miniature: the sidebar's history by day, a question in a soft bubble,
 * a reply with a code block, and the round composer, so the card reads as a chat assistant
 * before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

/** The history the miniature's sidebar lists, by day, the first one open. */
const HISTORY = [
	{ group: "Today", chats: ["Debounce a search input", "Rewrite the launch email"] },
	{ group: "Yesterday", chats: ["Plan a Lisbon offsite"] },
	{ group: "Previous 7 days", chats: ["Postgres or SQLite", "Container queries"] },
] as const;

/** A grey bar standing in for a line of text. */
function Line(handle: Handle<{ width: string; tone?: "strong" | "code" }>) {
	return () => {
		let { tone, width } = handle.props;
		let colour = lineColour(tone);
		return (
			<span
				mix={[
					raw({
						display: "block",
						blockSize: "0.3rem",
						inlineSize: width,
						borderRadius: "999px",
						background: colour,
					}),
				]}
			/>
		);
	};
}

/** The colour a line takes for its tone. */
function lineColour(tone: "strong" | "code" | undefined): string {
	if (tone === "strong") return "var(--ui-neutral-fg-muted)";
	if (tone === "code") return "var(--ui-brand-border-strong)";
	return "var(--ui-neutral-border)";
}

/** Renders the miniature: sidebar beside the open chat. */
export function TernThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateColumns: "30% 1fr",
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
						whiteSpace: "nowrap",
						"& > *": { flexShrink: 0 },
					}),
				]}
			>
				<span
					mix={[raw({ display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: "600" })]}
				>
					<span
						mix={[
							raw({
								inlineSize: "0.875rem",
								blockSize: "0.875rem",
								borderRadius: "0.3rem",
								background: "var(--ui-color-brand-600)",
							}),
						]}
					/>
					Tern
				</span>
				<span
					mix={[
						raw({
							marginBlock: "0.3rem",
							padding: "0.15rem 0.35rem",
							borderRadius: "999px",
							boxShadow: "0 0 0 1px var(--ui-neutral-border)",
							background: "var(--ui-bg)",
						}),
					]}
				>
					+ New chat
				</span>
				{HISTORY.map((day, dayIndex) => (
					<>
						<span mix={[raw({ fontSize: "0.5rem", opacity: "0.6", marginBlockStart: "0.2rem" })]}>
							{day.group}
						</span>
						{day.chats.map((chat, index) => (
							<span
								mix={[
									raw({
										padding: "0.1rem 0.3rem",
										borderRadius: "0.35rem",
										overflow: "hidden",
										textOverflow: "ellipsis",
										background:
											dayIndex === 0 && index === 0
												? "var(--ui-neutral-bg-tint-pressed)"
												: "transparent",
										fontWeight: dayIndex === 0 && index === 0 ? "600" : "400",
									}),
								]}
							>
								{chat}
							</span>
						))}
					</>
				))}
			</div>
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						gap: "0.45rem",
						padding: "0.625rem 0.75rem",
						margin: "0.375rem 0.375rem 0.375rem 0",
						background: "var(--ui-bg)",
						borderRadius: "0.6rem",
						boxShadow: "0 0 0 1px var(--ui-neutral-border)",
						overflow: "hidden",
					}),
				]}
			>
				<span
					mix={[
						raw({
							alignSelf: "flex-end",
							maxInlineSize: "75%",
							padding: "0.3rem 0.5rem",
							borderRadius: "0.75rem",
							background: "var(--ui-neutral-bg-tint-hover)",
							lineHeight: "1.3",
						}),
					]}
				>
					Can it cancel the request still in flight?
				</span>
				<span mix={[raw({ display: "flex", flexDirection: "column", gap: "0.3rem" })]}>
					<Line width="45%" tone="strong" />
					<Line width="92%" />
					<Line width="78%" />
				</span>
				<span
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.3rem",
							padding: "0.45rem",
							borderRadius: "0.4rem",
							background: "var(--ui-neutral-bg-tint)",
							boxShadow: "0 0 0 1px var(--ui-neutral-border)",
						}),
					]}
				>
					<Line width="55%" tone="code" />
					<Line width="70%" />
					<Line width="40%" tone="code" />
				</span>
				<span mix={[raw({ flex: "1" })]} />
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "0.25rem 0.25rem 0.25rem 0.55rem",
							borderRadius: "999px",
							boxShadow: "0 0 0 1px var(--ui-neutral-border)",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					Ask Tern anything
					<span
						mix={[
							raw({
								inlineSize: "0.95rem",
								blockSize: "0.95rem",
								borderRadius: "999px",
								background: "var(--ui-brand-bg-solid)",
							}),
						]}
					/>
				</span>
			</div>
		</div>
	);
}
