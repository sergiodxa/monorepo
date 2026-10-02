/**
 * Live preview island for `Command`. The panel draws the palette and marks its input,
 * rows and empty state, and every row stays a reachable button before any script runs.
 * Narrowing the list and moving the active match are the consumer's, so the preview
 * carries the same `commandFilter(model)` and `commandKeys(model)` wiring a reader would
 * write, against one `FilterModel` shared by both: typing hides the rows that do not
 * match, the arrow keys move the active one, and Enter presses the button it nests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	ExternalLinkIcon,
	FilePlusIcon,
	GitBranchIcon,
	MoonIcon,
	RocketIcon,
	SettingsIcon,
	TerminalIcon,
	UsersIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { text, textAlign } from "@sdxc/u/typography";
import { Command, Keyboard } from "@sdxc/ui";
import { FilterModel } from "@sdxc/ui/behaviors";
import { commandFilter, commandKeys } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** Every action the palette offers, in the order a workspace lists them. */
const ACTIONS = [
	{ id: "new-doc", label: "New document", hint: "⌘N", icon: "doc" },
	{ id: "new-branch", label: "New branch from main", hint: "⌘⇧B", icon: "branch" },
	{ id: "invite", label: "Invite a teammate", hint: "", icon: "people" },
	{ id: "deploy", label: "Deploy to production", hint: "⌘⇧D", icon: "rocket" },
	{ id: "logs", label: "Open deploy logs", hint: "", icon: "terminal" },
	{ id: "settings", label: "Workspace settings", hint: "⌘,", icon: "settings" },
	{ id: "theme", label: "Switch to dark theme", hint: "", icon: "moon" },
	{ id: "status", label: "Open status page", hint: "", icon: "external" },
];

/** The glyph one action carries, so a row reads at a glance rather than by its text alone. */
function actionIcon(icon: string) {
	if (icon === "doc") return <FilePlusIcon size={16} aria-hidden="true" />;
	if (icon === "branch") return <GitBranchIcon size={16} aria-hidden="true" />;
	if (icon === "people") return <UsersIcon size={16} aria-hidden="true" />;
	if (icon === "rocket") return <RocketIcon size={16} aria-hidden="true" />;
	if (icon === "terminal") return <TerminalIcon size={16} aria-hidden="true" />;
	if (icon === "settings") return <SettingsIcon size={16} aria-hidden="true" />;
	if (icon === "moon") return <MoonIcon size={16} aria-hidden="true" />;
	return <ExternalLinkIcon size={16} aria-hidden="true" />;
}

/** The source the page shows, matching the markup below. */
const CODE = `let model = new FilterModel();
let ran: string | null = null;

<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("26rem")]}>
	<Command
		aria-label="Workspace commands"
		mix={[commandFilter(model), commandKeys(model)]}
	>
		<Command.Input
			type="search"
			aria-label="Workspace commands"
			placeholder="Type a command or search…"
		/>

		<Command.List>
			{ACTIONS.map((action) => (
				<Command.Item key={action.id} id={\`preview-command-\${action.id}\`} value={action.label}>
					<button
						type="button"
						mix={[
							hstack({ gap: 3, align: "center" }),
							is("100%"),
							on<HTMLButtonElement, "click">("click", () => {
								ran = action.label;
								void handle.update();
							}),
						]}
					>
						{actionIcon(action.icon)}
						<span mix={[is("100%"), textAlign("start"), text("sm")]}>{action.label}</span>
						{action.hint ? <Keyboard>{action.hint}</Keyboard> : null}
					</button>
				</Command.Item>
			))}
		</Command.List>

		<Command.Empty>No command matches that.</Command.Empty>
	</Command>

	<p mix={[text("sm"), fg("neutral")]}>
		{ran === null ? "Arrow keys move the active row; Enter runs it." : \`Ran: \${ran}\`}
	</p>
</div>`;

/** A workspace palette that narrows as you type, hydrated so the query and arrow keys drive it. */
export const CommandPreview = clientEntry(
	"/resources/components/previews/command.tsx#CommandPreview",
	function CommandPreview(handle: Handle) {
		let model = new FilterModel();
		let ran: string | null = null;

		return () => (
			<div mix={[vstack({ gap: 2, align: "stretch" }), is("100%"), maxIs("26rem")]}>
				<Command aria-label="Workspace commands" mix={[commandFilter(model), commandKeys(model)]}>
					<Command.Input
						type="search"
						aria-label="Workspace commands"
						placeholder="Type a command or search…"
					/>

					<Command.List>
						{ACTIONS.map((action) => (
							<Command.Item
								key={action.id}
								id={`preview-command-${action.id}`}
								value={action.label}
							>
								<button
									type="button"
									mix={[
										hstack({ gap: 3, align: "center" }),
										is("100%"),
										on<HTMLButtonElement, "click">("click", () => {
											ran = action.label;
											void handle.update();
										}),
									]}
								>
									{actionIcon(action.icon)}
									<span mix={[is("100%"), textAlign("start"), text("sm")]}>{action.label}</span>
									{action.hint ? <Keyboard>{action.hint}</Keyboard> : null}
								</button>
							</Command.Item>
						))}
					</Command.List>

					<Command.Empty>No command matches that.</Command.Empty>
				</Command>

				<p mix={[text("sm"), fg("neutral")]}>
					{ran === null ? "Arrow keys move the active row; Enter runs it." : `Ran: ${ran}`}
				</p>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <CommandPreview /> };
