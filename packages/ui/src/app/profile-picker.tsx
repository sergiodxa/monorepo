/**
 * The "who is using this?" screen of an account several people share: a question and a grid of
 * large avatars, each one a button that picks that profile. It renders inside the page's own
 * form, so each pick is a plain post that works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** Container the picker declares, which its grid sets its columns from. */
const CONTAINER = "ui-profile-picker";

/** Prop types for {@link ProfilePicker} and {@link ProfilePicker.Profile}. */
export namespace ProfilePicker {
	/** Every native `<section>` attribute, plus the question it asks. */
	export interface Props extends Omit<TagProps<"section">, "title"> {
		/** The question, such as "Who's watching?", which names the section. */
		title: RemixNode;
		/** A line under the grid, such as what a profile keeps apart. */
		footer?: RemixNode;
		/** {@link ProfilePicker.Profile} elements. */
		children: RemixNode;
	}

	/** Every native `<button>` attribute but `children`, plus the profile it picks. */
	export interface ProfileProps extends Omit<TagProps<"button">, "children" | "name"> {
		/** The profile's name, the button's text. */
		name: string;
		/** The profile's picture, drawn square at the button's width. */
		avatar: RemixNode;
		/** Where the pick posts, for a form holding every profile; see `formaction`. */
		formAction?: string;
		/** Marks the profile in use with `aria-current`. */
		current?: boolean;
	}
}

/**
 * Renders the picker centred on the page: the question as its heading, then two profiles to a
 * row on a phone and up to five on a wider screen.
 *
 * @example
 * <form method="post">
 * 	<ProfilePicker title="Who's watching?">
 * 		<ProfilePicker.Profile name="Noa" avatar={<Avatar />} formAction="/profiles/noa" />
 * 	</ProfilePicker>
 * </form>
 */
export function ProfilePicker(handle: Handle<ProfilePicker.Props>) {
	return () => {
		let { children, footer, mix, title, ...rest } = handle.props;
		return (
			<section
				{...rest}
				data-slot="profile-picker"
				mix={mergeMix(
					[
						raw({
							containerName: CONTAINER,
							containerType: "inline-size",
							display: "grid",
							justifyItems: "center",
							gap: "2.5rem",
							paddingInline: "1rem",
							textAlign: "center",
						}),
					],
					mix,
				)}
			>
				<h1
					mix={[
						raw({
							margin: "0",
							fontSize: "clamp(1.75rem, 6cqi, 3rem)",
							fontWeight: "600",
							letterSpacing: "-0.02em",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{title}
				</h1>
				<ul
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(2, minmax(0, 8.5rem))",
							gap: "1.75rem clamp(1rem, 4cqi, 2.5rem)",
							margin: "0",
							padding: "0",
							listStyle: "none",
							[`@container ${CONTAINER} (min-width: 40rem)`]: {
								gridTemplateColumns: "repeat(auto-fit, minmax(0, 9.5rem))",
								justifyContent: "center",
								inlineSize: "100%",
								maxInlineSize: "60rem",
							},
						}),
					]}
				>
					{children}
				</ul>
				{footer === undefined ? null : (
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "0.875rem",
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{footer}
					</p>
				)}
			</section>
		);
	};
}

/**
 * One profile: its avatar and name as a submit button. It rises a little and rings under the
 * pointer, held still under reduced motion; the profile in use carries a ring at rest.
 */
ProfilePicker.Profile = function ProfilePickerProfile(handle: Handle<ProfilePicker.ProfileProps>) {
	return () => {
		let { avatar, current = false, formAction, mix, name, ...rest } = handle.props;
		return (
			<li>
				<button
					type="submit"
					{...rest}
					formaction={formAction}
					aria-current={current ? "true" : undefined}
					data-slot="profile-picker-profile"
					mix={mergeMix(
						[
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
							}),
							when("&:hover", raw({ color: "var(--ui-neutral-fg-emphasis)" })),
							when("&:focus-visible", raw({ outline: "none" })),
						],
						mix,
					)}
				>
					<span
						data-slot="profile-picker-avatar"
						mix={[
							raw({
								display: "grid",
								inlineSize: "100%",
								aspectRatio: "1",
								overflow: "clip",
								borderRadius: "var(--ui-profile-picker-radius, 1rem)",
								transition: "box-shadow 160ms ease, translate 160ms ease",
								"& > *": { inlineSize: "100%", blockSize: "100%" },
								"[aria-current] > &": {
									boxShadow: "0 0 0 3px var(--ui-brand-bg-solid)",
								},
								":hover > &": { boxShadow: "0 0 0 3px var(--ui-neutral-fg-emphasis)" },
								":focus-visible > &": { boxShadow: "0 0 0 3px var(--ui-brand-ring)" },
							}),
							motionSafe(raw({ ":hover > &": { translate: "0 -3px" } })),
						]}
					>
						{avatar}
					</span>
					<span>{name}</span>
				</button>
			</li>
		);
	};
};
