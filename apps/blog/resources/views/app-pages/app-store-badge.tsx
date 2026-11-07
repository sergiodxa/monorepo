/**
 * The download call an app's pages repeat. With a listing it is Apple's own "Download on the
 * App Store" badge, unaltered and in the page's language, as Apple's guidelines require; before
 * release it is a quiet outlined note that reads as a status, so nobody taps a dead link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { HourglassIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs, m, pi } from "@sdxc/u/size";
import { focusVisible } from "@sdxc/u/state";
import { leading, nowrap, text, weight } from "@sdxc/u/typography";

/** Where Apple's badge artwork is served from, one pair of files per badge language. */
export const APP_STORE_BADGES = "/apps/app-store";

/** The languages Apple publishes the badge in that the app pages use. */
export type BadgeLanguage = "en-us" | "es-mx" | "ja-jp";

/** Props of the badge. */
export interface AppStoreBadgeProps {
	/** The listing's URL, or `null` before release. */
	href: string | null;
	/**
	 * With a listing, the badge's alt text, "Download on the App Store" in the page's language;
	 * before release, the line above "App Store" in the note, "Coming soon to the".
	 */
	label: string;
	/** The badge artwork's language: Apple's Latin American Spanish badge serves Argentina. */
	language?: BadgeLanguage;
}

/**
 * The badge or the note, by whether the listing has a URL.
 *
 * @param handle Runtime handle carrying the listing URL and its label.
 * @returns The render function producing the badge or the note.
 */
export function AppStoreBadge(handle: Handle<AppStoreBadgeProps>) {
	return () => {
		let { href, label } = handle.props;

		if (!href) {
			return (
				<p
					data-app-store="coming-soon"
					mix={[
						hstack({ gap: 2.5, align: "center" }),
						bs(12),
						pi(5),
						m(0),
						rounded("full"),
						border({ width: 1, color: "brand" }),
						bg("brand.tint"),
						fg("brand.emphasis"),
					]}
				>
					<HourglassIcon size={18} aria-hidden="true" />
					<span mix={[vstack({ gap: 0, align: "start" })]}>
						<span mix={[text("xs"), leading("none")]}>{label}</span>
						<span mix={[text("base"), weight("semibold"), leading("tight"), nowrap()]}>
							App Store
						</span>
					</span>
				</p>
			);
		}

		let language = handle.props.language ?? "en-us";
		return (
			<a
				href={href}
				data-app-store="available"
				mix={[
					raw({ display: "inline-block", lineHeight: "0", borderRadius: "0.5rem" }),
					focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "3px" })),
				]}
			>
				<picture>
					<source
						media="(prefers-color-scheme: dark)"
						srcSet={`${APP_STORE_BADGES}/badge-${language}-white.svg`}
					/>
					<img
						src={`${APP_STORE_BADGES}/badge-${language}-black.svg`}
						alt={label}
						height={48}
						mix={[raw({ display: "block", blockSize: "3rem", inlineSize: "auto" })]}
					/>
				</picture>
			</a>
		);
	};
}
