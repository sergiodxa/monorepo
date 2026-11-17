/**
 * Live preview for `ProfilePicker`: a household's four profiles in one form, each a submit
 * button posting to its own address, with the profile in use ringed. The avatars are drawn
 * gradient tiles standing in for each profile's picture.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { ProfilePicker } from "@sdxc/ui/app/profile-picker";

/** The source the page shows, matching the markup below apart from the drawn avatars. */
const CODE = `<form method="post">
	<ProfilePicker title="Who's watching?" footer="Each profile keeps its own list.">
		{profiles.map((profile) => (
			<ProfilePicker.Profile
				name={profile.name}
				avatar={<img src={profile.avatar} alt="" />}
				formAction={\`/profiles/\${profile.id}\`}
				current={profile.id === current}
			/>
		))}
	</ProfilePicker>
</form>`;

/** The household, each with the two hues its avatar blends. */
const PROFILES = [
	{ name: "Noa", hues: [50, 25] },
	{ name: "Theo", hues: [200, 240] },
	{ name: "Ines", hues: [320, 290] },
	{ name: "Kids", hues: [120, 150] },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			method="post"
			action="#profiles"
			mix={[raw({ inlineSize: "100%", paddingBlock: "1.5rem" })]}
		>
			<ProfilePicker title="Who's watching?" footer="Each profile keeps its own list.">
				{PROFILES.map((profile) => (
					<ProfilePicker.Profile
						name={profile.name}
						avatar={
							<span
								mix={[
									raw({
										background: `linear-gradient(145deg, oklch(0.74 0.15 ${profile.hues[0]}), oklch(0.52 0.17 ${profile.hues[1]}))`,
									}),
								]}
							/>
						}
						formAction={`#${profile.name.toLowerCase()}`}
						current={profile.name === "Theo"}
					/>
				))}
			</ProfilePicker>
		</form>
	),
};
