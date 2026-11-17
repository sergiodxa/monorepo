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
import { ProfilePicker } from "@sdxc/ui/app/profile-picker";

import type { Viewer } from "./state";

import { PROFILES, actionHref } from "./data";
import { ProfileAvatar, VesperMark } from "./shell";

/** Renders the picker, the current profile marked. */
export default function WhoIsWatching(handle: Handle<{ viewer: Viewer }>) {
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
							paddingBlockEnd: "12vh",
						}),
					]}
				>
					<form method="post">
						<ProfilePicker
							title="Who's watching?"
							footer="Each profile keeps its own list and its own place in every show."
						>
							{PROFILES.map((profile) => (
								<ProfilePicker.Profile
									name={profile.name}
									avatar={<ProfileAvatar profile={profile} size="fill" />}
									formAction={actionHref(`profiles/${profile.id}`)}
									current={viewer.picked && profile.id === viewer.profile.id}
								/>
							))}
						</ProfilePicker>
					</form>
				</main>
			</div>
		);
	};
}
