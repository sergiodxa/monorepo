/**
 * Live preview for `LogoSentence`: three customer wordmarks set inline in a claim, the
 * compact proof line a landing puts under its hero.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { whiteSpace } from "@sdxc/u/typography";
import { LogoSentence } from "@sdxc/ui/patterns";

import { Wordmark } from "~/resources/components/demo-media";

/** The source the page shows, matching the markup below. */
const CODE = `<LogoSentence>
	Trusted by <span mix={[whiteSpace("nowrap")]}><img src={northwind} alt="Northwind" />,</span>{" "}
	<span mix={[whiteSpace("nowrap")]}><img src={voltage} alt="Voltage" />,</span>{" "}
	<img src={fernway} alt="Fernway" /> and 2,000 on-call teams.
</LogoSentence>`;

/** What the preview registry reads: the source to show, and the sentence to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<LogoSentence mix={[raw({ "--logo-scale": "1.35" })]}>
			Trusted by{" "}
			<span mix={[whiteSpace("nowrap")]}>
				<Wordmark name="Northwind" glyph="ring" />,
			</span>{" "}
			<span mix={[whiteSpace("nowrap")]}>
				<Wordmark name="Voltage" glyph="bolt" />,
			</span>{" "}
			<Wordmark name="Fernway" glyph="leaf" /> and 2,000 on-call teams.
		</LogoSentence>
	),
};
