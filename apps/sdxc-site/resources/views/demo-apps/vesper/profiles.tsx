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

import { KeyArt } from "./art";
import { PROFILES, TITLES, actionHref, visibleTitles } from "./data";
import { ProfileAvatar, VesperMark } from "./shell";

/** Renders the picker, the current profile marked. */
export default function WhoIsWatching(handle: Handle<{ viewer: Viewer }>) {
	return () => {
		let { viewer } = handle.props;
		return (
			<div
				mix={[
					raw({
						position: "relative",
						isolation: "isolate",
						flex: "1 1 auto",
						display: "grid",
						gridTemplateRows: "auto 1fr",
						minBlockSize: "100dvh",
						overflow: "clip",
						backgroundColor: "var(--ui-bg)",
					}),
				]}
			>
				<div
					aria-hidden="true"
					mix={[
						raw({
							position: "absolute",
							inset: "0",
							zIndex: "-1",
							opacity: "0.55",
							filter: "blur(3px) saturate(1.1)",
							scale: "1.03",
							"&::after": {
								content: '""',
								position: "absolute",
								inset: "0",
								background:
									"linear-gradient(to bottom, rgb(6 5 10 / 0.55), rgb(6 5 10 / 0.35) 40%, rgb(6 5 10 / 0.9))",
							},
						}),
					]}
				>
					<KeyArt title={visibleTitles(viewer.profile)[0] ?? TITLES[0]!} named={false} priority />
				</div>
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
					<form method="post" data-main-scroll-top="">
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
