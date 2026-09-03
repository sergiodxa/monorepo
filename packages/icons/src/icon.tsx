/**
 * A single component that renders any Lucide icon by name, for cases where
 * the icon isn't known until runtime (e.g. driven by CMS content or a config
 * value) and importing a specific `<XyzIcon>` isn't possible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { LucideProps } from "./create-lucide-icon.js";
import type { IconName } from "./icon-names.js";

import { createLucideIcon } from "./create-lucide-icon.js";
import { iconExportNames } from "./icon-names.js";
import * as registry from "./registry.js";

/**
 * Props accepted by `<Icon />`.
 */
export interface IconProps extends LucideProps {
	/** The Lucide icon to render, e.g. `"circle-alert"`. */
	name: IconName;
}

/**
 * Renders the Lucide icon matching `name`, resolving its node data from
 * `registry` via `iconExportNames` since kebab-case names can't be export
 * identifiers; `IconName` guarantees `name` names a real export at runtime.
 */
export function Icon({ props }: Handle<IconProps>) {
	return () => {
		let { name, ...rest } = props;
		// oxlint-disable-next-line import/namespace -- see above
		let IconComponent = createLucideIcon(name, registry[iconExportNames[name]]);
		return <IconComponent {...rest} />;
	};
}
