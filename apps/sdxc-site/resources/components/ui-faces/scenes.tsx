/**
 * Miniature scenes for every `@sdxc/ui` explorer face kind. Drawn as HTML like the `/demo`
 * gallery — ProductFrame chrome, theme tokens, dense product beats — so a card shows the
 * pattern rather than a flat schematic PNG.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { FaceKind } from "~/resources/components/ui-faces/kinds";

import { FaceDocs, FaceLine, FaceWindow, RailTick } from "~/resources/components/ui-faces/chrome";

/** Pill primary action. */
function primaryButton(label: string): RemixNode {
	return (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "0.35rem 0.75rem",
					borderRadius: "9999px",
					backgroundColor: "var(--ui-brand-bg-solid)",
					color: "var(--ui-brand-fg-on-solid, white)",
					fontWeight: "650",
					fontSize: "0.68rem",
					letterSpacing: "-0.01em",
				}),
			]}
		>
			{label}
		</span>
	);
}

/** Quiet outline control. */
function ghostButton(label: string): RemixNode {
	return (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "0.3rem 0.65rem",
					borderRadius: "9999px",
					boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
					backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
					fontWeight: "600",
					fontSize: "0.65rem",
				}),
			]}
		>
			{label}
		</span>
	);
}

/** Centered stack inside a window body. */
function center(children: RemixNode): RemixNode {
	return (
		<div
			mix={[
				raw({
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: "0.4rem",
					blockSize: "100%",
					minBlockSize: "4.25rem",
				}),
			]}
		>
			{children}
		</div>
	);
}

/** Stacked column. */
function stack(gap: string, children: RemixNode): RemixNode {
	return (
		<div mix={[raw({ display: "flex", flexDirection: "column", gap, minInlineSize: 0 })]}>
			{children}
		</div>
	);
}

/** Default rail ticks for app shells. */
function defaultRail(): RemixNode {
	return (
		<>
			<RailTick active width="78%" />
			<RailTick width="62%" />
			<RailTick width="70%" />
			<RailTick width="48%" />
		</>
	);
}

/** Month grid for calendar faces. */
function calendarCells(selected: number[]): RemixNode {
	let cells = [];
	for (let i = 0; i < 21; i++) {
		let on = selected.includes(i);
		cells.push(
			<span
				key={i}
				mix={[
					raw({
						aspectRatio: "1",
						borderRadius: "0.25rem",
						display: "grid",
						placeItems: "center",
						fontSize: "0.5rem",
						fontVariantNumeric: "tabular-nums",
						backgroundColor: on ? "var(--ui-brand-bg-solid)" : "transparent",
						color: on ? "var(--ui-brand-fg-on-solid, white)" : "var(--ui-neutral-fg-muted)",
						fontWeight: on ? "650" : "500",
					}),
				]}
			>
				{(i % 28) + 1}
			</span>,
		);
	}
	return (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "repeat(7, 1fr)",
					gap: "0.15rem",
					marginBlockStart: "0.3rem",
				}),
			]}
		>
			{cells}
		</div>
	);
}

/** Usage bars like Keel's revenue board. */
function usageBars(): RemixNode {
	let values = [38, 44, 41, 52, 49, 58, 55, 63, 60, 71, 68, 77, 74, 86, 82, 94];
	return (
		<div
			mix={[
				raw({
					flex: "1",
					display: "flex",
					alignItems: "flex-end",
					gap: "2px",
					minBlockSize: "2.5rem",
					borderBlockEnd: "1px solid var(--ui-neutral-border)",
				}),
			]}
		>
			{values.map((height, index) => (
				<span
					key={index}
					mix={[
						raw({
							flex: "1",
							blockSize: `${height}%`,
							borderRadius: "2px 2px 0 0",
							backgroundColor:
								index === values.length - 1
									? "var(--ui-brand-bg-solid)"
									: "color-mix(in oklch, var(--ui-brand-bg-solid) 35%, transparent)",
						}),
					]}
				/>
			))}
		</div>
	);
}

