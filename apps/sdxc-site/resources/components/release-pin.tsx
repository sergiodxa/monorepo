/**
 * The `latest-release` tag: a pin naming the newest dated release and linking to its
 * notes, so the landing page says the collection is alive in the version a reader
 * would pin. The page reads the release per request and binds it here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixOptions } from "@sdxc/markdown/remix";
import type { Handle } from "remix/component";

import { ArrowRightIcon } from "@sdxc/icons";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import type { Release } from "~/app/services/changelog";
import type { MarkdownProps } from "~/resources/components/markdown-props";

import routes from "~/routes/web";

namespace ReleasePin {
	export interface Props {
		release: Release;
	}
}

/**
 * Renders the pin as one link to the release's entry in the changelog. The version is
 * the release's date, so it is the only date the pin shows, set in mono as a reader
 * copies it into a manifest.
 */
export default function ReleasePin(handle: Handle<ReleasePin.Props>) {
	return () => {
		let { release } = handle.props;
		return (
			<a
				href={`${routes.docs.changelog.href()}#${release.version}`}
				mix={[
					hstack({ gap: 2, align: "center" }),
					raw({ alignSelf: "flex-start", minBlockSize: "2rem" }),
					p(1, 3),
					rounded("full"),
					bg("brand.tint"),
					border({ color: "brand.border", width: 1, style: "solid" }),
					text("sm"),
					fg("brand"),
					transition("background-color"),
					when("&:hover", bg("brand.tint-hover")),
					when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
					when("& svg", motionSafe(transition("translate"))),
					when("&:hover svg", raw({ translate: "0.125rem 0" })),
				]}
			>
				<span mix={[weight("medium")]}>Latest release</span>
				<time dateTime={release.publishedAt} mix={[font("mono"), text("xs")]}>
					{release.version}
				</time>
				<ArrowRightIcon size={14} aria-hidden="true" />
			</a>
		);
	};
}

/**
 * The `latest-release` tag for one request, bound to the newest release. With none read,
 * the tag renders nothing and the hero closes up around it.
 *
 * @param release The newest dated release, or `undefined` when none could be read.
 * @returns The tag's component, to spread over the page's component map.
 */
export function releaseTags(release: Release | undefined): NonNullable<RemixOptions["components"]> {
	return {
		"latest-release": function LatestRelease(_handle: Handle<MarkdownProps>) {
			return () => (release ? <ReleasePin release={release} /> : null);
		},
	};
}
