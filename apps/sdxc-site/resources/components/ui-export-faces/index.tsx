/**
 * Dispatches one `@sdxc/ui` export catalogue tile to the face that matches its
 * subpath — live animation, style wireframe, mixin schematic, or behavior
 * diagram — so the landing stays one grid of cards with different insides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import type { UiSubpath } from "~/app/services/ui-subpaths";

import AnimationFace from "~/resources/components/ui-export-faces/animations";
import BehaviorFace from "~/resources/components/ui-export-faces/behaviors";
import MixinFace from "~/resources/components/ui-export-faces/mixins";
import StyleFace from "~/resources/components/ui-export-faces/styles";

namespace UiExportMiniature {
	export interface Props {
		subpath: UiSubpath;
		name: string;
	}
}

/** Renders the miniature for one export on the `@sdxc/ui` landing. */
export default function UiExportMiniature(handle: Handle<UiExportMiniature.Props>) {
	return () => {
		let { name, subpath } = handle.props;

		switch (subpath) {
			case "animations":
				return <AnimationFace name={name} />;
			case "styles":
				return <StyleFace name={name} />;
			case "mixins":
				return <MixinFace name={name} />;
			case "behaviors":
				return <BehaviorFace name={name} />;
		}
	};
}
