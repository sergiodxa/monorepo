/**
 * Live preview for `Letterbox`: one 16:9 slide in a tall box and in a wide one. The slide keeps
 * its shape in both, barred where the box has room to spare, and its type, sized in container
 * units, scales with the slide.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flexWrap, hstack } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { Letterbox } from "@sdxc/ui/letterbox";
import { css } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[hstack({ gap: 5, align: "start" }), flexWrap()]}>
	<div mix={[is("12rem"), bs("12rem")]}>
		<Letterbox>
			<Letterbox.Surface
				mix={css({ display: "grid", placeItems: "center", background: "#4f46e5", color: "#fff", fontSize: "12cqh" })}
			>
				Q3 review
			</Letterbox.Surface>
		</Letterbox>
	</div>
	<div mix={[is("20rem"), bs("8rem")]}>
		<Letterbox>
			<Letterbox.Surface
				mix={css({ display: "grid", placeItems: "center", background: "#4f46e5", color: "#fff", fontSize: "12cqh" })}
			>
				Q3 review
			</Letterbox.Surface>
		</Letterbox>
	</div>
</div>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 5, align: "start" }), flexWrap()]}>
			<div mix={[is("12rem"), bs("12rem")]}>
				<Letterbox>
					<Letterbox.Surface
						mix={css({
							display: "grid",
							placeItems: "center",
							background: "#4f46e5",
							color: "#fff",
							fontSize: "12cqh",
						})}
					>
						Q3 review
					</Letterbox.Surface>
				</Letterbox>
			</div>
			<div mix={[is("20rem"), bs("8rem")]}>
				<Letterbox>
					<Letterbox.Surface
						mix={css({
							display: "grid",
							placeItems: "center",
							background: "#4f46e5",
							color: "#fff",
							fontSize: "12cqh",
						})}
					>
						Q3 review
					</Letterbox.Surface>
				</Letterbox>
			</div>
		</div>
	),
};
