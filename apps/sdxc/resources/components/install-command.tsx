/**
 * The `install-command` tag: one authored npm command, offered in each package
 * manager's dialect. The strip is a radio group, so the reader switches dialects and
 * copies the one on screen with no script; the dialect they chose arrives with the
 * request, so the server renders the strip already on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { cursor, raw } from "@sdxc/u/general";
import { basis, flex, flexWrap, gap, hidden, items, justify } from "@sdxc/u/layout";
import { overflow, overflowX } from "@sdxc/u/overflow";
import { minIs, p } from "@sdxc/u/size";
import { precededBy } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import type { OptionGroupName } from "~/app/services/option-groups";
import type { MarkdownProps } from "~/resources/components/markdown-props";

import { installVariants, MANAGERS } from "~/app/services/install-command";
import { selectedOption } from "~/app/services/option-groups";
import { CopyButton } from "~/resources/components/copy-button";
import OptionGroupScope, { OptionGroupSync } from "~/resources/components/option-groups";
import { stableId } from "~/resources/components/stable-id";

/** Shared by every radio inside one strip, which the form owner scopes to that strip. */
const RADIO_GROUP = "install-manager";

/** The axis every install strip on the site reads from, and writes back to. */
const GROUP: OptionGroupName = "package-manager";

namespace InstallCommand {
	export interface Props extends MarkdownProps {
		/** The command as authored, written in npm's dialect. */
		command: string;
	}
}

/** Renders the strip and the command line the selected dialect spells. */
export default function InstallCommand(handle: Handle<InstallCommand.Props>) {
	return () => {
		let variants = installVariants(handle.props.command);
		let selected = selectedOption(handle.context.get(OptionGroupScope), GROUP);

		return (
			<form
				aria-label="Install command"
				data-option-group={GROUP}
				mix={[
					flex(),
					flexWrap("wrap"),
					overflow("hidden"),
					rounded("lg"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					bg(),
				]}
			>
				{MANAGERS.map((manager) => {
					let inputId = stableId("install", `${handle.props.command} ${manager}`);
					let valueId = `${inputId}-value`;

					return (
						<div key={manager} mix={[raw({ display: "contents" })]}>
							<input
								type="radio"
								name={RADIO_GROUP}
								id={inputId}
								value={manager}
								data-option-value={manager}
								defaultChecked={manager === selected}
								mix={[visuallyHidden()]}
							/>
							<label
								htmlFor={inputId}
								mix={[
									raw({ order: -1 }),
									p(2, 3),
									fg("neutral"),
									text("sm"),
									weight("medium"),
									cursor("pointer"),
									borderEdge("block-end", { color: "transparent", width: 2, style: "solid" }),
									transition("color, border-color"),
									precededBy("input:checked", [
										fg("brand"),
										borderEdge("block-end", { color: "brand", width: 2, style: "solid" }),
									]),
									precededBy("input:focus-visible", outline({ color: "brand.ring", offset: -2 })),
								]}
							>
								{manager}
							</label>
							<div
								mix={[
									basis("100%"),
									hidden(),
									items("center"),
									justify("between"),
									gap(3),
									p(2, 2, 2, 3),
									borderEdge("block-start", {
										color: "neutral.border",
										width: 1,
										style: "solid",
									}),
									precededBy("input:checked", raw({ display: "flex" })),
								]}
							>
								<code
									id={valueId}
									mix={[
										font("mono"),
										text("sm"),
										fg("neutral.emphasis"),
										minIs(0),
										overflowX("auto"),
									]}
								>
									{variants[manager]}
								</code>
								<CopyButton target={valueId} bare />
							</div>
						</div>
					);
				})}

				<OptionGroupSync group={GROUP} />
			</form>
		);
	};
}
