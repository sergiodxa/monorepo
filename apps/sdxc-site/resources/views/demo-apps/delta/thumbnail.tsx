/**
 * Delta's gallery miniature: the sidebar, a file tree with one file open, and that file's
 * code under a latest-commit bar, its lines numbered and painted in the theme's syntax
 * colours, so the card reads as a code host before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

/** The sidebar's rows, the repository current. */
const NAV = ["Dashboard", "Notifications", "sdxc/delta", "sdxc"] as const;

/** The tree's rows: depth, name, and whether it is the open file. */
const TREE: Array<[number, string, boolean]> = [
	[0, "screens", false],
	[1, "blob.tsx", true],
	[1, "commits.tsx", false],
	[1, "home.tsx", false],
	[0, "data.ts", false],
	[0, "index.tsx", false],
	[0, "shell.tsx", false],
	[0, "README.md", false],
];

/** The code's lines as runs of token kind and width in `ch`, indented by tabs. */
const CODE: Array<[number, Array<[string, number]>]> = [
	[
		0,
		[
			["keyword", 6],
			["plain", 9],
			["keyword", 4],
			["string", 16],
		],
	],
	[0, []],
	[0, [["comment", 30]]],
	[
		0,
		[
			["keyword", 6],
			["keyword", 8],
			["function", 10],
			["punctuation", 8],
		],
	],
	[
		1,
		[
			["keyword", 6],
			["punctuation", 3],
			["property", 7],
			["punctuation", 3],
		],
	],
	[
		1,
		[
			["keyword", 3],
			["plain", 6],
			["punctuation", 2],
			["function", 9],
			["punctuation", 3],
		],
	],
	[
		2,
		[
			["tag", 5],
			["property", 7],
			["string", 12],
		],
	],
	[
		2,
		[
			["tag", 9],
			["property", 5],
			["punctuation", 2],
		],
	],
	[1, [["punctuation", 2]]],
	[0, [["punctuation", 1]]],
];

/** A bar standing in for one run of code, in the colour the theme paints its kind. */
function Run(handle: Handle<{ kind: string; width: number }>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-block",
					blockSize: "0.28rem",
					inlineSize: `${handle.props.width * 0.22}rem`,
					borderRadius: "999px",
					marginInlineEnd: "0.15rem",
					background:
						handle.props.kind === "plain"
							? "var(--ui-neutral-fg-muted)"
							: `var(--highlight-${handle.props.kind}, var(--ui-neutral-fg-muted))`,
					opacity: handle.props.kind === "comment" ? 0.6 : 0.85,
				}),
			]}
		/>
	);
}

/** Renders the miniature: sidebar, tree pane and code beside it. */
export function DeltaThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateColumns: "22% 1fr",
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
					sdxc
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
								fontFamily: index >= 2 ? "var(--ui-font-mono)" : undefined,
								background: index === 2 ? "var(--ui-neutral-bg-tint-pressed)" : "transparent",
								fontWeight: index === 2 ? "600" : "400",
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
						borderRadius: "0.3rem",
						background: "var(--ui-bg, Canvas)",
						border: "1px solid var(--ui-neutral-border)",
						overflow: "hidden",
						display: "grid",
						gridTemplateColumns: "30% 1fr",
						gap: "0.4rem",
						padding: "0.5rem",
					}),
				]}
			>
				<div
					mix={[
						raw({ display: "flex", flexDirection: "column", gap: "0.1rem", overflow: "hidden" }),
					]}
				>
					{TREE.map(([depth, name, open]) => (
						<span
							mix={[
								raw({
									paddingInlineStart: `${0.3 + depth * 0.5}rem`,
									paddingBlock: "0.1rem",
									borderRadius: "0.15rem",
									whiteSpace: "nowrap",
									overflow: "hidden",
									textOverflow: "ellipsis",
									fontFamily: "var(--ui-font-mono)",
									fontSize: "0.42rem",
									background: open ? "var(--ui-brand-bg-tint)" : "transparent",
									boxShadow: open ? "inset 1.5px 0 0 var(--ui-brand-fg)" : "none",
									fontWeight: open ? "600" : "400",
								}),
							]}
						>
							{name}
						</span>
					))}
				</div>
				<div
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "0.25rem",
							overflow: "hidden",
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "center",
								gap: "0.3rem",
								padding: "0.3rem 0.4rem",
								background: "var(--ui-neutral-bg-tint)",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								fontSize: "0.42rem",
							}),
						]}
					>
						<span
							mix={[
								raw({
									inlineSize: "0.5rem",
									blockSize: "0.5rem",
									borderRadius: "999px",
									background: "var(--ui-color-brand-300)",
								}),
							]}
						/>
						<span mix={[raw({ fontWeight: "600" })]}>Sergio</span>
						<span
							mix={[
								raw({ flex: "1 1 auto", opacity: 0.7, whiteSpace: "nowrap", overflow: "hidden" }),
							]}
						>
							feat(sdxc-site): Start Delta
						</span>
						<span mix={[raw({ fontFamily: "var(--ui-font-mono)", opacity: 0.7 })]}>3f2a9c1</span>
					</div>
					<div
						mix={[
							raw({
								display: "flex",
								flexDirection: "column",
								gap: "0.22rem",
								padding: "0.4rem 0",
							}),
						]}
					>
						{CODE.map(([indent, runs], index) => (
							<span
								mix={[
									raw({
										display: "flex",
										alignItems: "center",
										blockSize: "0.42rem",
										background:
											index === 3 || index === 4 ? "var(--ui-brand-bg-tint)" : "transparent",
										boxShadow:
											index === 3 || index === 4 ? "inset 1.5px 0 0 var(--ui-brand-fg)" : "none",
									}),
								]}
							>
								<span
									mix={[
										raw({
											inlineSize: "1rem",
											textAlign: "end",
											paddingInlineEnd: "0.35rem",
											fontFamily: "var(--ui-font-mono)",
											fontSize: "0.36rem",
											opacity: 0.55,
										}),
									]}
								>
									{index + 1}
								</span>
								<span mix={[raw({ paddingInlineStart: `${indent * 0.5}rem`, display: "flex" })]}>
									{runs.map(([kind, width]) => (
										<Run kind={kind} width={width} />
									))}
								</span>
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
