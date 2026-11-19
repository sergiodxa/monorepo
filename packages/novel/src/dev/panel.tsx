/**
 * `NovelDevTools`: the developer tools panel. Each tool is a native disclosure over a
 * `DevTools` connection: the play's position and state, a jump with edited state, persistent
 * data and its reset, the scene graph as a flowchart, the event log, and the static problems.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { Diagram } from "@sdxc/diagram/ui";
import { Button, Disclosure, Select, TextArea } from "@sdxc/ui";
import { css, on } from "remix/component";

import type { DevEvent, DevProblems, DevTools } from "./devtools.js";

import { toMermaid } from "./graph.js";

export namespace NovelDevTools {
	/** Props {@link NovelDevTools} accepts. */
	export interface Props extends Omit<TagProps<"aside">, "children"> {
		devtools: DevTools;
	}
}

/** Props every tool section receives. */
interface SectionProps {
	devtools: DevTools;
}

/**
 * The panel. It renders again on every event the connection logs, so the state and the log
 * follow the play as it runs; the flowchart and the problems load on request, since reading
 * them imports every lazy scene.
 *
 * @example <NovelDevTools devtools={devtools} />
 */
export function NovelDevTools(handle: Handle<NovelDevTools.Props>) {
	let unsubscribe = handle.props.devtools.subscribe(() => void handle.update());
	handle.signal.addEventListener("abort", unsubscribe);
	return () => {
		let { devtools, mix, ...rest } = handle.props;
		return (
			<aside
				aria-label="Novel developer tools"
				{...rest}
				mix={[
					css({
						display: "grid",
						gap: "4px",
						alignContent: "start",
						padding: "8px",
						fontSize: "13px",
						colorScheme: "light dark",
						"& pre": {
							margin: 0,
							maxBlockSize: "16rem",
							overflow: "auto",
							fontSize: "12px",
							whiteSpace: "pre-wrap",
							overflowWrap: "anywhere",
						},
					}),
					...(mix === undefined ? [] : [mix].flat()),
				]}
			>
				<PlaySection devtools={devtools} />
				<JumpSection devtools={devtools} />
				<PersistentSection devtools={devtools} />
				<FlowchartSection devtools={devtools} />
				<EventsSection devtools={devtools} />
				<ProblemsSection devtools={devtools} />
			</aside>
		);
	};
}

/** Where the followed play stands and its story state. */
function PlaySection(handle: Handle<SectionProps>) {
	return () => {
		let game = handle.props.devtools.state;
		return (
			<Disclosure open>
				<Disclosure.Trigger>Play</Disclosure.Trigger>
				<Disclosure.Panel>
					{game === undefined ? (
						<p>Waiting for the play to reach a line.</p>
					) : (
						<div mix={css({ display: "grid", gap: "4px" })}>
							<p data-testid="position">
								{game.position.scene} · {game.position.line}
							</p>
							{game.stack.length > 0 ? (
								<p>Called from {game.stack.map((entry) => entry.scene).join(" › ")}</p>
							) : null}
							<pre aria-label="Story state">{JSON.stringify(game.state, null, 2)}</pre>
						</div>
					)}
				</Disclosure.Panel>
			</Disclosure>
		);
	};
}

/**
 * Starts any mapped scene with state edited as JSON. The editor holds the reader's edit until a
 * jump succeeds; until then, and after, it shows the play's current state.
 */
function JumpSection(handle: Handle<SectionProps>) {
	let draft: string | undefined;
	let error: string | undefined;
	return () => {
		let { devtools } = handle.props;
		let current = devtools.state;
		let text = draft ?? JSON.stringify(current?.state ?? {}, null, 2);
		return (
			<Disclosure>
				<Disclosure.Trigger>Jump</Disclosure.Trigger>
				<Disclosure.Panel>
					<form
						mix={[
							css({ display: "grid", gap: "8px" }),
							on("submit", (event) => {
								event.preventDefault();
								let data = new FormData(event.currentTarget);
								let state: unknown;
								try {
									state = JSON.parse(fieldOf(data, "state"));
								} catch (caught) {
									error = `The state is not JSON: ${caught instanceof Error ? caught.message : String(caught)}`;
									void handle.update();
									return;
								}
								let jumped = devtools.jump(fieldOf(data, "scene"), state);
								error = jumped.status === "failure" ? jumped.error.message : undefined;
								if (jumped.status === "success") draft = undefined;
								void handle.update();
							}),
						]}
					>
						<label htmlFor={`${handle.id}-scene`} mix={css({ display: "grid", gap: "4px" })}>
							Scene
							<Select id={`${handle.id}-scene`} name="scene">
								{devtools.scenes.map((name) => (
									<Select.Option value={name} selected={name === current?.position.scene}>
										{name}
									</Select.Option>
								))}
							</Select>
						</label>
						<label htmlFor={`${handle.id}-state`} mix={css({ display: "grid", gap: "4px" })}>
							State
							<TextArea
								id={`${handle.id}-state`}
								name="state"
								rows={8}
								spellcheck={false}
								value={text}
								aria-invalid={error === undefined ? undefined : "true"}
								mix={[
									css({ fontFamily: "ui-monospace, monospace", fontSize: "12px" }),
									on("input", (event) => {
										draft = event.currentTarget.value;
										void handle.update();
									}),
								]}
							/>
						</label>
						{error === undefined ? null : <p role="alert">{error}</p>}
						<Button type="submit" size="sm">
							Jump to scene
						</Button>
					</form>
				</Disclosure.Panel>
			</Disclosure>
		);
	};
}