/** Miniature for `accordion`. */
function scene_accordion(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					{[
						["Billing", true],
						["Team", false],
						["Security", false],
					].map(([label, open]) => (
						<div
							key={label as string}
							mix={[
								raw({
									padding: "0.4rem 0.5rem",
									borderRadius: "0.4rem",
									boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
									backgroundColor: open
										? "var(--ui-bg)"
										: "color-mix(in oklch, CanvasText 3%, transparent)",
								}),
							]}
						>
							<span
								mix={[
									raw({
										display: "flex",
										justifyContent: "space-between",
										fontWeight: "600",
										fontSize: "0.65rem",
									}),
								]}
							>
								{label as string}
								<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{open ? "▾" : "▸"}</span>
							</span>
							{open ? (
								<div
									mix={[
										raw({
											marginBlockStart: "0.35rem",
											display: "flex",
											flexDirection: "column",
											gap: "0.25rem",
										}),
									]}
								>
									<FaceLine width="92%" />
									<FaceLine width="70%" />
								</div>
							) : null}
						</div>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `alert`. */
function scene_alert(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.45rem",
				<>
					<div
						mix={[
							raw({
								display: "flex",
								gap: "0.45rem",
								alignItems: "flex-start",
								padding: "0.55rem 0.6rem",
								borderRadius: "0.55rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								backgroundColor: "var(--ui-bg)",
							}),
						]}
					>
						<span
							mix={[
								raw({
									flexShrink: "0",
									inlineSize: "0.7rem",
									blockSize: "0.7rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-brand-bg-solid)",
									marginBlockStart: "0.1rem",
								}),
							]}
						/>
						<span
							mix={[
								raw({ display: "flex", flexDirection: "column", gap: "0.3rem", minInlineSize: 0 }),
							]}
						>
							<span mix={[raw({ fontWeight: "650", fontSize: "0.68rem" })]}>Billing paused</span>
							<FaceLine width="92%" />
							<FaceLine width="70%" />
						</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `app-shell`. */
function scene_app_shell(): RemixNode {
	return (
		<FaceWindow rail={defaultRail()}>
			{stack(
				"0.4rem",
				<>
					<span mix={[raw({ fontWeight: "650", fontSize: "0.7rem" })]}>Overview</span>
					<FaceLine width="100%" strong />
					<FaceLine width="86%" />
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "0.35rem",
								marginBlockStart: "0.2rem",
							}),
						]}
					>
						{[0, 1].map((i) => (
							<span
								key={i}
								mix={[
									raw({
										minBlockSize: "2.2rem",
										borderRadius: "0.4rem",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
										padding: "0.35rem",
										display: "flex",
										flexDirection: "column",
										gap: "0.25rem",
									}),
								]}
							>
								<FaceLine width="50%" />
								<FaceLine width="80%" strong />
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `app-shell-toggle`. */
function scene_app_shell_toggle(): RemixNode {
	return (
		<FaceWindow
			rail={
				<>
					<span
						mix={[
							raw({
								inlineSize: "1.1rem",
								blockSize: "0.85rem",
								borderRadius: "0.25rem",
								backgroundColor: "var(--ui-brand-bg-solid)",
								marginBlockEnd: "0.25rem",
							}),
						]}
					/>
					{[0, 1, 2].map((i) => (
						<span
							key={i}
							mix={[
								raw({
									inlineSize: "0.85rem",
									blockSize: "0.85rem",
									borderRadius: "0.25rem",
									backgroundColor: "var(--ui-neutral-border)",
								}),
							]}
						/>
					))}
				</>
			}
		>
			{stack(
				"0.4rem",
				<>
					<span
						mix={[
							raw({ fontSize: "0.62rem", color: "var(--ui-neutral-fg-muted)", fontWeight: "600" }),
						]}
					>
						Collapsed
					</span>
					<FaceLine width="100%" strong />
					<FaceLine width="72%" />
					<span
						mix={[
							raw({
								marginBlockStart: "0.25rem",
								minBlockSize: "2.4rem",
								borderRadius: "0.45rem",
								backgroundColor: "color-mix(in oklch, CanvasText 4%, transparent)",
							}),
						]}
					/>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `avatar`. */
function scene_avatar(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								inlineSize: "2.1rem",
								blockSize: "2.1rem",
								borderRadius: "9999px",
								display: "grid",
								placeItems: "center",
								backgroundColor: "var(--ui-brand-bg-tint)",
								color: "var(--ui-brand-fg)",
								fontWeight: "700",
								fontSize: "0.7rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						SX
					</span>
					<span mix={[raw({ fontSize: "0.62rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Sergio X.
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `badge`. */
function scene_badge(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<div mix={[raw({ display: "flex", alignItems: "center", gap: "0.4rem" })]}>
						<span mix={[raw({ fontWeight: "750", fontSize: "0.8rem", letterSpacing: "-0.02em" })]}>
							Billing
						</span>
						<span
							mix={[
								raw({
									display: "inline-flex",
									padding: "0.15rem 0.45rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-brand-bg-tint)",
									color: "var(--ui-brand-fg)",
									fontWeight: "650",
									fontSize: "0.58rem",
								}),
							]}
						>
							Beta
						</span>
					</div>
					<FaceLine width="100%" />
					<FaceLine width="78%" />
					<FaceLine width="62%" />
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `banner`. */
function scene_banner(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								padding: "0.55rem 0.7rem",
								borderRadius: "0.5rem",
								backgroundColor: "var(--ui-brand-bg-solid)",
								color: "var(--ui-brand-fg-on-solid, white)",
								fontWeight: "650",
								fontSize: "0.68rem",
							}),
						]}
					>
						New pricing is live
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `bento`. */
function scene_bento(): RemixNode {
	return (
		<FaceWindow>
			{
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "1.3fr 1fr",
							gridTemplateRows: "1fr 1fr",
							gap: "0.35rem",
							blockSize: "100%",
							minBlockSize: "5rem",
						}),
					]}
				>
					<div
						mix={[
							raw({
								gridRow: "1 / -1",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								padding: "0.45rem",
								display: "flex",
								flexDirection: "column",
								gap: "0.35rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									blockSize: "1.4rem",
									borderRadius: "0.3rem",
									backgroundColor: "var(--ui-neutral-border)",
								}),
							]}
						/>
						<span mix={[raw({ fontWeight: "650", fontSize: "0.62rem" })]}>Monitors</span>
						<FaceLine width="90%" />
						<FaceLine width="70%" />
					</div>
					<div
						mix={[
							raw({
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								padding: "0.4rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "block",
									blockSize: "0.45rem",
									inlineSize: "55%",
									borderRadius: "2px",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
					</div>
					<div
						mix={[
							raw({
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								padding: "0.4rem",
								display: "flex",
								flexDirection: "column",
								gap: "0.25rem",
							}),
						]}
					>
						<FaceLine width="80%" />
						<FaceLine width="55%" />
					</div>
				</div>
			}
		</FaceWindow>
	);
}

/** Miniature for `breadcrumbs`. */
function scene_breadcrumbs(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<span
						mix={[
							raw({ display: "flex", gap: "0.3rem", alignItems: "center", fontSize: "0.62rem" }),
						]}
					>
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>Docs</span>
						<span mix={[raw({ color: "var(--ui-neutral-border)" })]}>/</span>
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>UI</span>
						<span mix={[raw({ color: "var(--ui-neutral-border)" })]}>/</span>
						<span mix={[raw({ fontWeight: "650" })]}>Button</span>
					</span>
					<span mix={[raw({ fontWeight: "750", fontSize: "0.85rem", letterSpacing: "-0.02em" })]}>
						Button
					</span>
					<FaceLine width="100%" />
					<FaceLine width="82%" />
					<FaceLine width="64%" />
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `button`. */
function scene_button(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.45rem",
				<>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.72rem" })]}>Invite teammate</span>
					<FaceLine width="88%" />
					<FaceLine width="64%" />
					<div
						mix={[
							raw({
								display: "flex",
								gap: "0.35rem",
								justifyContent: "flex-end",
								marginBlockStart: "0.35rem",
							}),
						]}
					>
						{ghostButton("Cancel")}
						{primaryButton("Save")}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `button-ghost`. */
function scene_button_ghost(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.72rem" })]}>Button</span>
					<FaceLine width="92%" />
					<FaceLine width="70%" />
					<div mix={[raw({ marginBlockStart: "0.25rem" })]}>{ghostButton("Open docs")}</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `calendar`. */
function scene_calendar(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.2rem",
				<>
					<span
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								fontWeight: "650",
								fontSize: "0.7rem",
							}),
						]}
					>
						March<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>›</span>
					</span>
					{calendarCells([9])}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `card`. */
function scene_card(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<div
						mix={[
							raw({
								padding: "0.55rem",
								borderRadius: "0.55rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								display: "flex",
								flexDirection: "column",
								gap: "0.35rem",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "650", fontSize: "0.7rem" })]}>Monitors</span>
						<FaceLine width="100%" strong />
						<FaceLine width="82%" />
						<FaceLine width="64%" />
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `carousel`. */
function scene_carousel(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<div mix={[raw({ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.35rem" })]}>
						{[0, 1, 2].map((i) => (
							<span
								key={i}
								mix={[
									raw({
										aspectRatio: "4 / 3",
										borderRadius: "0.4rem",
										backgroundColor:
											i === 1 ? "var(--ui-brand-bg-tint)" : "var(--ui-neutral-border)",
										boxShadow: i === 1 ? "inset 0 0 0 1px var(--ui-brand-bg-solid)" : "none",
									}),
								]}
							/>
						))}
					</div>
					<div mix={[raw({ display: "flex", gap: "0.25rem", justifyContent: "center" })]}>
						{[0, 1, 2].map((i) => (
							<span
								key={i}
								mix={[
									raw({
										inlineSize: i === 1 ? "0.7rem" : "0.28rem",
										blockSize: "0.28rem",
										borderRadius: "9999px",
										backgroundColor:
											i === 1 ? "var(--ui-brand-bg-solid)" : "var(--ui-neutral-border)",
									}),
								]}
							/>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `chart`. */
function scene_chart(): RemixNode {
	return (
		<FaceWindow rail={defaultRail()}>
			{stack(
				"0.35rem",
				<>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.55rem",
								color: "var(--ui-neutral-fg-muted)",
								textTransform: "uppercase",
								letterSpacing: "0.08em",
							}),
						]}
					>
						MRR
					</span>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-mono)",
								fontSize: "1.05rem",
								fontWeight: "650",
								letterSpacing: "-0.03em",
								fontVariantNumeric: "tabular-nums",
							}),
						]}
					>
						$48,210
					</span>
					{usageBars()}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `chat`. */
function scene_chat(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<div
						mix={[
							raw({
								alignSelf: "flex-start",
								maxInlineSize: "80%",
								padding: "0.4rem 0.55rem",
								borderRadius: "0.7rem 0.7rem 0.7rem 0.2rem",
								backgroundColor: "var(--ui-neutral-border)",
								fontSize: "0.62rem",
							}),
						]}
					>
						Hey — ready to ship?
					</div>
					<div
						mix={[
							raw({
								alignSelf: "flex-end",
								maxInlineSize: "75%",
								padding: "0.4rem 0.55rem",
								borderRadius: "0.7rem 0.7rem 0.2rem 0.7rem",
								backgroundColor: "var(--ui-brand-bg-solid)",
								color: "var(--ui-brand-fg-on-solid, white)",
								fontSize: "0.62rem",
								fontWeight: "600",
							}),
						]}
					>
						Let us go
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `chat-attach`. */
function scene_chat_attach(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.45rem",
								padding: "0.45rem 0.55rem",
								borderRadius: "0.5rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								fontSize: "0.62rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "1.1rem",
									blockSize: "1.1rem",
									borderRadius: "0.25rem",
									backgroundColor: "var(--ui-brand-bg-tint)",
								}),
							]}
						/>
						<span mix={[raw({ fontFamily: "var(--ui-font-mono)" })]}>shot.png</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `chat-marker`. */
function scene_chat_marker(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)", fontWeight: "600" }),
						]}
					>
						— Today —
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `chat-scroller`. */
function scene_chat_scroller(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					{[70, 55, 82, 48, 66].map((w, i) => (
						<div
							key={i}
							mix={[
								raw({
									alignSelf: i % 2 ? "flex-end" : "flex-start",
									inlineSize: `${w}%`,
									blockSize: "0.85rem",
									borderRadius:
										i % 2 ? "0.6rem 0.6rem 0.15rem 0.6rem" : "0.6rem 0.6rem 0.6rem 0.15rem",
									backgroundColor: i % 2 ? "var(--ui-brand-bg-solid)" : "var(--ui-neutral-border)",
								}),
							]}
						/>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `checkbox`. */
function scene_checkbox(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.45rem",
								fontWeight: "600",
								fontSize: "0.7rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "0.95rem",
									blockSize: "0.95rem",
									borderRadius: "0.25rem",
									backgroundColor: "var(--ui-brand-bg-solid)",
									display: "grid",
									placeItems: "center",
									color: "white",
									fontSize: "0.65rem",
									lineHeight: "1",
								}),
							]}
						>
							✓
						</span>
						Include VAT
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `checkbox-group`. */
function scene_checkbox_group(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					{[
						["Email", true],
						["SMS", false],
						["Push", true],
					].map(([label, on]) => (
						<span
							key={label as string}
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.4rem",
									fontSize: "0.68rem",
									fontWeight: "600",
								}),
							]}
						>
							<span
								mix={[
									raw({
										inlineSize: "0.85rem",
										blockSize: "0.85rem",
										borderRadius: "0.22rem",
										backgroundColor: on ? "var(--ui-brand-bg-solid)" : "transparent",
										boxShadow: on ? "none" : "inset 0 0 0 1px var(--ui-neutral-border)",
										color: "white",
										display: "grid",
										placeItems: "center",
										fontSize: "0.55rem",
									}),
								]}
							>
								{on ? "✓" : ""}
							</span>
							{label as string}
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `color-area`. */
function scene_color_area(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								aspectRatio: "1.2",
								borderRadius: "0.45rem",
								backgroundImage:
									"linear-gradient(to top, black, transparent), linear-gradient(to right, white, var(--ui-brand-bg-solid))",
								position: "relative",
							}),
						]}
					>
						<span
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "35%",
									insetInlineStart: "62%",
									inlineSize: "0.55rem",
									blockSize: "0.55rem",
									borderRadius: "9999px",
									boxShadow: "0 0 0 2px white, 0 0 0 3px rgb(0 0 0 / 0.35)",
									translate: "-50% -50%",
								}),
							]}
						/>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `color-field`. */
function scene_color_field(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					<span mix={[raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)" })]}>Hex</span>
					<div mix={[raw({ display: "flex", gap: "0.35rem", alignItems: "center" })]}>
						<span
							mix={[
								raw({
									inlineSize: "1.1rem",
									blockSize: "1.1rem",
									borderRadius: "0.25rem",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.65rem",
									padding: "0.35rem 0.45rem",
									borderRadius: "0.4rem",
									boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
									flex: "1",
								}),
							]}
						>
							#7C3AED
						</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `color-picker`. */
function scene_color_picker(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "1fr 0.7rem",
								gap: "0.35rem",
								minBlockSize: "3.5rem",
							}),
						]}
					>
						<div
							mix={[
								raw({
									borderRadius: "0.4rem",
									backgroundImage:
										"linear-gradient(to top, black, transparent), linear-gradient(to right, white, var(--ui-brand-bg-solid))",
								}),
							]}
						/>
						<div
							mix={[
								raw({
									borderRadius: "9999px",
									backgroundImage:
										"linear-gradient(to bottom, red, yellow, lime, cyan, blue, magenta, red)",
								}),
							]}
						/>
					</div>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.58rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						#7C3AED
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `color-slider`. */
function scene_color_slider(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								blockSize: "0.7rem",
								borderRadius: "9999px",
								backgroundImage:
									"linear-gradient(to right, red, yellow, lime, cyan, blue, magenta)",
								position: "relative",
							}),
						]}
					>
						<span
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "50%",
									insetInlineStart: "62%",
									translate: "-50% -50%",
									inlineSize: "0.85rem",
									blockSize: "0.85rem",
									borderRadius: "9999px",
									backgroundColor: "white",
									boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 2px 6px rgb(0 0 0 / 0.2)",
								}),
							]}
						/>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `color-swatch`. */
function scene_color_swatch(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								inlineSize: "2.4rem",
								blockSize: "2.4rem",
								borderRadius: "0.45rem",
								backgroundColor: "var(--ui-brand-bg-solid)",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					/>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `color-swatches`. */
function scene_color_swatches(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ display: "grid", gridTemplateColumns: "repeat(4, 1.1rem)", gap: "0.3rem" }),
						]}
					>
						{[
							"oklch(0.55 0.2 25)",
							"oklch(0.65 0.15 85)",
							"oklch(0.6 0.14 145)",
							"var(--ui-brand-bg-solid)",
							"oklch(0.55 0.16 250)",
							"oklch(0.6 0.18 310)",
							"oklch(0.45 0.02 275)",
							"oklch(0.85 0.02 275)",
						].map((c, i) => (
							<span
								key={c}
								mix={[
									raw({
										inlineSize: "1.1rem",
										blockSize: "1.1rem",
										borderRadius: "0.25rem",
										backgroundColor: c,
										boxShadow:
											i === 3
												? "0 0 0 2px var(--ui-bg), 0 0 0 3px var(--ui-brand-bg-solid)"
												: "inset 0 0 0 1px var(--ui-neutral-border)",
									}),
								]}
							/>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `color-wheel`. */
function scene_color_wheel(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "3.4rem",
								blockSize: "3.4rem",
								borderRadius: "9999px",
								backgroundImage: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
								position: "relative",
							}),
						]}
					>
						<span
							mix={[
								raw({
									position: "absolute",
									inset: "28%",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-bg)",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "12%",
									insetInlineStart: "70%",
									inlineSize: "0.45rem",
									blockSize: "0.45rem",
									borderRadius: "9999px",
									backgroundColor: "white",
									boxShadow: "0 0 0 1px rgb(0 0 0 / 0.35)",
									translate: "-50% -50%",
								}),
							]}
						/>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `command`. */
