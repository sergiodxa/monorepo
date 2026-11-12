/**
 * Chorus's gallery miniature: the icon nav, a timeline with its tabs, a post with a night-sky
 * picture under the "Show new posts" pill, and the trends card, so the card reads as a social
 * timeline before its name is read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import { PEOPLE } from "~/resources/views/demo-apps/chorus/data";
import { ChorusMark, PersonAvatar, SceneArt } from "~/resources/views/demo-apps/chorus/parts";

/** A bar standing in for a line of text. */
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

/** One miniature post: a face, a name line, two text lines and, for the first, a picture. */
function MiniPost(handle: Handle<{ person: number; picture?: boolean }>) {
	return () => {
		let person = PEOPLE[handle.props.person] ?? PEOPLE[0]!;
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "1.25rem 1fr",
						gap: "0.4rem",
						padding: "0.45rem 0.5rem",
						borderBlockEnd: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				<PersonAvatar person={person} size={1.25} />
				<div mix={[raw({ display: "grid", gap: "0.25rem", alignContent: "start" })]}>
					<Line width="45%" strong />
					<Line width="92%" />
					<Line width="70%" />
					{handle.props.picture ? (
						<div
							mix={[
								raw({
									blockSize: "3.1rem",
									borderRadius: "0.4rem",
									overflow: "hidden",
									marginBlockStart: "0.15rem",
								}),
							]}
						>
							<SceneArt scene="night-sky" />
						</div>
					) : null}
					<span
						mix={[
							raw({
								display: "flex",
								justifyContent: "space-between",
								inlineSize: "80%",
								marginBlockStart: "0.1rem",
							}),
						]}
					>
						{[
							"var(--ui-neutral-border)",
							"oklch(0.6 0.15 152)",
							"oklch(0.62 0.2 5)",
							"var(--ui-neutral-border)",
						].map((colour) => (
							<span
								mix={[
									raw({
										inlineSize: "0.35rem",
										blockSize: "0.35rem",
										borderRadius: "999px",
										background: colour,
									}),
								]}
							/>
						))}
					</span>
				</div>
			</div>
		);
	};
}

/** Renders the miniature: nav rail, timeline and trends. */
export function ChorusThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					gridTemplateColumns: "2.25rem 1fr 30%",
					background: "var(--ui-bg)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						display: "grid",
						justifyItems: "center",
						alignContent: "start",
						gap: "0.55rem",
						paddingBlock: "0.55rem",
					}),
				]}
			>
				<ChorusMark size={18} />
				{[0, 1, 2, 3, 4].map((index) => (
					<span
						mix={[
							raw({
								inlineSize: "0.75rem",
								blockSize: "0.75rem",
								borderRadius: "0.25rem",
								border: `1.5px solid ${index === 0 ? "var(--ui-neutral-fg-emphasis)" : "var(--ui-neutral-fg-muted)"}`,
							}),
						]}
					/>
				))}
				<span
					mix={[
						raw({
							inlineSize: "1.4rem",
							blockSize: "1.4rem",
							borderRadius: "999px",
							background: "var(--ui-brand-bg-solid)",
						}),
					]}
				/>
			</div>
			<div
				mix={[
					raw({
						position: "relative",
						overflow: "hidden",
						borderInline: "1px solid var(--ui-neutral-border)",
					}),
				]}
			>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
							fontWeight: "700",
							textAlign: "center",
						}),
					]}
				>
					<span
						mix={[
							raw({
								paddingBlock: "0.45rem",
								boxShadow: "inset 0 -2px 0 var(--ui-brand-bg-solid)",
							}),
						]}
					>
						For you
					</span>
					<span
						mix={[
							raw({
								paddingBlock: "0.45rem",
								color: "var(--ui-neutral-fg-muted)",
								fontWeight: "500",
							}),
						]}
					>
						Following
					</span>
				</div>
				<MiniPost person={3} picture />
				<MiniPost person={1} />
				<span
					mix={[
						raw({
							position: "absolute",
							insetBlockStart: "2.3rem",
							insetInlineStart: "50%",
							translate: "-50% 0",
							paddingInline: "0.55rem",
							blockSize: "1.2rem",
							display: "inline-flex",
							alignItems: "center",
							borderRadius: "999px",
							background: "var(--ui-brand-bg-solid)",
							color: "white",
							fontSize: "0.6rem",
							fontWeight: "700",
							whiteSpace: "nowrap",
							boxShadow: "0 4px 10px -4px var(--ui-color-brand-700)",
						}),
					]}
				>
					↑ Show 3 new posts
				</span>
			</div>
			<div
				mix={[raw({ display: "grid", alignContent: "start", gap: "0.45rem", padding: "0.5rem" })]}
			>
				<span
					mix={[
						raw({
							blockSize: "1.1rem",
							borderRadius: "999px",
							background: "var(--ui-neutral-bg-tint-hover)",
						}),
					]}
				/>
				<div
					mix={[
						raw({
							display: "grid",
							gap: "0.4rem",
							padding: "0.45rem",
							borderRadius: "0.5rem",
							border: "1px solid var(--ui-neutral-border)",
						}),
					]}
				>
					<span mix={[raw({ fontWeight: "800" })]}>Trending</span>
					{["#Leonids", "field-sizing", "Night trains"].map((topic) => (
						<span mix={[raw({ display: "grid", gap: "0.1rem" })]}>
							<Line width="60%" />
							<span mix={[raw({ fontWeight: "650", fontSize: "0.65rem" })]}>{topic}</span>
						</span>
					))}
				</div>
			</div>
		</div>
	);
}
