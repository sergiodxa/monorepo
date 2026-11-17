/**
 * "Who's watching?": the household's profiles as large avatars, each a post that picks the
 * profile and lands on its home. It draws its own frame, without the bars, since nobody is
 * watching yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { Viewer } from "./state";

import { PROFILES, actionHref } from "./data";
import { ProfileAvatar, VesperMark } from "./shell";

/** Renders the picker, the current profile marked. */
export default function ProfilePicker(handle: Handle<{ viewer: Viewer }>) {
	return () => {
		let { viewer } = handle.props;
		return (
			<div
				mix={[
					raw({
						flex: "1 1 auto",
						display: "grid",
						gridTemplateRows: "auto 1fr",
						minBlockSize: "100dvh",
						background:
							"radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--ui-color-brand-900), transparent 55%), transparent 60%), var(--ui-bg)",
					}),
				]}
			>
				<div mix={[raw({ padding: "1.25rem clamp(1rem, 4vw, 3.5rem)" })]}>
					<span
						mix={[
							raw({
								display: "inline-flex",
								alignItems: "center",
								gap: "0.5rem",
								fontSize: "1.25rem",
								fontWeight: "700",
								letterSpacing: "0.18em",
								textTransform: "uppercase",
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						<VesperMark />
						Vesper
					</span>
				</div>
				<main
					mix={[
						raw({
							display: "grid",
							alignContent: "center",
							justifyItems: "center",
							gap: "2.5rem",
							paddingInline: "1rem",
							paddingBlockEnd: "12vh",
						}),
					]}
				>
					<h1
						mix={[
							raw({
								margin: "0",
								fontSize: "clamp(1.75rem, 4vw, 3rem)",
								fontWeight: "600",
								letterSpacing: "-0.02em",
								color: "var(--ui-neutral-fg-emphasis)",
								textAlign: "center",
							}),
						]}
					>
						Who's watching?
					</h1>
					<ul
						mix={[
							raw({
								display: "grid",
								gridTemplateColumns: "repeat(2, minmax(0, 8.5rem))",
								gap: "1.75rem clamp(1rem, 3vw, 2.5rem)",
								margin: "0",
								padding: "0",
								listStyle: "none",
								"@media (min-width: 40rem)": {
									gridTemplateColumns: "repeat(4, minmax(0, 9.5rem))",
								},
							}),
						]}
					>
						{PROFILES.map((profile) => {
							let current = viewer.picked && profile.id === viewer.profile.id;
							return (
								<li>
									<form method="post" action={actionHref(`profiles/${profile.id}`)}>
										<button
											type="submit"
											aria-current={current ? "true" : undefined}
											mix={[
												raw({
													display: "grid",
													justifyItems: "center",
													gap: "0.75rem",
													inlineSize: "100%",
													padding: "0",
													border: "0",
													background: "transparent",
													font: "inherit",
													fontSize: "1rem",
													color: "var(--ui-neutral-fg)",
													cursor: "pointer",
													"& > [aria-hidden]": {
														transition: "box-shadow 160ms ease, translate 160ms ease",
													},
												}),
												when(
													"&:hover",
													raw({
														color: "var(--ui-neutral-fg-emphasis)",
														"& > [aria-hidden]": {
															boxShadow: "0 0 0 3px var(--ui-color-neutral-100)",
														},
													}),
												),
												motionSafe(when("&:hover > [aria-hidden]", raw({ translate: "0 -3px" }))),
												when(
													"&:focus-visible",
													raw({
														outline: "none",
														"& > [aria-hidden]": { boxShadow: "0 0 0 3px var(--ui-brand-ring)" },
													}),
												),
												when(
													"&[aria-current]",
													raw({
														"& > [aria-hidden]": {
															boxShadow: "0 0 0 3px var(--ui-color-brand-500)",
														},
													}),
												),
											]}
										>
											<ProfileAvatar profile={profile} size="fill" />
											<span>{profile.name}</span>
										</button>
									</form>
								</li>
							);
						})}
					</ul>
					<p
						mix={[
							raw({
								margin: "0",
								color: "var(--ui-neutral-fg-muted)",
								fontSize: "0.875rem",
								textAlign: "center",
							}),
						]}
					>
						Each profile keeps its own list and its own place in every show.
					</p>
				</main>
			</div>
		);
	};
}
