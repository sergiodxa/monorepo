/**
 * Shared stage chrome for `@sdxc/ui` explorer miniatures: the same ProductFrame language
 * the `/demo` gallery uses — traffic-light windows that bleed off the card, a phone bezel,
 * a docs rail, and an app shell — so every scene sits in a real product surface.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

/** Hairline every miniature window shares with DemoMiniature / ProductFrame. */
const HAIRLINE = "var(--ui-landing-hairline, var(--ui-neutral-border))";

/** Soft drop that lifts a framed window off the stage, matching Keel's thumbnail. */
const FRAME_SHADOW = "0 0 0 1px var(--ui-neutral-border), 0 12px 32px -12px rgb(0 0 0 / 0.22)";

namespace FaceWindow {
	export interface Props {
		/** Body of the product window, below the traffic-light chrome. */
		children: RemixNode;
		/** Optional left rail width; omit for a single-pane window. */
		rail?: RemixNode;
	}
}

/**
 * Keel-style product window cropped past the stage's right and bottom edges so the card
 * reads as a glance into a denser surface rather than a floating sticker.
 */
export function FaceWindow(handle: Handle<FaceWindow.Props>) {
	return () => {
		let { children, rail } = handle.props;
		return (
			<div
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "1rem",
						insetInlineStart: "1rem",
						insetInlineEnd: "-1.75rem",
						insetBlockEnd: "-0.85rem",
						display: "grid",
						gridTemplateColumns: rail ? "4.25rem 1fr" : "1fr",
						gridTemplateRows: "1.35rem 1fr",
						borderRadius: "var(--ui-landing-radius-frame, 8px)",
						backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
						boxShadow: FRAME_SHADOW,
						overflow: "hidden",
					}),
				]}
			>
				<div
					mix={[
						raw({
							gridColumn: "1 / -1",
							display: "flex",
							alignItems: "center",
							gap: "0.28rem",
							paddingInline: "0.55rem",
							borderBlockEnd: `1px solid ${HAIRLINE}`,
							backgroundColor: "color-mix(in oklch, CanvasText 3%, transparent)",
						}),
					]}
				>
					{[0, 1, 2].map((dot) => (
						<span
							key={dot}
							mix={[
								raw({
									inlineSize: "0.35rem",
									blockSize: "0.35rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-neutral-border)",
								}),
							]}
						/>
					))}
				</div>
				{rail ? (
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "0.45rem",
								padding: "0.65rem 0.55rem",
								borderInlineEnd: `1px solid ${HAIRLINE}`,
								backgroundColor: "color-mix(in oklch, CanvasText 2%, transparent)",
							}),
						]}
					>
						{rail}
					</div>
				) : null}
				<div
					mix={[
						raw({
							position: "relative",
							minInlineSize: 0,
							minBlockSize: 0,
							padding: "0.7rem",
							overflow: "hidden",
						}),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

namespace FaceDocs {
	export interface Props {
		children: RemixNode;
		/** Sidebar mark glyph content. */
		mark?: RemixNode;
		/** Product name beside the mark. */
		name?: string;
	}
}

/**
 * Docs gallery shell: mark + nav rail beside a page column, matching Tempo/Lattice cards
 * on `/demo` so docs components read as documentation rather than a generic window.
 */
export function FaceDocs(handle: Handle<FaceDocs.Props>) {
	return () => {
		let { children, mark, name = "Docs" } = handle.props;
		return (
			<div
				mix={[
					raw({
						position: "absolute",
						inset: "0",
						display: "grid",
						gridTemplateColumns: "minmax(5.5rem, 34%) 1fr",
						backgroundColor: "var(--ui-bg)",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.35rem",
							padding: "0.75rem 0.65rem",
							borderInlineEnd: `1px solid ${HAIRLINE}`,
							overflow: "hidden",
						}),
					]}
				>
					<span
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.35rem",
								marginBlockEnd: "0.2rem",
								fontWeight: "650",
								fontSize: "0.7rem",
							}),
						]}
					>
						{mark ?? (
							<span
								mix={[
									raw({
										inlineSize: "0.7rem",
										blockSize: "0.7rem",
										borderRadius: "0.2rem",
										backgroundColor: "var(--ui-brand-bg-solid)",
										flexShrink: "0",
									}),
								]}
							/>
						)}
						{name}
					</span>
					<span mix={[raw({ color: "var(--ui-neutral-fg-muted)", fontSize: "0.58rem" })]}>
						Guide
					</span>
					{["Install", "Usage"].map((item, index) => (
						<span
							key={item}
							mix={[
								raw({
									paddingInline: "0.35rem",
									borderRadius: "0.3rem",
									fontSize: "0.62rem",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									...(index === 0
										? {
												backgroundColor: "var(--ui-brand-bg-tint)",
												color: "var(--ui-brand-fg)",
												fontWeight: "600",
											}
										: { color: "var(--ui-neutral-fg-muted)" }),
								}),
							]}
						>
							{item}
						</span>
					))}
				</div>
				<div
					mix={[
						raw({
							padding: "0.75rem 0.7rem",
							display: "flex",
							flexDirection: "column",
							gap: "0.4rem",
							overflow: "hidden",
							minInlineSize: 0,
						}),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/** Nav tick used in app-shell rails — brand on the first, quiet on the rest. */
export function RailTick(handle: Handle<{ active?: boolean; width?: string }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "block",
					blockSize: "0.28rem",
					inlineSize: handle.props.width ?? "70%",
					borderRadius: "2px",
					backgroundColor: handle.props.active
						? "var(--ui-brand-bg-solid)"
						: "var(--ui-neutral-border)",
				}),
			]}
		/>
	);
}

/** Grey bar standing in for a line of text; `width` is a share of the column. */
export function FaceLine(
	handle: Handle<{ width: string; strong?: boolean; tone?: "muted" | "ink" }>,
) {
	return () => {
		let tone = handle.props.tone ?? (handle.props.strong ? "ink" : "muted");
		return (
			<span
				mix={[
					raw({
						display: "block",
						blockSize: "0.28rem",
						inlineSize: handle.props.width,
						borderRadius: "999px",
						backgroundColor:
							tone === "ink" ? "var(--ui-neutral-fg-muted)" : "var(--ui-neutral-border)",
					}),
				]}
			/>
		);
	};
}
