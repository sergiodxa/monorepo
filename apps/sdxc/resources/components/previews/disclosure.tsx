/**
 * Live preview island for `Disclosure`. A `<details>` element expands and collapses with
 * no script, so the section opens before hydration; what the island adds is the control
 * that only script can offer, putting every override in the panel back to the value the
 * build would use if the section had never been opened.
 *
 * The frame around the section reserves the height the open panel needs, so expanding and
 * collapsing moves nothing outside it — the same thing a settings page does by giving the
 * section a row of its own rather than letting the page reflow under the reader.
 *
 * The chevron is what says the row can be opened at all. It is passed rather than assumed,
 * carrying `data-slot="icon"` so the section turns it over while it is open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { grow, hstack, vstack } from "@sdxc/u/layout";
import { is, minBs } from "@sdxc/u/size";
import { Button, Description, Disclosure, Input, Label, Switch } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** What the build runs with when nothing in the section has been overridden. */
const BUILD_DEFAULTS = { command: "npm run build", output: "dist", install: "npm ci" };

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const DISCLOSURE_CODE = `let settings = { ...BUILD_DEFAULTS };

function editSetting(field: keyof typeof BUILD_DEFAULTS) {
	return on<HTMLInputElement, "input">("input", (event) => {
		settings[field] = event.currentTarget.value;
		void handle.update();
	});
}

function resetDefaults() {
	settings = { ...BUILD_DEFAULTS };
	void handle.update();
}

<Disclosure open>
	<Disclosure.Trigger>
		<Disclosure.Header mix={[grow()]}>Advanced build settings</Disclosure.Header>
		<ChevronDownIcon data-slot="icon" aria-hidden="true" />
	</Disclosure.Trigger>
	<Disclosure.Panel>
		<Description>
			Overrides apply to this project only. Leave them alone to keep the detected defaults.
		</Description>

		<Label htmlFor="buildCommand">Build command</Label>
		<Input id="buildCommand" name="buildCommand" value={settings.command} mix={[editSetting("command")]} />

		<Label htmlFor="outputDirectory">Output directory</Label>
		<Input id="outputDirectory" name="outputDirectory" value={settings.output} mix={[editSetting("output")]} />

		<Label htmlFor="installCommand">Install command</Label>
		<Input id="installCommand" name="installCommand" value={settings.install} mix={[editSetting("install")]} />

		<Switch name="buildCache" defaultChecked>Reuse the build cache between deploys</Switch>

		<Button
			variant="outline"
			color="neutral"
			size="sm"
			mix={[on<HTMLButtonElement, "click">("click", resetDefaults)]}
		>
			Reset to defaults
		</Button>
	</Disclosure.Panel>
</Disclosure>`;

/** A project's build overrides, hydrated so the section can be put back to its defaults. */
export const DisclosurePreview = clientEntry(
	"/resources/components/previews/disclosure.tsx#DisclosurePreview",
	function DisclosurePreview(handle: Handle) {
		let settings = { ...BUILD_DEFAULTS };

		/** Keeps one override current, so the reset below has something to undo. */
		function editSetting(field: keyof typeof BUILD_DEFAULTS) {
			return on<HTMLInputElement, "input">("input", (event) => {
				settings[field] = event.currentTarget.value;
				void handle.update();
			});
		}

		/** Puts every override back to the value the build detects on its own. */
		function resetDefaults() {
			settings = { ...BUILD_DEFAULTS };
			void handle.update();
		}

		return () => (
			<div mix={[is("28rem"), minBs("24rem")]}>
				<Disclosure open>
					<Disclosure.Trigger>
						<Disclosure.Header mix={[grow()]}>Advanced build settings</Disclosure.Header>
						<ChevronDownIcon data-slot="icon" aria-hidden="true" />
					</Disclosure.Trigger>
					<Disclosure.Panel>
						<div mix={[vstack({ gap: 3, align: "stretch" })]}>
							<Description>
								Overrides apply to this project only. Leave them alone to keep the detected
								defaults.
							</Description>

							<div mix={[vstack({ gap: 1, align: "stretch" })]}>
								<Label htmlFor="preview-build-command">Build command</Label>
								<Input
									id="preview-build-command"
									name="buildCommand"
									value={settings.command}
									mix={[editSetting("command")]}
								/>
							</div>

							<div mix={[vstack({ gap: 1, align: "stretch" })]}>
								<Label htmlFor="preview-build-output">Output directory</Label>
								<Input
									id="preview-build-output"
									name="outputDirectory"
									value={settings.output}
									mix={[editSetting("output")]}
								/>
							</div>

							<div mix={[vstack({ gap: 1, align: "stretch" })]}>
								<Label htmlFor="preview-build-install">Install command</Label>
								<Input
									id="preview-build-install"
									name="installCommand"
									value={settings.install}
									mix={[editSetting("install")]}
								/>
							</div>

							<Switch name="buildCache" defaultChecked>
								Reuse the build cache between deploys
							</Switch>

							<div mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
								<Button
									variant="outline"
									color="neutral"
									size="sm"
									mix={[on<HTMLButtonElement, "click">("click", resetDefaults)]}
								>
									Reset to defaults
								</Button>
							</div>
						</div>
					</Disclosure.Panel>
				</Disclosure>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DISCLOSURE_CODE, render: () => <DisclosurePreview /> };
