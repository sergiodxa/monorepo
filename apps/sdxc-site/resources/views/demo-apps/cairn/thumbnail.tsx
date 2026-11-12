/**
 * Cairn's gallery miniature: the sidebar, an issue list grouped by state with its glyphs,
 * ids and assignee tiles, and a board's columns of cards beside it, so the card reads as an
 * issue tracker before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { StatusId } from "./data";

import { StatusIcon } from "./glyphs";

/** The sidebar's rows, the first current. */
const NAV = ["My issues", "Inbox", "Projects", "Roadmap", "Cycles"] as const;

/** The list's groups and rows: id, title width, assignee hue. */
const GROUPS: Array<{ status: StatusId; name: string; rows: Array<[string, string, number]> }> = [
	{
		status: "started",
		name: "In Progress",
		rows: [
			["WEB-118", "78%", 150],
			["WEB-140", "62%", 30],
		],
	},
	{
		status: "todo",
		name: "Todo",
		rows: [
			["WEB-124", "70%", 300],
			["PLT-215", "54%", 220],
			["WEB-121", "66%", 150],
		],
	},
	{
		status: "done",
		name: "Done",
		rows: [
			["WEB-119", "58%", 150],
			["WEB-127", "72%", 30],
		],
	},
];

/** The board's columns and how many cards each holds. */
const COLUMNS: Array<[StatusId, number]> = [
	["todo", 3],
	["started", 2],
	["done", 2],
];

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

/** A tiny square initials tile in a person's hue. */
function Tile(handle: Handle<{ hue: number }>) {
	return () => (
		<span
			mix={[
				raw({
					inlineSize: "0.55rem",
					blockSize: "0.55rem",
					borderRadius: "0.12rem",
					flexShrink: "0",
					background: `color-mix(in oklch, oklch(0.7 0.12 ${handle.props.hue}) 55%, var(--ui-bg, Canvas))`,
				}),
			]}
		/>
	);
}

/** Renders the miniature: sidebar, grouped list and a board strip. */
export function CairnThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateColumns: "24% 1fr",
					background: "var(--ui-neutral-bg-tint)",
					fontSize: "0.5rem",
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
								borderRadius: "0.2rem",
								background: "var(--ui-color-brand-600)",
							}),
						]}
					/>
					Cairn
				</span>
				{NAV.map((label, index) => (
					<span
						mix={[
							raw({
								paddingInline: "0.3rem",
								paddingBlock: "0.1rem",
								borderRadius: "0.2rem",
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
								background: index === 0 ? "var(--ui-neutral-bg-tint-pressed)" : "transparent",
								fontWeight: index === 0 ? "600" : "400",
							}),
						]}
					>
						{label}
					</span>
				))}
			</div>
			<div
				mix={[
					raw({
						margin: "0.4rem 0.4rem 0.4rem 0",
						borderRadius: "0.35rem",
						background: "var(--ui-bg, Canvas)",
						border: "1px solid var(--ui-neutral-border)",
						overflow: "hidden",
						display: "grid",
						gridTemplateColumns: "58% 1fr",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							borderInlineEnd: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<span
						mix={[
							raw({ padding: "0.45rem 0.5rem 0.35rem", fontWeight: "600", fontSize: "0.6rem" }),
						]}
					>
						My issues
					</span>
					{GROUPS.map((group) => (
						<>
							<span
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										gap: "0.25rem",
										padding: "0.2rem 0.5rem",
										background: "var(--ui-neutral-bg-tint)",
										fontWeight: "600",
									}),
								]}
							>
								<StatusIcon status={group.status} size={8} />
								{group.name}
							</span>
							{group.rows.map(([id, width, hue]) => (
								<span
									mix={[
										raw({
											display: "flex",
											alignItems: "center",
											gap: "0.3rem",
											padding: "0.28rem 0.5rem",
											borderBlockEnd: "1px solid var(--ui-neutral-border)",
										}),
									]}
								>
									<span
										mix={[
											raw({
												fontFamily: "var(--ui-font-mono)",
												color: "var(--ui-neutral-fg-muted)",
												fontSize: "0.42rem",
											}),
										]}
									>
										{id}
									</span>
									<StatusIcon status={group.status} size={7} />
									<span mix={[raw({ flex: "1 1 auto" })]}>
										<Line width={width} strong />
									</span>
									<Tile hue={hue} />
								</span>
							))}
						</>
					))}
				</div>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(3, 1fr)",
							gap: "0.25rem",
							padding: "0.4rem 0.3rem",
						}),
					]}
				>
					{COLUMNS.map(([status, cards]) => (
						<div
							mix={[
								raw({
									display: "flex",
									flexDirection: "column",
									gap: "0.2rem",
									padding: "0.2rem",
									borderRadius: "0.25rem",
									background: "var(--ui-neutral-bg-tint)",
								}),
							]}
						>
							<StatusIcon status={status} size={7} />
							{Array.from({ length: cards }, (_, index) => (
								<span
									mix={[
										raw({
											display: "flex",
											flexDirection: "column",
											gap: "0.15rem",
											padding: "0.2rem",
											borderRadius: "0.18rem",
											background: "var(--ui-bg, Canvas)",
											border: "1px solid var(--ui-neutral-border)",
										}),
									]}
								>
									<Line width={index % 2 === 0 ? "90%" : "70%"} strong />
									<Line width="45%" />
								</span>
							))}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
