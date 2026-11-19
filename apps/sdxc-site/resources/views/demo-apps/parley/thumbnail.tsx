/**
 * Parley's gallery miniature: the sidebar's channels with a bold unread row and a raspberry
 * mention badge, then a channel's log of tiled faces over grey lines, a reaction chip, the
 * typing dots and the composer, so the card reads as team chat before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

/** The channels the miniature's sidebar lists: name, unread, mention badge, current. */
const CHANNELS = [
	{ name: "general", unread: false, badge: "", current: false },
	{ name: "launch-v3", unread: true, badge: "2", current: true },
	{ name: "design", unread: true, badge: "", current: false },
	{ name: "engineering", unread: false, badge: "", current: false },
	{ name: "random", unread: false, badge: "", current: false },
] as const;

/** The log's runs: the hue of each face and how wide its lines are. */
const RUNS = [
	{ hue: 290, lines: ["70%", "45%"] },
	{ hue: 220, lines: ["85%", "60%", "30%"] },
	{ hue: 28, lines: ["55%"] },
] as const;

/** A grey bar standing in for a line of text, `width` a share of its column. */
function Bar(handle: Handle<{ width: string; strong?: boolean }>) {
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

/** Renders the miniature, filling the gallery card's stage. */
export function ParleyThumbnail() {
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
						fontSize: "0.5rem",
					}),
				]}
			>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.3rem",
							fontWeight: "700",
							fontSize: "0.5625rem",
							marginBlockEnd: "0.35rem",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					<span
						mix={[
							raw({
								inlineSize: "0.75rem",
								blockSize: "0.75rem",
								borderRadius: "0.2rem",
								background: "var(--ui-color-brand-600)",
							}),
						]}
					/>
					Fernhill
				</span>
				{CHANNELS.map((channel) => (
					<span
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.2rem",
								paddingInline: "0.3rem",
								blockSize: "0.95rem",
								borderRadius: "0.25rem",
								color: channel.unread
									? "var(--ui-neutral-fg-emphasis)"
									: "var(--ui-neutral-fg-muted)",
								fontWeight: channel.unread ? "800" : "500",
								background: channel.current ? "var(--ui-brand-bg-tint)" : "transparent",
							}),
						]}
					>
						<span mix={[raw({ opacity: "0.6" })]}>#</span>
						<span mix={[raw({ flex: "1", overflow: "hidden", whiteSpace: "nowrap" })]}>
							{channel.name}
						</span>
						{channel.badge === "" ? null : (
							<span
								mix={[
									raw({
										paddingInline: "0.2rem",
										borderRadius: "999px",
										fontSize: "0.4375rem",
										color: "white",
										background: "var(--ui-color-brand-600)",
									}),
								]}
							>
								{channel.badge}
							</span>
						)}
					</span>
				))}
			</div>
			<div
				mix={[
					raw({
						display: "flex",
						flexDirection: "column",
						justifyContent: "flex-end",
						gap: "0.5rem",
						margin: "0.375rem",
						marginInlineStart: "0",
						padding: "0.5rem 0.625rem",
						borderRadius: "0.5rem",
						background: "var(--ui-bg)",
						boxShadow: "0 0 0 1px var(--ui-neutral-border)",
						overflow: "hidden",
					}),
				]}
			>
				{RUNS.map((run, index) => (
					<span mix={[raw({ display: "grid", gridTemplateColumns: "0.9rem 1fr", gap: "0.35rem" })]}>
						<span
							mix={[
								raw({
									inlineSize: "0.9rem",
									blockSize: "0.9rem",
									borderRadius: "0.22rem",
									background: `oklch(0.85 0.08 ${run.hue})`,
								}),
							]}
						/>
						<span mix={[raw({ display: "grid", gap: "0.2rem", alignContent: "start" })]}>
							<Bar width="28%" strong />
							{run.lines.map((width) => (
								<Bar width={width} />
							))}
							{index === 1 ? (
								<span
									mix={[
										raw({
											justifySelf: "start",
											marginBlockStart: "0.1rem",
											paddingInline: "0.25rem",
											blockSize: "0.55rem",
											borderRadius: "999px",
											border: "1px solid var(--ui-brand-border-strong)",
											background: "var(--ui-brand-bg-tint)",
											inlineSize: "1rem",
										}),
									]}
								/>
							) : null}
						</span>
					</span>
				))}
				<span mix={[raw({ display: "flex", gap: "0.12rem", paddingInlineStart: "1.25rem" })]}>
					{[0, 1, 2].map(() => (
						<span
							mix={[
								raw({
									inlineSize: "0.2rem",
									blockSize: "0.2rem",
									borderRadius: "999px",
									background: "var(--ui-neutral-fg-muted)",
								}),
							]}
						/>
					))}
				</span>
				<span
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							justifyContent: "flex-end",
							blockSize: "1.1rem",
							paddingInline: "0.2rem",
							borderRadius: "0.35rem",
							boxShadow: "0 0 0 1px var(--ui-neutral-border-strong)",
						}),
					]}
				>
					<span
						mix={[
							raw({
								inlineSize: "0.65rem",
								blockSize: "0.65rem",
								borderRadius: "0.18rem",
								background: "var(--ui-color-brand-600)",
							}),
						]}
					/>
				</span>
			</div>
		</div>
	);
}
