/**
 * Plumb's install line: one command per package manager behind radio tabs, each with a
 * button that copies exactly the command it sits beside. The tabs switch with CSS and the
 * command stays selectable text, so the line works before the copy button's script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { CopyButton } from "@sdxc/ui/docs";
import { InstallTabs } from "@sdxc/ui/landing";

import { INSTALL } from "~/resources/views/demos/library/data";

namespace InstallLine {
	export interface Props {
		/** The radio group's name, unique on the page, so two lines switch independently. */
		name: string;
	}
}

/**
 * Renders the line, npm first. The strip is capped at a width that holds the longest
 * command beside its button, so it sits as one object in the hero's copy column.
 *
 * @param handle Runtime handle carrying the group's name.
 * @returns The render function producing the line.
 */
export function InstallLine(handle: Handle<InstallLine.Props>) {
	return () => {
		let { name } = handle.props;
		return (
			<InstallTabs
				name={name}
				aria-label="Install plumb with your package manager"
				mix={[raw({ inlineSize: "100%", maxInlineSize: "26rem" })]}
			>
				{INSTALL.map((option, index) => (
					<InstallTabs.Option
						key={option.value}
						value={option.value}
						label={option.value}
						defaultChecked={index === 0}
						actions={
							<CopyButton
								target={`${name}-${option.value}-value`}
								label={`Copy the ${option.value} command`}
								copiedLabel="Copied"
							/>
						}
					>
						{option.command}
					</InstallTabs.Option>
				))}
			</InstallTabs>
		);
	};
}