/** Persistent data, with buttons that clear seen lines and unlocks. */
function PersistentSection(handle: Handle<SectionProps>) {
	return () => {
		let { devtools } = handle.props;
		let persistent = devtools.persistent;
		return (
			<Disclosure>
				<Disclosure.Trigger>Persistent</Disclosure.Trigger>
				<Disclosure.Panel>
					{persistent === undefined ? (
						<p>Waiting for the play to reach a line.</p>
					) : (
						<div mix={css({ display: "grid", gap: "8px" })}>
							<pre aria-label="Persistent data">{JSON.stringify(persistent, null, 2)}</pre>
							<div mix={css({ display: "flex", flexWrap: "wrap", gap: "4px" })}>
								<Button
									type="button"
									size="sm"
									variant="outline"
									mix={on("click", () => void devtools.reset({ seen: true }))}
								>
									Reset seen lines
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									mix={on("click", () => void devtools.reset({ unlocked: true }))}
								>
									Reset unlocks
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									color="danger"
									mix={on("click", () => void devtools.reset())}
								>
									Reset everything
								</Button>
							</div>
						</div>
					)}
				</Disclosure.Panel>
			</Disclosure>
		);
	};
}

/** The scene graph, drawn on request since reading it imports every lazy scene. */
function FlowchartSection(handle: Handle<SectionProps>) {
	let source: string | undefined;
	return () => (
		<Disclosure>
			<Disclosure.Trigger>Flowchart</Disclosure.Trigger>
			<Disclosure.Panel>
				<div mix={css({ display: "grid", gap: "8px", "& svg": { maxInlineSize: "100%" } })}>
					<Button
						type="button"
						size="sm"
						variant="outline"
						mix={on("click", async (_event, signal) => {
							let graph = await handle.props.devtools.graph();
							if (signal.aborted) return;
							source = toMermaid(graph);
							void handle.update();
						})}
					>
						{source === undefined ? "Draw the scene graph" : "Draw it again"}
					</Button>
					{source === undefined ? null : <Diagram source={source} alt="Scene graph" />}
				</div>
			</Disclosure.Panel>
		</Disclosure>
	);
}

/** The event log, newest first. */
function EventsSection(handle: Handle<SectionProps>) {
	return () => {
		let { devtools } = handle.props;
		let events = [...devtools.events].reverse();
		return (
			<Disclosure>
				<Disclosure.Trigger>Events ({devtools.events.length})</Disclosure.Trigger>
				<Disclosure.Panel>
					<div mix={css({ display: "grid", gap: "8px" })}>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							mix={on("click", () => devtools.clear())}
						>
							Clear the log
						</Button>
						<ol
							aria-label="Event log"
							mix={css({
								margin: 0,
								padding: 0,
								listStyle: "none",
								maxBlockSize: "16rem",
								overflow: "auto",
								fontFamily: "ui-monospace, monospace",
								fontSize: "12px",
							})}
						>
							{events.map((event) => (
								<li key={String(event.id)} data-type={event.type}>
									<strong>{event.type}</strong> {describeEvent(event)}
								</li>
							))}
						</ol>
					</div>
				</Disclosure.Panel>
			</Disclosure>
		);
	};
}

/** `check()`'s problems and the missing messages, read on request. */
function ProblemsSection(handle: Handle<SectionProps>) {
	let problems: DevProblems | undefined;
	return () => (
		<Disclosure>
			<Disclosure.Trigger>Problems</Disclosure.Trigger>
			<Disclosure.Panel>
				<div mix={css({ display: "grid", gap: "8px" })}>
					<Button
						type="button"
						size="sm"
						variant="outline"
						mix={on("click", async (_event, signal) => {
							let found = await handle.props.devtools.problems();
							if (signal.aborted) return;
							problems = found;
							void handle.update();
						})}
					>
						Run the checks
					</Button>
					{problems === undefined ? null : (
						<ul aria-label="Problems" mix={css({ margin: 0, paddingInlineStart: "16px" })}>
							{problems.check.problems.length === 0 && problems.messages.length === 0 ? (
								<li>No problems found.</li>
							) : null}
							{problems.check.problems.map((problem) => (
								<li data-severity={problem.severity}>
									{problem.severity} {problem.code} in {problem.scene}
									{"asset" in problem ? `: ${problem.asset}` : ""}
									{"target" in problem ? `: ${problem.target}` : ""}
									{"key" in problem ? `: ${problem.key}` : ""}
								</li>
							))}
							{problems.messages.map((message) => (
								<li data-severity="error">
									missing-message {message.key} in {message.locale}
									{message.scene === undefined ? "" : ` (${message.scene})`}
								</li>
							))}
						</ul>
					)}
				</div>
			</Disclosure.Panel>
		</Disclosure>
	);
}

/**
 * Reads a text field from a submitted form.
 *
 * @param data - The form's data.
 * @param name - The field's name.
 * @returns The field's text, or an empty string when it is missing or a file.
 */
function fieldOf(data: FormData, name: string): string {
	let value = data.get(name);
	return typeof value === "string" ? value : "";
}

/**
 * One line summing up an event's payload.
 *
 * @param event - A logged event.
 * @returns What happened, such as `prologue.opening:opening.hello` for a line.
 */
export function describeEvent(event: DevEvent): string {
	switch (event.type) {
		case "scene":
			return event.payload.scene;
		case "line":
			return `${event.payload.scene}:${event.payload.key}`;
		case "choice":
			return `${event.payload.scene}:${event.payload.option}`;
		case "ending":
			return event.payload.key ?? `the story ran out in ${event.payload.scene}`;
		case "unlock":
			return `${event.payload.kind} ${event.payload.id}`;
		case "chapter":
			return event.payload.chapter.name;
		case "save":
			return `slot ${event.payload.slot}`;
		case "persist":
			return `${Object.keys(event.payload.seen).length} lines seen`;
		case "error":
			return `${event.payload.code}: ${event.payload.message}`;
	}
}