function scene_command(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<div
						mix={[
							raw({
								padding: "0.4rem 0.55rem",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.62rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						Search…
					</div>
					{[
						["Open settings", true],
						["Invite member", false],
						["Switch workspace", false],
					].map(([label, on]) => (
						<span
							key={label as string}
							mix={[
								raw({
									padding: "0.3rem 0.45rem",
									borderRadius: "0.35rem",
									fontSize: "0.62rem",
									backgroundColor: on ? "var(--ui-brand-bg-solid)" : "transparent",
									color: on ? "var(--ui-brand-fg-on-solid, white)" : "inherit",
									fontWeight: on ? "600" : "500",
								}),
							]}
						>
							{label as string}
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `cta`. */
function scene_cta(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								alignItems: "flex-start",
								gap: "0.4rem",
								inlineSize: "100%",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "750", fontSize: "0.85rem", letterSpacing: "-0.02em" })]}>
							Ship faster
						</span>
						<FaceLine width="80%" />
						<div mix={[raw({ display: "flex", gap: "0.35rem", marginBlockStart: "0.25rem" })]}>
							{primaryButton("Start")}
							{ghostButton("Docs")}
						</div>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `danger-zone`. */
function scene_danger_zone(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<div
						mix={[
							raw({
								padding: "0.55rem",
								borderRadius: "0.5rem",
								boxShadow:
									"inset 0 0 0 1px color-mix(in oklch, oklch(0.55 0.18 25) 55%, transparent)",
								display: "flex",
								flexDirection: "column",
								gap: "0.35rem",
							}),
						]}
					>
						<span
							mix={[raw({ fontWeight: "700", fontSize: "0.68rem", color: "oklch(0.5 0.16 25)" })]}
						>
							Delete workspace
						</span>
						<FaceLine width="100%" />
						<span
							mix={[
								raw({
									alignSelf: "flex-start",
									padding: "0.3rem 0.55rem",
									borderRadius: "9999px",
									backgroundColor: "oklch(0.55 0.18 25)",
									color: "white",
									fontSize: "0.58rem",
									fontWeight: "700",
								}),
							]}
						>
							Delete
						</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `date-picker`. */
function scene_date_picker(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<span mix={[raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Start date
					</span>
					<div
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								padding: "0.4rem 0.5rem",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.65rem",
							}),
						]}
					>
						2026-03-12<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>▾</span>
					</div>
					{calendarCells([9])}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `date-range`. */
function scene_date_range(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<div mix={[raw({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.35rem" })]}>
						{["Mar 12", "Mar 18"].map((label) => (
							<span
								key={label}
								mix={[
									raw({
										padding: "0.35rem 0.4rem",
										borderRadius: "0.4rem",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
										fontFamily: "var(--ui-font-mono)",
										fontSize: "0.58rem",
										textAlign: "center",
									}),
								]}
							>
								{label}
							</span>
						))}
					</div>
					{calendarCells([8, 9, 10, 11, 12])}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `dialog`. */
function scene_dialog(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								maxInlineSize: "9.5rem",
								padding: "0.7rem",
								borderRadius: "0.65rem",
								backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
								boxShadow:
									"inset 0 0 0 1px var(--ui-neutral-border), 0 10px 24px -12px rgb(0 0 0 / 0.2)",
								display: "flex",
								flexDirection: "column",
								gap: "0.45rem",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "650", fontSize: "0.72rem" })]}>Confirm</span>
						<FaceLine width="100%" />
						<FaceLine width="78%" />
						<div
							mix={[
								raw({
									display: "flex",
									gap: "0.35rem",
									justifyContent: "flex-end",
									marginBlockStart: "0.2rem",
								}),
							]}
						>
							{ghostButton("Cancel")}
							{primaryButton("OK")}
						</div>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `disclosure`. */
function scene_disclosure(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					{[
						["What is Keel?", true],
						["How billing works", false],
					].map(([label, open]) => (
						<div
							key={label as string}
							mix={[
								raw({
									padding: "0.4rem 0.45rem",
									borderRadius: "0.4rem",
									boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								}),
							]}
						>
							<span
								mix={[
									raw({
										display: "flex",
										justifyContent: "space-between",
										fontWeight: "650",
										fontSize: "0.62rem",
									}),
								]}
							>
								{label as string}
								<span>{open ? "−" : "+"}</span>
							</span>
							{open ? (
								<div mix={[raw({ marginBlockStart: "0.3rem" })]}>
									<FaceLine width="95%" />
								</div>
							) : null}
						</div>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `docs`. */
function scene_docs(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.75rem" })]}>Getting started</span>
					<FaceLine width="100%" />
					<FaceLine width="92%" />
					<FaceLine width="70%" />
					<div
						mix={[
							raw({
								marginBlockStart: "0.25rem",
								padding: "0.45rem",
								borderRadius: "0.4rem",
								backgroundColor: "var(--ui-color-neutral-900, oklch(0.25 0.02 275))",
								display: "flex",
								flexDirection: "column",
								gap: "0.25rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									blockSize: "0.22rem",
									inlineSize: "70%",
									borderRadius: "2px",
									backgroundColor: "color-mix(in oklch, white 35%, transparent)",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									blockSize: "0.22rem",
									inlineSize: "88%",
									borderRadius: "2px",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									blockSize: "0.22rem",
									inlineSize: "55%",
									borderRadius: "2px",
									backgroundColor: "color-mix(in oklch, white 28%, transparent)",
								}),
							]}
						/>
					</div>
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `docs-code`. */
function scene_docs_code(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<span mix={[raw({ fontWeight: "650", fontSize: "0.68rem" })]}>Install</span>
					<div
						mix={[
							raw({
								padding: "0.5rem",
								borderRadius: "0.4rem",
								backgroundColor: "var(--ui-color-neutral-900, oklch(0.25 0.02 275))",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.55rem",
								color: "color-mix(in oklch, white 78%, transparent)",
								display: "flex",
								flexDirection: "column",
								gap: "0.25rem",
							}),
						]}
					>
						<span>bun add @sdxc/ui</span>
						<span mix={[raw({ color: "var(--ui-brand-bg-solid)" })]}>{"import { Button }"}</span>
					</div>
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `docs-code-tabs`. */
function scene_docs_code_tabs(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<div
						mix={[raw({ display: "flex", gap: "0.35rem", fontSize: "0.55rem", fontWeight: "650" })]}
					>
						{["bun", "npm", "pnpm"].map((label, i) => (
							<span
								key={label}
								mix={[
									raw({
										padding: "0.15rem 0.35rem",
										borderRadius: "0.3rem",
										backgroundColor: i === 0 ? "var(--ui-brand-bg-tint)" : "transparent",
										color: i === 0 ? "var(--ui-brand-fg)" : "var(--ui-neutral-fg-muted)",
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
								padding: "0.5rem",
								borderRadius: "0.4rem",
								backgroundColor: "var(--ui-color-neutral-900, oklch(0.25 0.02 275))",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.55rem",
								color: "color-mix(in oklch, white 78%, transparent)",
							}),
						]}
					>
						bun add @sdxc/ui
					</div>
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `docs-feedback`. */
function scene_docs_feedback(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<span mix={[raw({ fontWeight: "650", fontSize: "0.68rem" })]}>Was this helpful?</span>
					<div mix={[raw({ display: "flex", gap: "0.35rem" })]}>
						{ghostButton("Yes")}
						{ghostButton("No")}
					</div>
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `docs-footer`. */
function scene_docs_footer(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<div
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								gap: "0.35rem",
								marginBlockStart: "auto",
							}),
						]}
					>
						<span mix={[raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)" })]}>
							{"‹ Badge"}
						</span>
						<span mix={[raw({ fontSize: "0.58rem", fontWeight: "650" })]}>{"Card ›"}</span>
					</div>
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `docs-header`. */
function scene_docs_header(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<span
						mix={[
							raw({
								fontSize: "0.55rem",
								color: "var(--ui-neutral-fg-muted)",
								fontFamily: "var(--ui-font-mono)",
							}),
						]}
					>
						components / button
					</span>
					<span mix={[raw({ fontWeight: "750", fontSize: "0.9rem", letterSpacing: "-0.02em" })]}>
						Button
					</span>
					<FaceLine width="100%" />
					<FaceLine width="78%" />
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `docs-nav`. */
function scene_docs_nav(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<span mix={[raw({ fontWeight: "650", fontSize: "0.68rem" })]}>On this page</span>
					{["Install", "Usage", "API", "Theming"].map((label, i) => (
						<span
							key={label}
							mix={[
								raw({
									fontSize: "0.6rem",
									paddingInlineStart: "0.35rem",
									borderInlineStart:
										i === 1 ? "2px solid var(--ui-brand-bg-solid)" : "2px solid transparent",
									color: i === 1 ? "inherit" : "var(--ui-neutral-fg-muted)",
									fontWeight: i === 1 ? "650" : "500",
								}),
							]}
						>
							{label}
						</span>
					))}
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `docs-steps`. */
function scene_docs_steps(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<span mix={[raw({ fontWeight: "650", fontSize: "0.68rem" })]}>Quickstart</span>
					{[1, 2, 3].map((n) => (
						<span
							key={n}
							mix={[
								raw({ display: "flex", gap: "0.4rem", alignItems: "center", fontSize: "0.6rem" }),
							]}
						>
							<span
								mix={[
									raw({
										inlineSize: "0.9rem",
										blockSize: "0.9rem",
										borderRadius: "9999px",
										display: "grid",
										placeItems: "center",
										backgroundColor:
											n === 1 ? "var(--ui-brand-bg-solid)" : "var(--ui-neutral-border)",
										color: n === 1 ? "white" : "inherit",
										fontSize: "0.55rem",
										fontWeight: "700",
										flexShrink: "0",
									}),
								]}
							>
								{n}
							</span>
							<FaceLine width={n === 1 ? "85%" : "70%"} />
						</span>
					))}
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `docs-toc`. */
function scene_docs_toc(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<span mix={[raw({ fontWeight: "650", fontSize: "0.68rem" })]}>On this page</span>
					{["Install", "Usage", "API", "Theming"].map((label, i) => (
						<span
							key={label}
							mix={[
								raw({
									fontSize: "0.6rem",
									paddingInlineStart: "0.35rem",
									borderInlineStart:
										i === 1 ? "2px solid var(--ui-brand-bg-solid)" : "2px solid transparent",
									color: i === 1 ? "inherit" : "var(--ui-neutral-fg-muted)",
									fontWeight: i === 1 ? "650" : "500",
								}),
							]}
						>
							{label}
						</span>
					))}
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `drawer`. */
function scene_drawer(): RemixNode {
	return (
		<FaceWindow>
			{
				<div
					mix={[
						raw({
							position: "absolute",
							inset: "auto 0.75rem 0",
							blockSize: "55%",
							borderRadius: "0.55rem 0.55rem 0 0",
							backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
							boxShadow:
								"inset 0 1px 0 var(--ui-neutral-border), 0 -12px 28px -16px rgb(0 0 0 / 0.25)",
							padding: "0.65rem",
							display: "flex",
							flexDirection: "column",
							gap: "0.35rem",
						}),
					]}
				>
					<span
						mix={[
							raw({
								alignSelf: "center",
								inlineSize: "2rem",
								blockSize: "0.25rem",
								borderRadius: "9999px",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.7rem" })]}>Actions</span>
					<FaceLine width="90%" />
					{primaryButton("Continue")}
				</div>
			}
		</FaceWindow>
	);
}

/** Miniature for `drop-indicator`. */
function scene_drop_indicator(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ inlineSize: "100%", display: "flex", flexDirection: "column", gap: "0.35rem" }),
						]}
					>
						<span
							mix={[
								raw({
									padding: "0.35rem",
									borderRadius: "0.35rem",
									backgroundColor: "var(--ui-neutral-border)",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									blockSize: "2px",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									padding: "0.35rem",
									borderRadius: "0.35rem",
									backgroundColor: "var(--ui-neutral-border)",
								}),
							]}
						/>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `drop-zone`. */
function scene_drop_zone(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								minBlockSize: "4.5rem",
								borderRadius: "0.55rem",
								border: "1.5px dashed var(--ui-brand-bg-solid)",
								backgroundColor: "var(--ui-brand-bg-tint)",
								display: "grid",
								placeItems: "center",
								fontSize: "0.62rem",
								fontWeight: "650",
								color: "var(--ui-brand-fg)",
							}),
						]}
					>
						Drop files
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `empty`. */
function scene_empty(): RemixNode {
	return (
		<FaceWindow rail={defaultRail()}>
			{center(
				<>
					<span
						mix={[
							raw({
								inlineSize: "1.6rem",
								blockSize: "1.6rem",
								borderRadius: "9999px",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
					<span
						mix={[
							raw({ fontSize: "0.65rem", color: "var(--ui-neutral-fg-muted)", fontWeight: "600" }),
						]}
					>
						No monitors yet
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `field`. */
function scene_field(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					<span mix={[raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Email
					</span>
					<div
						mix={[
							raw({
								padding: "0.45rem 0.55rem",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.65rem",
							}),
						]}
					>
						you@acme.dev
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `field-error`. */
function scene_field_error(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					<span mix={[raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Email
					</span>
					<div
						mix={[
							raw({
								padding: "0.45rem 0.55rem",
								borderRadius: "0.45rem",
								boxShadow:
									"inset 0 0 0 1px color-mix(in oklch, oklch(0.55 0.18 25) 70%, transparent)",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.65rem",
							}),
						]}
					>
						not-an-email
					</div>
					<span
						mix={[raw({ fontSize: "0.55rem", color: "oklch(0.5 0.16 25)", fontWeight: "600" })]}
					>
						Enter a valid email
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `file-trigger`. */
function scene_file_trigger(): RemixNode {
	return <FaceWindow>{center(<>{ghostButton("Choose file…")}</>)}</FaceWindow>;
}

/** Miniature for `filter-bar`. */
function scene_filter_bar(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<div mix={[raw({ display: "flex", gap: "0.3rem", flexWrap: "wrap" })]}>
						{["All", "Live", "Paused"].map((label, i) => (
							<span
								key={label}
								mix={[
									raw({
										padding: "0.2rem 0.45rem",
										borderRadius: "9999px",
										fontSize: "0.55rem",
										fontWeight: "650",
										backgroundColor: i === 0 ? "var(--ui-brand-bg-solid)" : "transparent",
										color: i === 0 ? "var(--ui-brand-fg-on-solid, white)" : "inherit",
										boxShadow: i === 0 ? "none" : "inset 0 0 0 1px var(--ui-neutral-border)",
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
								padding: "0.4rem 0.5rem",
								borderRadius: "0.4rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								fontSize: "0.6rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						Filter hosts…
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `form`. */
function scene_form(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<span mix={[raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Email
					</span>
					<div
						mix={[
							raw({
								padding: "0.4rem",
								borderRadius: "0.4rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						<FaceLine width="70%" />
					</div>
					<span mix={[raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Name
					</span>
					<div
						mix={[
							raw({
								padding: "0.4rem",
								borderRadius: "0.4rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						<FaceLine width="55%" />
					</div>
					<div mix={[raw({ alignSelf: "flex-start", marginBlockStart: "0.15rem" })]}>
						{primaryButton("Continue")}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `grid-list`. */
function scene_grid_list(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "0.35rem",
								inlineSize: "100%",
							}),
						]}
					>
						{[0, 1, 2, 3].map((i) => (
							<span
								key={i}
								mix={[
									raw({
										minBlockSize: "2rem",
										borderRadius: "0.4rem",
										boxShadow:
											i === 1
												? "inset 0 0 0 1px var(--ui-brand-bg-solid)"
												: "inset 0 0 0 1px var(--ui-neutral-border)",
										backgroundColor: i === 1 ? "var(--ui-brand-bg-tint)" : "transparent",
									}),
								]}
							/>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `heading`. */
function scene_heading(): RemixNode {
	return (
		<FaceDocs name={"Docs"}>
			{
				<>
					<span mix={[raw({ fontWeight: "750", fontSize: "0.95rem", letterSpacing: "-0.02em" })]}>
						{"# Button"}
					</span>
					<FaceLine width="100%" />
					<FaceLine width="88%" />
				</>
			}
		</FaceDocs>
	);
}

/** Miniature for `highlight`. */
function scene_highlight(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span mix={[raw({ fontSize: "0.75rem" })]}>
						Press{" "}
						<span
							mix={[
								raw({
									backgroundColor: "var(--ui-brand-bg-tint)",
									color: "var(--ui-brand-fg)",
									padding: "0.05rem 0.25rem",
									borderRadius: "0.2rem",
									fontWeight: "700",
								}),
							]}
						>
							⌘K
						</span>
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `hover-card`. */
function scene_hover_card(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								maxInlineSize: "8.5rem",
								padding: "0.55rem",
								borderRadius: "0.55rem",
								boxShadow:
									"inset 0 0 0 1px var(--ui-neutral-border), 0 10px 22px -12px rgb(0 0 0 / 0.2)",
								display: "flex",
								flexDirection: "column",
								gap: "0.35rem",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "650", fontSize: "0.65rem" })]}>Share link</span>
						<FaceLine width="100%" />
						<FaceLine width="70%" />
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `image`. */
function scene_image(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								aspectRatio: "16 / 10",
								borderRadius: "0.45rem",
								backgroundColor: "var(--ui-neutral-border)",
								display: "grid",
								placeItems: "center",
								color: "var(--ui-neutral-fg-muted)",
								fontSize: "0.55rem",
								fontWeight: "650",
							}),
						]}
					>
						16:9
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `keyboard`. */
function scene_keyboard(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div mix={[raw({ display: "flex", gap: "0.25rem" })]}>
						{["⌘", "K"].map((k) => (
							<span
								key={k}
								mix={[
									raw({
										minInlineSize: "1.3rem",
										padding: "0.25rem 0.35rem",
										borderRadius: "0.3rem",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
										fontFamily: "var(--ui-font-mono)",
										fontSize: "0.65rem",
										fontWeight: "700",
										textAlign: "center",
									}),
								]}
							>
								{k}
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `label`. */
function scene_label(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span mix={[raw({ fontSize: "0.65rem", fontWeight: "650" })]}>Email address</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-accent-text`. */
function scene_landing_accent_text(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span mix={[raw({ fontWeight: "800", fontSize: "1rem", letterSpacing: "-0.03em" })]}>
						Ship{" "}
						<span
							mix={[
								raw({
									color: "var(--ui-brand-fg)",
									backgroundColor: "var(--ui-brand-bg-tint)",
									paddingInline: "0.2rem",
									borderRadius: "0.25rem",
								}),
							]}
						>
							faster
						</span>
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-author`. */
function scene_landing_author(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ display: "flex", gap: "0.5rem", alignItems: "center", inlineSize: "100%" }),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "1.6rem",
									blockSize: "1.6rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-brand-bg-tint)",
									flexShrink: "0",
								}),
							]}
						/>
						<span
							mix={[
								raw({
									display: "flex",
									flexDirection: "column",
									gap: "0.25rem",
									minInlineSize: 0,
									flex: "1",
								}),
							]}
						>
							<span mix={[raw({ fontWeight: "650", fontSize: "0.65rem" })]}>Maya Chen</span>
							<FaceLine width="90%" />
						</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-code`. */
function scene_landing_code(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					<div
						mix={[
							raw({
								padding: "0.55rem",
								borderRadius: "0.5rem",
								backgroundColor: "var(--ui-color-neutral-950, oklch(0.2 0.02 275))",
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.55rem",
								color: "color-mix(in oklch, white 80%, transparent)",
								display: "flex",
								flexDirection: "column",
								gap: "0.25rem",
							}),
						]}
					>
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{"$ bun add @sdxc/ui"}</span>
						<span mix={[raw({ color: "var(--ui-brand-bg-solid)" })]}>{"✓ installed"}</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-diagram`. */
function scene_landing_diagram(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<svg viewBox="0 0 120 70" mix={[raw({ inlineSize: "100%", blockSize: "4.5rem" })]}>
						<rect
							x="8"
							y="22"
							width="28"
							height="26"
							rx="5"
							fill="var(--ui-brand-bg-tint)"
							stroke="var(--ui-neutral-border)"
						/>
						<rect
							x="46"
							y="12"
							width="28"
							height="46"
							rx="5"
							fill="var(--ui-surface-raised, var(--ui-bg))"
							stroke="var(--ui-brand-bg-solid)"
							stroke-width="1.5"
						/>
						<rect
							x="84"
							y="22"
							width="28"
							height="26"
							rx="5"
							fill="var(--ui-brand-bg-tint)"
							stroke="var(--ui-neutral-border)"
						/>
						<path
							d="M36 35 H46 M74 35 H84"
							stroke="var(--ui-neutral-fg-muted)"
							stroke-width="1.5"
						/>
					</svg>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-feature`. */
function scene_landing_feature(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<span
						mix={[
							raw({
								inlineSize: "1.2rem",
								blockSize: "1.2rem",
								borderRadius: "0.35rem",
								backgroundColor: "var(--ui-brand-bg-tint)",
							}),
						]}
					/>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.72rem" })]}>Usage meters</span>
					<FaceLine width="100%" />
					<FaceLine width="78%" />
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-footer`. */
function scene_landing_footer(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<div
						mix={[raw({ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: "0.4rem" })]}
					>
						<span
							mix={[
								raw({
									inlineSize: "1rem",
									blockSize: "1rem",
									borderRadius: "0.25rem",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
						{["Product", "Company"].map((col) => (
							<span
								key={col}
								mix={[raw({ display: "flex", flexDirection: "column", gap: "0.25rem" })]}
							>
								<span mix={[raw({ fontSize: "0.55rem", fontWeight: "700" })]}>{col}</span>
								<FaceLine width="80%" />
								<FaceLine width="65%" />
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-header`. */
function scene_landing_header(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<div mix={[raw({ display: "flex", alignItems: "center", gap: "0.45rem" })]}>
						<span
							mix={[
								raw({
									inlineSize: "1.1rem",
									blockSize: "1.1rem",
									borderRadius: "0.3rem",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
						<span mix={[raw({ fontSize: "0.6rem", color: "var(--ui-neutral-fg-muted)" })]}>
							Product
						</span>
						<span mix={[raw({ fontSize: "0.6rem", color: "var(--ui-neutral-fg-muted)" })]}>
							Pricing
						</span>
						<div mix={[raw({ marginInlineStart: "auto" })]}>{primaryButton("Sign in")}</div>
					</div>
					<span mix={[raw({ blockSize: "1px", backgroundColor: "var(--ui-neutral-border)" })]} />
					<span mix={[raw({ fontWeight: "750", fontSize: "0.85rem", letterSpacing: "-0.02em" })]}>
						Build faster
					</span>
					<FaceLine width="88%" />
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-hero`. */
function scene_landing_hero(): RemixNode {
	return (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					padding: "1rem",
					display: "flex",
					flexDirection: "column",
					justifyContent: "flex-end",
					gap: "0.35rem",
					backgroundImage:
						"linear-gradient(160deg, color-mix(in oklch, var(--ui-brand-bg-tint) 70%, white), var(--ui-bg))",
				}),
			]}
		>
			<span mix={[raw({ fontWeight: "800", fontSize: "0.95rem", letterSpacing: "-0.03em" })]}>
				Ship UI
			</span>
			<FaceLine width="70%" />
			<div mix={[raw({ marginBlockStart: "0.2rem" })]}>{primaryButton("Get started")}</div>
		</div>
	);
}

/** Miniature for `landing-icons`. */
function scene_landing_icons(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ display: "grid", gridTemplateColumns: "repeat(3, 1.4rem)", gap: "0.4rem" }),
						]}
					>
						{[0, 1, 2, 3, 4, 5].map((i) => (
							<span
								key={i}
								mix={[
									raw({
										inlineSize: "1.4rem",
										blockSize: "1.4rem",
										borderRadius: "0.35rem",
										backgroundColor:
											i === 1 ? "var(--ui-brand-bg-solid)" : "var(--ui-brand-bg-tint)",
									}),
								]}
							/>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-logos`. */
function scene_landing_logos(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								gap: "0.55rem",
								alignItems: "center",
								flexWrap: "wrap",
								justifyContent: "center",
							}),
						]}
					>
						{[2.2, 1.8, 2.4, 1.6].map((w, i) => (
							<span
								key={i}
								mix={[
									raw({
										inlineSize: `${w}rem`,
										blockSize: "0.55rem",
										borderRadius: "2px",
										backgroundColor: "var(--ui-neutral-border)",
									}),
								]}
							/>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-motion`. */
function scene_landing_motion(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ display: "flex", gap: "0.35rem", alignItems: "flex-end", blockSize: "3rem" }),
						]}
					>
						{[40, 70, 55, 90, 65].map((h, i) => (
							<span
								key={i}
								mix={[
									raw({
										inlineSize: "0.55rem",
										blockSize: `${h}%`,
										borderRadius: "9999px",
										backgroundColor: "var(--ui-brand-bg-solid)",
										opacity: String(0.35 + i * 0.12),
									}),
								]}
							/>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-pricing`. */
function scene_landing_pricing(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "0.35rem",
								inlineSize: "100%",
							}),
						]}
					>
						{["Free", "Pro"].map((label, i) => (
							<div
								key={label}
								mix={[
									raw({
										padding: "0.45rem",
										borderRadius: "0.45rem",
										boxShadow:
											i === 1
												? "inset 0 0 0 1px var(--ui-brand-bg-solid)"
												: "inset 0 0 0 1px var(--ui-neutral-border)",
										backgroundColor: i === 1 ? "var(--ui-brand-bg-tint)" : "transparent",
										display: "flex",
										flexDirection: "column",
										gap: "0.25rem",
									}),
								]}
							>
								<span mix={[raw({ fontWeight: "700", fontSize: "0.62rem" })]}>{label}</span>
								<span
									mix={[
										raw({
											fontFamily: "var(--ui-font-mono)",
											fontSize: "0.75rem",
											fontWeight: "700",
										}),
									]}
								>
									{i === 0 ? "$0" : "$24"}
								</span>
							</div>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-split`. */
function scene_landing_split(): RemixNode {
	return (
		<FaceWindow>
			{
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							gap: "0.4rem",
							blockSize: "100%",
							minBlockSize: "5rem",
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "0.3rem",
								justifyContent: "center",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "750", fontSize: "0.75rem", letterSpacing: "-0.02em" })]}>
							Split copy
						</span>
						<FaceLine width="90%" />
						<FaceLine width="70%" />
					</div>
					<div
						mix={[
							raw({
								borderRadius: "0.45rem",
								backgroundColor: "var(--ui-brand-bg-tint)",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					/>
				</div>
			}
		</FaceWindow>
	);
}

/** Miniature for `landing-stage`. */
function scene_landing_stage(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<div mix={[raw({ display: "flex", gap: "0.3rem" })]}>
						{["Overview", "API", "CLI"].map((label, i) => (
							<span
								key={label}
								mix={[
									raw({
										padding: "0.2rem 0.4rem",
										borderRadius: "9999px",
										fontSize: "0.55rem",
										fontWeight: "650",
										backgroundColor: i === 0 ? "var(--ui-brand-bg-solid)" : "transparent",
										color:
											i === 0 ? "var(--ui-brand-fg-on-solid, white)" : "var(--ui-neutral-fg-muted)",
										boxShadow: i === 0 ? "none" : "inset 0 0 0 1px var(--ui-neutral-border)",
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
								flex: "1",
								minBlockSize: "3rem",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								padding: "0.45rem",
								display: "flex",
								flexDirection: "column",
								gap: "0.3rem",
							}),
						]}
					>
						<FaceLine width="100%" strong />
						<FaceLine width="80%" />
						<FaceLine width="60%" />
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-stats`. */
function scene_landing_stats(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(3, 1fr)",
								gap: "0.35rem",
								inlineSize: "100%",
							}),
						]}
					>
						{[
							["99.9%", "uptime"],
							["12ms", "p50"],
							["4k", "reqs"],
						].map(([v, l]) => (
							<span
								key={l}
								mix={[
									raw({
										display: "flex",
										flexDirection: "column",
										gap: "0.15rem",
										alignItems: "center",
									}),
								]}
							>
								<span
									mix={[
										raw({
											fontFamily: "var(--ui-font-mono)",
											fontWeight: "750",
											fontSize: "0.72rem",
										}),
									]}
								>
									{v}
								</span>
								<span mix={[raw({ fontSize: "0.5rem", color: "var(--ui-neutral-fg-muted)" })]}>
									{l}
								</span>
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-strip`. */
function scene_landing_strip(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ display: "flex", gap: "0.55rem", alignItems: "center", fontSize: "0.6rem" }),
						]}
					>
						<span
							mix={[
								raw({
									padding: "0.15rem 0.4rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-brand-bg-tint)",
									color: "var(--ui-brand-fg)",
									fontWeight: "700",
								}),
							]}
						>
							New
						</span>
						<span mix={[raw({ fontWeight: "650" })]}>v2026.11 shipping</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `landing-ticker`. */
function scene_landing_ticker(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								gap: "0.7rem",
								fontSize: "0.6rem",
								fontWeight: "650",
								color: "var(--ui-neutral-fg-muted)",
								whiteSpace: "nowrap",
							}),
						]}
					>
						<span>Launch</span>
						<span>·</span>
						<span>Scale</span>
						<span>·</span>
						<span>Observe</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `link`. */
function scene_link(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								fontSize: "0.75rem",
								fontWeight: "650",
								color: "var(--ui-brand-fg)",
								textDecoration: "underline",
								textUnderlineOffset: "0.15rem",
							}),
						]}
					>
						Read the docs
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `list-item`. */
function scene_list_item(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					{["Inbox", "Assigned", "Snoozed"].map((label, i) => (
						<span
							key={label}
							mix={[
								raw({
									padding: "0.35rem 0.45rem",
									borderRadius: "0.35rem",
									fontSize: "0.65rem",
									fontWeight: "600",
									backgroundColor: i === 0 ? "var(--ui-brand-bg-tint)" : "transparent",
									color: i === 0 ? "var(--ui-brand-fg)" : "inherit",
								}),
							]}
						>
							{label}
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `listbox`. */
function scene_listbox(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					{["Inbox", "Assigned", "Snoozed"].map((label, i) => (
						<span
							key={label}
							mix={[
								raw({
									padding: "0.35rem 0.45rem",
									borderRadius: "0.35rem",
									fontSize: "0.65rem",
									fontWeight: "600",
									backgroundColor: i === 0 ? "var(--ui-brand-bg-tint)" : "transparent",
									color: i === 0 ? "var(--ui-brand-fg)" : "inherit",
								}),
							]}
						>
							{label}
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `logo`. */
function scene_logo(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.4rem",
								fontWeight: "800",
								fontSize: "0.85rem",
								letterSpacing: "-0.02em",
							}),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "1.2rem",
									blockSize: "1.2rem",
									borderRadius: "0.3rem",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
						Keel
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `menu`. */
function scene_menu(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.2rem",
				<>
					{["Cut", "Copy", "Paste", "—", "Delete"].map((label) =>
						label === "—" ? (
							<span
								key="sep"
								mix={[
									raw({
										blockSize: "1px",
										backgroundColor: "var(--ui-neutral-border)",
										marginBlock: "0.15rem",
									}),
								]}
							/>
						) : (
							<span
								key={label}
								mix={[
									raw({
										padding: "0.28rem 0.4rem",
										borderRadius: "0.3rem",
										fontSize: "0.62rem",
										fontWeight: "600",
										backgroundColor: label === "Copy" ? "var(--ui-brand-bg-solid)" : "transparent",
										color: label === "Copy" ? "var(--ui-brand-fg-on-solid, white)" : "inherit",
									}),
								]}
							>
								{label}
							</span>
						),
					)}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `menubar`. */
function scene_menubar(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.45rem",
				<>
					<div
						mix={[raw({ display: "flex", gap: "0.55rem", fontSize: "0.62rem", fontWeight: "600" })]}
					>
						{["File", "Edit", "View"].map((label, i) => (
							<span
								key={label}
								mix={[
									raw({
										padding: "0.2rem 0.35rem",
										borderRadius: "0.3rem",
										backgroundColor: i === 0 ? "var(--ui-brand-bg-tint)" : "transparent",
										color: i === 0 ? "var(--ui-brand-fg)" : "inherit",
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
								padding: "0.35rem",
								borderRadius: "0.4rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								display: "flex",
								flexDirection: "column",
								gap: "0.2rem",
								maxInlineSize: "6.5rem",
							}),
						]}
					>
						{["New", "Open…", "Save"].map((label) => (
							<span key={label} mix={[raw({ fontSize: "0.6rem", padding: "0.2rem 0.3rem" })]}>
								{label}
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `meter`. */
function scene_meter(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<span
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								fontSize: "0.65rem",
								fontWeight: "600",
							}),
						]}
					>
						Uploading
						<span
							mix={[
								raw({ fontFamily: "var(--ui-font-mono)", color: "var(--ui-neutral-fg-muted)" }),
							]}
						>
							72%
						</span>
					</span>
					<div
						mix={[
							raw({
								blockSize: "0.45rem",
								borderRadius: "9999px",
								backgroundColor: "var(--ui-neutral-border)",
								overflow: "hidden",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "block",
									blockSize: "100%",
									inlineSize: "72%",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `nav-link`. */
function scene_nav_link(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span mix={[raw({ fontSize: "0.7rem", fontWeight: "650", color: "var(--ui-brand-fg)" })]}>
						Components
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `nav-menu`. */
function scene_nav_menu(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<div
						mix={[raw({ display: "flex", gap: "0.55rem", fontSize: "0.62rem", fontWeight: "650" })]}
					>
						{["Product", "Docs", "Pricing"].map((label, i) => (
							<span key={label} mix={[raw({ color: i === 0 ? "var(--ui-brand-fg)" : "inherit" })]}>
								{label}
							</span>
						))}
					</div>
					<div
						mix={[
							raw({
								padding: "0.45rem",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								display: "flex",
								flexDirection: "column",
								gap: "0.25rem",
							}),
						]}
					>
						{["UI kit", "Patterns", "Changelog"].map((label) => (
							<span key={label} mix={[raw({ fontSize: "0.6rem" })]}>
								{label}
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `otp`. */
function scene_otp(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div mix={[raw({ display: "flex", gap: "0.3rem" })]}>
						{["6", "1", "4", "", "", ""].map((d, i) => (
							<span
								key={i}
								mix={[
									raw({
										inlineSize: "1.15rem",
										blockSize: "1.4rem",
										borderRadius: "0.3rem",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
										display: "grid",
										placeItems: "center",
										fontFamily: "var(--ui-font-mono)",
										fontWeight: "700",
										fontSize: "0.7rem",
										outline: i === 3 ? "2px solid var(--ui-brand-bg-solid)" : "none",
									}),
								]}
							>
								{d}
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `page-header`. */
function scene_page_header(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					<span mix={[raw({ fontSize: "0.55rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Monitors / api.dev
					</span>
					<span
						mix={[raw({ display: "flex", justifyContent: "space-between", alignItems: "center" })]}
					>
						<span mix={[raw({ fontWeight: "750", fontSize: "0.85rem", letterSpacing: "-0.02em" })]}>
							api.dev
						</span>
						{ghostButton("Edit")}
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `pagination`. */
function scene_pagination(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div mix={[raw({ display: "flex", gap: "0.3rem", alignItems: "center" })]}>
						{["‹", "1", "2", "3", "›"].map((label) => (
							<span
								key={label}
								mix={[
									raw({
										inlineSize: "1.2rem",
										blockSize: "1.2rem",
										display: "grid",
										placeItems: "center",
										borderRadius: "0.3rem",
										fontSize: "0.6rem",
										fontWeight: "650",
										backgroundColor: label === "2" ? "var(--ui-brand-bg-solid)" : "transparent",
										color: label === "2" ? "var(--ui-brand-fg-on-solid, white)" : "inherit",
										boxShadow: label === "2" ? "none" : "inset 0 0 0 1px var(--ui-neutral-border)",
									}),
								]}
							>
								{label}
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `popover`. */
function scene_popover(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								maxInlineSize: "8.5rem",
								padding: "0.55rem",
								borderRadius: "0.55rem",
								boxShadow:
									"inset 0 0 0 1px var(--ui-neutral-border), 0 10px 22px -12px rgb(0 0 0 / 0.2)",
								display: "flex",
								flexDirection: "column",
								gap: "0.35rem",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "650", fontSize: "0.65rem" })]}>Share link</span>
						<FaceLine width="100%" />
						<FaceLine width="70%" />
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `product-frame`. */
function scene_product_frame(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.55rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						Monitors
					</span>
					{["api.beacon.dev", "app.beacon.dev", "eu-west · degraded"].map((label, i) => (
						<span
							key={label}
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.4rem",
									fontSize: "0.6rem",
									fontFamily: "var(--ui-font-mono)",
								}),
							]}
						>
							<span
								mix={[
									raw({
										inlineSize: "0.4rem",
										blockSize: "0.4rem",
										borderRadius: "9999px",
										backgroundColor: i === 2 ? "oklch(0.65 0.18 35)" : "oklch(0.65 0.15 150)",
									}),
								]}
							/>
							{label}
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Ink phone bezel used by the phone-frame and phone-fan miniatures. */
function facePhone(opts: {
	title: string;
	width?: string;
	height?: string;
	offset?: string;
	scale?: string;
	z?: string;
}): RemixNode {
	return (
		<div
			mix={[
				raw({
					position: "relative",
					inlineSize: opts.width ?? "42%",
					blockSize: opts.height ?? "88%",
					borderRadius: "18% / 9%",
					backgroundColor: "oklch(0.22 0.01 70)",
					boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
					padding: "0.28rem",
					marginInlineStart: opts.offset,
					scale: opts.scale,
					zIndex: opts.z ?? "0",
					flexShrink: "0",
				}),
			]}
		>
			<div
				mix={[
					raw({
						inlineSize: "100%",
						blockSize: "100%",
						borderRadius: "14% / 7%",
						backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
						display: "flex",
						flexDirection: "column",
						gap: "0.3rem",
						padding: "0.45rem 0.4rem",
						overflow: "hidden",
					}),
				]}
			>
				<span
					mix={[
						raw({
							fontSize: "0.5rem",
							fontWeight: "650",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{opts.title}
				</span>
				<span
					mix={[
						raw({
							flex: "1",
							borderRadius: "0.4rem",
							backgroundColor: "color-mix(in oklch, CanvasText 6%, transparent)",
						}),
					]}
				/>
			</div>
		</div>
	);
}

/** Miniature for `phone-frame`. */
function scene_phone_frame(): RemixNode {
	return (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					paddingBlock: "0.6rem",
				}),
			]}
		>
			{facePhone({ title: "Today", width: "38%", height: "92%" })}
		</div>
	);
}

/** Miniature for `phone-fan`. */
function scene_phone_fan(): RemixNode {
	return (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "flex",
					alignItems: "flex-end",
					justifyContent: "center",
					paddingBlock: "0.55rem 0.35rem",
					overflow: "hidden",
				}),
			]}
		>
			{facePhone({
				title: "Lists",
				width: "30%",
				height: "72%",
				offset: "0",
				scale: "0.92",
				z: "0",
			})}
			{facePhone({
				title: "Today",
				width: "34%",
				height: "86%",
				offset: "-0.55rem",
				z: "1",
			})}
			{facePhone({
				title: "Meals",
				width: "30%",
				height: "72%",
				offset: "-0.55rem",
				scale: "0.92",
				z: "0",
			})}
		</div>
	);
}

/** Miniature for `property-list`. */
function scene_property_list(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					{[
						["Status", "Live"],
						["Region", "iad"],
						["Plan", "Pro"],
					].map(([k, v]) => (
						<div
							key={k}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "1fr 1fr",
									gap: "0.35rem",
									fontSize: "0.6rem",
									borderBlockEnd: "1px solid var(--ui-neutral-border)",
									paddingBlockEnd: "0.25rem",
								}),
							]}
						>
							<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>{k}</span>
							<span
								mix={[
									raw({ fontWeight: "650", textAlign: "end", fontFamily: "var(--ui-font-mono)" }),
								]}
							>
								{v}
							</span>
						</div>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `radio-group`. */
function scene_radio_group(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					{[
						["Monthly", true],
						["Yearly", false],
					].map(([label, on]) => (
						<span
							key={label as string}
							mix={[
								raw({
									display: "flex",
									alignItems: "center",
									gap: "0.4rem",
									fontSize: "0.68rem",
									fontWeight: "600",
								}),
							]}
						>
							<span
								mix={[
									raw({
										inlineSize: "0.85rem",
										blockSize: "0.85rem",
										borderRadius: "9999px",
										boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
										display: "grid",
										placeItems: "center",
									}),
								]}
							>
								{on ? (
									<span
										mix={[
											raw({
												inlineSize: "0.4rem",
												blockSize: "0.4rem",
												borderRadius: "9999px",
												backgroundColor: "var(--ui-brand-bg-solid)",
											}),
										]}
									/>
								) : null}
							</span>
							{label as string}
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `range-calendar`. */
function scene_range_calendar(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.2rem",
				<>
					<span mix={[raw({ fontWeight: "650", fontSize: "0.68rem" })]}>Mar 12–18</span>
					{calendarCells([8, 9, 10, 11, 12])}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `save-bar`. */
function scene_save_bar(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								inlineSize: "100%",
								padding: "0.4rem 0.5rem",
								borderRadius: "0.5rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						<span mix={[raw({ fontSize: "0.6rem", color: "var(--ui-neutral-fg-muted)" })]}>
							Unsaved changes
						</span>
						{primaryButton("Save")}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `scroll-area`. */
function scene_scroll_area(): RemixNode {
	return (
		<FaceWindow>
			{
				<div
					mix={[
						raw({
							position: "relative",
							blockSize: "100%",
							minBlockSize: "5rem",
							overflow: "hidden",
							paddingInlineEnd: "0.55rem",
						}),
					]}
				>
					<div mix={[raw({ display: "flex", flexDirection: "column", gap: "0.3rem" })]}>
						{[100, 90, 95, 70, 85, 60, 80].map((w, i) => (
							<FaceLine key={i} width={`${w}%`} />
						))}
					</div>
					<span
						mix={[
							raw({
								position: "absolute",
								insetBlockStart: "0.4rem",
								insetInlineEnd: "0.15rem",
								inlineSize: "0.25rem",
								blockSize: "35%",
								borderRadius: "9999px",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
				</div>
			}
		</FaceWindow>
	);
}

/** Miniature for `search`. */
function scene_search(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								display: "flex",
								alignItems: "center",
								gap: "0.4rem",
								padding: "0.45rem 0.55rem",
								borderRadius: "9999px",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								fontSize: "0.65rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						<span mix={[raw({ fontWeight: "700" })]}>⌕</span>
						Search monitors…
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `select`. */
function scene_select(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								padding: "0.45rem 0.55rem",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								fontSize: "0.68rem",
								fontWeight: "600",
							}),
						]}
					>
						Production
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>▾</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `selection-bar`. */
function scene_selection_bar(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								inlineSize: "100%",
								padding: "0.4rem 0.5rem",
								borderRadius: "0.5rem",
								backgroundColor: "var(--ui-brand-bg-solid)",
								color: "var(--ui-brand-fg-on-solid, white)",
								fontSize: "0.6rem",
								fontWeight: "650",
							}),
						]}
					>
						<span>3 selected</span>
						<span>Delete</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `separator`. */
function scene_separator(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ inlineSize: "100%", display: "flex", alignItems: "center", gap: "0.4rem" }),
						]}
					>
						<span
							mix={[
								raw({ flex: "1", blockSize: "1px", backgroundColor: "var(--ui-neutral-border)" }),
							]}
						/>
						<span
							mix={[
								raw({
									fontSize: "0.55rem",
									color: "var(--ui-neutral-fg-muted)",
									fontWeight: "650",
								}),
							]}
						>
							or
						</span>
						<span
							mix={[
								raw({ flex: "1", blockSize: "1px", backgroundColor: "var(--ui-neutral-border)" }),
							]}
						/>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `settings`. */
function scene_settings(): RemixNode {
	return (
		<FaceWindow rail={defaultRail()}>
			{stack(
				"0.4rem",
				<>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.72rem" })]}>Workspace</span>
					{["General", "Members", "Billing"].map((label, i) => (
						<span
							key={label}
							mix={[
								raw({
									padding: "0.35rem 0.45rem",
									borderRadius: "0.35rem",
									fontSize: "0.62rem",
									fontWeight: "600",
									backgroundColor: i === 0 ? "var(--ui-brand-bg-tint)" : "transparent",
									color: i === 0 ? "var(--ui-brand-fg)" : "inherit",
								}),
							]}
						>
							{label}
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `settings-section`. */
function scene_settings_section(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.7rem" })]}>Danger zone</span>
					<FaceLine width="90%" />
					{ghostButton("Delete workspace")}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `sheet`. */
function scene_sheet(): RemixNode {
	return (
		<FaceWindow>
			{
				<div
					mix={[
						raw({
							position: "absolute",
							inset: "0.75rem 0 0 auto",
							inlineSize: "55%",
							borderRadius: "0.55rem 0 0 0.55rem",
							backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
							boxShadow:
								"inset 1px 0 0 var(--ui-neutral-border), -12px 0 28px -16px rgb(0 0 0 / 0.25)",
							padding: "0.65rem",
							display: "flex",
							flexDirection: "column",
							gap: "0.35rem",
						}),
					]}
				>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.7rem" })]}>Details</span>
					<FaceLine width="100%" />
					<FaceLine width="80%" />
					<FaceLine width="60%" />
				</div>
			}
		</FaceWindow>
	);
}

/** Miniature for `shortcut-list`. */
function scene_shortcut_list(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					{[
						["Search", "⌘K"],
						["Save", "⌘S"],
						["Palette", "⌘P"],
					].map(([label, keys]) => (
						<div
							key={label}
							mix={[raw({ display: "flex", justifyContent: "space-between", fontSize: "0.6rem" })]}
						>
							<span mix={[raw({ fontWeight: "600" })]}>{label}</span>
							<span
								mix={[
									raw({ fontFamily: "var(--ui-font-mono)", color: "var(--ui-neutral-fg-muted)" }),
								]}
							>
								{keys}
							</span>
						</div>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `skeleton`. */
function scene_skeleton(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.4rem",
				<>
					<span
						mix={[
							raw({
								blockSize: "0.7rem",
								inlineSize: "42%",
								borderRadius: "0.3rem",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
					<span
						mix={[
							raw({
								blockSize: "0.45rem",
								inlineSize: "100%",
								borderRadius: "0.3rem",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
					<span
						mix={[
							raw({
								blockSize: "0.45rem",
								inlineSize: "86%",
								borderRadius: "0.3rem",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
					<span
						mix={[
							raw({
								blockSize: "0.45rem",
								inlineSize: "64%",
								borderRadius: "0.3rem",
								backgroundColor: "var(--ui-neutral-border)",
							}),
						]}
					/>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `slider`. */
function scene_slider(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ inlineSize: "100%", display: "flex", flexDirection: "column", gap: "0.45rem" }),
						]}
					>
						<span
							mix={[
								raw({
									display: "flex",
									justifyContent: "space-between",
									fontSize: "0.62rem",
									fontWeight: "600",
								}),
							]}
						>
							Volume
							<span
								mix={[
									raw({ fontFamily: "var(--ui-font-mono)", color: "var(--ui-neutral-fg-muted)" }),
								]}
							>
								72
							</span>
						</span>
						<div
							mix={[
								raw({
									position: "relative",
									blockSize: "0.28rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-neutral-border)",
								}),
							]}
						>
							<span
								mix={[
									raw({
										position: "absolute",
										insetBlock: "0",
										insetInlineStart: "0",
										inlineSize: "72%",
										borderRadius: "9999px",
										backgroundColor: "var(--ui-brand-bg-solid)",
									}),
								]}
							/>
							<span
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: "-0.28rem",
										insetInlineStart: "72%",
										translate: "-50% 0",
										inlineSize: "0.85rem",
										blockSize: "0.85rem",
										borderRadius: "9999px",
										backgroundColor: "white",
										boxShadow: "0 0 0 1px var(--ui-neutral-border), 0 2px 6px rgb(0 0 0 / 0.15)",
									}),
								]}
							/>
						</div>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `sparkline`. */
function scene_sparkline(): RemixNode {
	return (
		<FaceWindow rail={defaultRail()}>
			{stack(
				"0.35rem",
				<>
					<span
						mix={[
							raw({
								fontFamily: "var(--ui-font-mono)",
								fontSize: "0.55rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						p95
					</span>
					<span
						mix={[
							raw({ fontFamily: "var(--ui-font-mono)", fontSize: "0.95rem", fontWeight: "650" }),
						]}
					>
						142 ms
					</span>
					<svg viewBox="0 0 100 28" mix={[raw({ inlineSize: "100%", blockSize: "1.75rem" })]}>
						<polyline
							fill="none"
							stroke="var(--ui-brand-bg-solid)"
							stroke-width="2"
							points="0,22 8,18 16,20 24,14 32,16 40,10 48,12 56,8 64,11 72,6 80,9 88,4 100,7"
						/>
					</svg>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `spinner`. */
function scene_spinner(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								inlineSize: "1.5rem",
								blockSize: "1.5rem",
								borderRadius: "9999px",
								border: "2px solid var(--ui-neutral-border)",
								borderBlockStartColor: "var(--ui-brand-bg-solid)",
							}),
						]}
					/>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `split-view`. */
function scene_split_view(): RemixNode {
	return (
		<FaceWindow>
			{
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "32% 1fr",
							gap: "0",
							blockSize: "100%",
							minBlockSize: "5rem",
							margin: "-0.7rem",
							borderRadius: "0 0 8px 0",
							overflow: "hidden",
						}),
					]}
				>
					<div
						mix={[
							raw({
								padding: "0.55rem",
								borderInlineEnd: "1px solid var(--ui-neutral-border)",
								display: "flex",
								flexDirection: "column",
								gap: "0.3rem",
								backgroundColor: "color-mix(in oklch, CanvasText 2%, transparent)",
							}),
						]}
					>
						<RailTick active width="80%" />
						<RailTick width="60%" />
						<RailTick width="70%" />
					</div>
					<div
						mix={[
							raw({ padding: "0.55rem", display: "flex", flexDirection: "column", gap: "0.3rem" }),
						]}
					>
						<span mix={[raw({ fontWeight: "700", fontSize: "0.65rem" })]}>Thread</span>
						<FaceLine width="100%" />
						<FaceLine width="85%" />
						<FaceLine width="70%" />
					</div>
				</div>
			}
		</FaceWindow>
	);
}

/** Miniature for `stat-card`. */
function scene_stat_card(): RemixNode {
	return (
		<FaceWindow rail={defaultRail()}>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								padding: "0.65rem",
								borderRadius: "0.55rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								display: "flex",
								flexDirection: "column",
								gap: "0.3rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.55rem",
									color: "var(--ui-neutral-fg-muted)",
								}),
							]}
						>
							Active seats
						</span>
						<span
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									fontSize: "1.25rem",
									fontWeight: "700",
									letterSpacing: "-0.03em",
								}),
							]}
						>
							64
						</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `status-dot`. */
function scene_status_dot(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.4rem",
								fontSize: "0.68rem",
								fontWeight: "650",
							}),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "0.5rem",
									blockSize: "0.5rem",
									borderRadius: "9999px",
									backgroundColor: "oklch(0.65 0.15 150)",
								}),
							]}
						/>
						Operational
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `status-strip`. */
function scene_status_strip(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<span
						mix={[
							raw({ fontSize: "0.58rem", fontWeight: "650", color: "var(--ui-neutral-fg-muted)" }),
						]}
					>
						90 days
					</span>
					<div
						mix={[
							raw({ display: "flex", gap: "2px", alignItems: "stretch", minBlockSize: "1.6rem" }),
						]}
					>
						{Array.from({ length: 28 }, (_, i) => (
							<span
								key={i}
								mix={[
									raw({
										flex: "1",
										borderRadius: "1px",
										backgroundColor: i === 19 ? "oklch(0.65 0.18 35)" : "oklch(0.65 0.15 150)",
										opacity: i === 19 ? "1" : "0.85",
									}),
								]}
							/>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `switch`. */
function scene_switch(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.55rem",
								fontWeight: "600",
								fontSize: "0.68rem",
							}),
						]}
					>
						Notifications
						<span
							mix={[
								raw({
									inlineSize: "1.7rem",
									blockSize: "1rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-brand-bg-solid)",
									position: "relative",
								}),
							]}
						>
							<span
								mix={[
									raw({
										position: "absolute",
										insetBlockStart: "0.12rem",
										insetInlineEnd: "0.12rem",
										inlineSize: "0.75rem",
										blockSize: "0.75rem",
										borderRadius: "9999px",
										backgroundColor: "white",
									}),
								]}
							/>
						</span>
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `table`. */
function scene_table(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.25rem",
				<>
					{[
						["Host", "p95", true],
						["api.dev", "88", false],
						["app.dev", "142", false],
						["eu-west", "1.2s", false],
					].map((row) => (
						<div
							key={row[0] as string}
							mix={[
								raw({
									display: "grid",
									gridTemplateColumns: "1fr 2.5rem",
									gap: "0.35rem",
									padding: "0.28rem 0.2rem",
									borderBlockEnd: "1px solid var(--ui-neutral-border)",
									fontSize: "0.58rem",
									fontFamily: "var(--ui-font-mono)",
									fontWeight: row[2] ? "700" : "500",
									color: row[2] ? "var(--ui-neutral-fg-muted)" : "inherit",
								}),
							]}
						>
							<span>{row[0] as string}</span>
							<span mix={[raw({ textAlign: "end" })]}>{row[1] as string}</span>
						</div>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `tabs`. */
function scene_tabs(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.45rem",
				<>
					<div
						mix={[
							raw({
								display: "flex",
								gap: "0.7rem",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								paddingBlockEnd: "0.35rem",
							}),
						]}
					>
						{[
							["Overview", true],
							["Usage", false],
							["Billing", false],
						].map(([label, on]) => (
							<span
								key={label as string}
								mix={[
									raw({
										fontSize: "0.62rem",
										fontWeight: on ? "650" : "500",
										color: on ? "inherit" : "var(--ui-neutral-fg-muted)",
										boxShadow: on ? "0 1px 0 var(--ui-brand-bg-solid)" : "none",
										paddingBlockEnd: "0.2rem",
									}),
								]}
							>
								{label as string}
							</span>
						))}
					</div>
					<FaceLine width="100%" strong />
					<FaceLine width="86%" />
					<FaceLine width="72%" />
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `tags`. */
function scene_tags(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({ display: "flex", gap: "0.3rem", flexWrap: "wrap", justifyContent: "center" }),
						]}
					>
						{["ui", "a11y", "remix"].map((label) => (
							<span
								key={label}
								mix={[
									raw({
										padding: "0.15rem 0.45rem",
										borderRadius: "9999px",
										backgroundColor: "var(--ui-brand-bg-tint)",
										color: "var(--ui-brand-fg)",
										fontSize: "0.58rem",
										fontWeight: "650",
									}),
								]}
							>
								{label}
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `text-block`. */
function scene_text_block(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					<span mix={[raw({ fontWeight: "700", fontSize: "0.75rem" })]}>Body copy</span>
					<FaceLine width="100%" />
					<FaceLine width="92%" />
					<FaceLine width="70%" />
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `text-mono`. */
function scene_text_mono(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({ fontFamily: "var(--ui-font-mono)", fontSize: "0.7rem", fontWeight: "650" }),
						]}
					>
						3 minutes ago
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `textarea`. */
function scene_textarea(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.3rem",
				<>
					<span mix={[raw({ fontSize: "0.58rem", color: "var(--ui-neutral-fg-muted)" })]}>
						Notes
					</span>
					<div
						mix={[
							raw({
								minBlockSize: "3.4rem",
								padding: "0.45rem 0.55rem",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
								display: "flex",
								flexDirection: "column",
								gap: "0.3rem",
							}),
						]}
					>
						<FaceLine width="95%" />
						<FaceLine width="80%" />
						<FaceLine width="60%" />
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `timeline`. */
function scene_timeline(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					{["Deployed", "Checks green", "Rolled out"].map((label, i) => (
						<span
							key={label}
							mix={[raw({ display: "flex", gap: "0.45rem", alignItems: "flex-start" })]}
						>
							<span
								mix={[
									raw({
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										gap: "0.15rem",
									}),
								]}
							>
								<span
									mix={[
										raw({
											inlineSize: "0.45rem",
											blockSize: "0.45rem",
											borderRadius: "9999px",
											backgroundColor:
												i === 0 ? "var(--ui-brand-bg-solid)" : "var(--ui-neutral-border)",
										}),
									]}
								/>
								{i < 2 ? (
									<span
										mix={[
											raw({
												inlineSize: "1px",
												blockSize: "0.7rem",
												backgroundColor: "var(--ui-neutral-border)",
											}),
										]}
									/>
								) : null}
							</span>
							<span mix={[raw({ fontSize: "0.62rem", fontWeight: "600" })]}>{label}</span>
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `toast`. */
function scene_toast(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								gap: "0.45rem",
								alignItems: "center",
								padding: "0.5rem 0.65rem",
								borderRadius: "0.55rem",
								boxShadow:
									"inset 0 0 0 1px var(--ui-neutral-border), 0 8px 18px -10px rgb(0 0 0 / 0.2)",
								backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
								fontSize: "0.65rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "0.45rem",
									blockSize: "0.45rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-brand-bg-solid)",
								}),
							]}
						/>
						<span mix={[raw({ fontWeight: "650" })]}>Saved</span>
						<span mix={[raw({ color: "var(--ui-neutral-fg-muted)" })]}>Just now</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `toasts`. */
function scene_toasts(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.35rem",
				<>
					{["Saved", "Invite sent", "Copied"].map((label, i) => (
						<div
							key={label}
							mix={[
								raw({
									display: "flex",
									gap: "0.4rem",
									alignItems: "center",
									padding: "0.4rem 0.55rem",
									borderRadius: "0.45rem",
									boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
									fontSize: "0.6rem",
									fontWeight: "650",
									opacity: String(1 - i * 0.18),
								}),
							]}
						>
							<span
								mix={[
									raw({
										inlineSize: "0.35rem",
										blockSize: "0.35rem",
										borderRadius: "9999px",
										backgroundColor: "var(--ui-brand-bg-solid)",
									}),
								]}
							/>
							{label}
						</div>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `toggle`. */
function scene_toggle(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<span
						mix={[
							raw({
								display: "inline-flex",
								padding: "0.35rem 0.7rem",
								borderRadius: "0.45rem",
								backgroundColor: "var(--ui-brand-bg-tint)",
								color: "var(--ui-brand-fg)",
								fontWeight: "650",
								fontSize: "0.68rem",
								boxShadow:
									"inset 0 0 0 1px color-mix(in oklch, var(--ui-brand-bg-solid) 35%, transparent)",
							}),
						]}
					>
						Bold
					</span>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `toolbar`. */
function scene_toolbar(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								gap: "0.25rem",
								padding: "0.3rem",
								borderRadius: "0.5rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						{["B", "I", "U", "…"].map((label, i) => (
							<span
								key={label}
								mix={[
									raw({
										inlineSize: "1.25rem",
										blockSize: "1.25rem",
										display: "grid",
										placeItems: "center",
										borderRadius: "0.3rem",
										fontSize: "0.62rem",
										fontWeight: "700",
										backgroundColor: i === 0 ? "var(--ui-brand-bg-tint)" : "transparent",
										color: i === 0 ? "var(--ui-brand-fg)" : "inherit",
									}),
								]}
							>
								{label}
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `tooltip`. */
function scene_tooltip(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								padding: "0.35rem 0.55rem",
								borderRadius: "0.4rem",
								backgroundColor: "var(--ui-neutral-fg-emphasis, CanvasText)",
								color: "var(--ui-bg, white)",
								fontWeight: "650",
								fontSize: "0.62rem",
							}),
						]}
					>
						Copied
					</div>
					<span
						mix={[
							raw({
								inlineSize: "0",
								blockSize: "0",
								borderInline: "0.3rem solid transparent",
								borderBlockStart: "0.35rem solid var(--ui-neutral-fg-emphasis, CanvasText)",
							}),
						]}
					/>
					<span
						mix={[
							raw({
								inlineSize: "0.55rem",
								blockSize: "0.55rem",
								borderRadius: "9999px",
								backgroundColor: "var(--ui-neutral-border)",
								marginBlockStart: "0.35rem",
							}),
						]}
					/>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `tree`. */
function scene_tree(): RemixNode {
	return (
		<FaceWindow>
			{stack(
				"0.25rem",
				<>
					{[
						["▾ src", 0],
						["  index.ts", 1],
						["  faces.ts", 1],
						["▾ tests", 0],
					].map(([label, depth]) => (
						<span
							key={label as string}
							mix={[
								raw({
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.58rem",
									paddingInlineStart: `${(depth as number) * 0.55}rem`,
									fontWeight: depth === 0 ? "700" : "500",
								}),
							]}
						>
							{label as string}
						</span>
					))}
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `video`. */
function scene_video(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								inlineSize: "100%",
								aspectRatio: "16 / 10",
								borderRadius: "0.45rem",
								backgroundColor: "var(--ui-color-neutral-900, oklch(0.25 0.02 275))",
								display: "grid",
								placeItems: "center",
							}),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "1.4rem",
									blockSize: "1.4rem",
									borderRadius: "9999px",
									backgroundColor: "var(--ui-brand-bg-solid)",
									display: "grid",
									placeItems: "center",
									color: "white",
									fontSize: "0.6rem",
								}),
							]}
						>
							▶
						</span>
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Miniature for `view-options`. */
function scene_view_options(): RemixNode {
	return (
		<FaceWindow>
			{center(
				<>
					<div
						mix={[
							raw({
								display: "flex",
								gap: "0.3rem",
								padding: "0.25rem",
								borderRadius: "0.45rem",
								boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							}),
						]}
					>
						{["List", "Board"].map((label, i) => (
							<span
								key={label}
								mix={[
									raw({
										padding: "0.25rem 0.5rem",
										borderRadius: "0.3rem",
										fontSize: "0.58rem",
										fontWeight: "650",
										backgroundColor: i === 0 ? "var(--ui-brand-bg-solid)" : "transparent",
										color: i === 0 ? "var(--ui-brand-fg-on-solid, white)" : "inherit",
									}),
								]}
							>
								{label}
							</span>
						))}
					</div>
				</>,
			)}
		</FaceWindow>
	);
}

/** Scene renderer for every face kind. */
const SCENES: Record<FaceKind, () => RemixNode> = {
	accordion: scene_accordion,
	alert: scene_alert,
	"app-shell": scene_app_shell,
	"app-shell-toggle": scene_app_shell_toggle,
	avatar: scene_avatar,
	badge: scene_badge,
	banner: scene_banner,
	bento: scene_bento,
	breadcrumbs: scene_breadcrumbs,
	button: scene_button,
	"button-ghost": scene_button_ghost,
	calendar: scene_calendar,
	card: scene_card,
	carousel: scene_carousel,
	chart: scene_chart,
	chat: scene_chat,
	"chat-attach": scene_chat_attach,
	"chat-marker": scene_chat_marker,
	"chat-scroller": scene_chat_scroller,
	checkbox: scene_checkbox,
	"checkbox-group": scene_checkbox_group,
	"color-area": scene_color_area,
	"color-field": scene_color_field,
	"color-picker": scene_color_picker,
	"color-slider": scene_color_slider,
	"color-swatch": scene_color_swatch,
	"color-swatches": scene_color_swatches,
	"color-wheel": scene_color_wheel,
	command: scene_command,
	cta: scene_cta,
	"danger-zone": scene_danger_zone,
	"date-picker": scene_date_picker,
	"date-range": scene_date_range,
	dialog: scene_dialog,
	disclosure: scene_disclosure,
	docs: scene_docs,
	"docs-code": scene_docs_code,
	"docs-code-tabs": scene_docs_code_tabs,
	"docs-feedback": scene_docs_feedback,
	"docs-footer": scene_docs_footer,
	"docs-header": scene_docs_header,
	"docs-nav": scene_docs_nav,
	"docs-steps": scene_docs_steps,
	"docs-toc": scene_docs_toc,
	drawer: scene_drawer,
	"drop-indicator": scene_drop_indicator,
	"drop-zone": scene_drop_zone,
	empty: scene_empty,
	field: scene_field,
	"field-error": scene_field_error,
	"file-trigger": scene_file_trigger,
	"filter-bar": scene_filter_bar,
	form: scene_form,
	"grid-list": scene_grid_list,
	heading: scene_heading,
	highlight: scene_highlight,
	"hover-card": scene_hover_card,
	image: scene_image,
	keyboard: scene_keyboard,
	label: scene_label,
	"landing-accent-text": scene_landing_accent_text,
	"landing-author": scene_landing_author,
	"landing-code": scene_landing_code,
	"landing-diagram": scene_landing_diagram,
	"landing-feature": scene_landing_feature,
	"landing-footer": scene_landing_footer,
	"landing-header": scene_landing_header,
	"landing-hero": scene_landing_hero,
	"landing-icons": scene_landing_icons,
	"landing-logos": scene_landing_logos,
	"landing-motion": scene_landing_motion,
	"landing-pricing": scene_landing_pricing,
	"landing-split": scene_landing_split,
	"landing-stage": scene_landing_stage,
	"landing-stats": scene_landing_stats,
	"landing-strip": scene_landing_strip,
	"landing-ticker": scene_landing_ticker,
	link: scene_link,
	"list-item": scene_list_item,
	listbox: scene_listbox,
	logo: scene_logo,
	menu: scene_menu,
	menubar: scene_menubar,
	meter: scene_meter,
	"nav-link": scene_nav_link,
	"nav-menu": scene_nav_menu,
	otp: scene_otp,
	"page-header": scene_page_header,
	pagination: scene_pagination,
	"phone-fan": scene_phone_fan,
	"phone-frame": scene_phone_frame,
	popover: scene_popover,
	"product-frame": scene_product_frame,
	"property-list": scene_property_list,
	"radio-group": scene_radio_group,
	"range-calendar": scene_range_calendar,
	"save-bar": scene_save_bar,
	"scroll-area": scene_scroll_area,
	search: scene_search,
	select: scene_select,
	"selection-bar": scene_selection_bar,
	separator: scene_separator,
	settings: scene_settings,
	"settings-section": scene_settings_section,
	sheet: scene_sheet,
	"shortcut-list": scene_shortcut_list,
	skeleton: scene_skeleton,
	slider: scene_slider,
	sparkline: scene_sparkline,
	spinner: scene_spinner,
	"split-view": scene_split_view,
	"stat-card": scene_stat_card,
	"status-dot": scene_status_dot,
	"status-strip": scene_status_strip,
	switch: scene_switch,
	table: scene_table,
	tabs: scene_tabs,
	tags: scene_tags,
	"text-block": scene_text_block,
	"text-mono": scene_text_mono,
	textarea: scene_textarea,
	timeline: scene_timeline,
	toast: scene_toast,
	toasts: scene_toasts,
	toggle: scene_toggle,
	toolbar: scene_toolbar,
	tooltip: scene_tooltip,
	tree: scene_tree,
	video: scene_video,
	"view-options": scene_view_options,
};

/** Draws the miniature scene for a face kind. */
export function renderFaceScene(kind: FaceKind): RemixNode {
	return (SCENES[kind] ?? scene_card)();
}
