import type { RenderableTreeNode } from "@markdoc/markdoc";
import type { Dispatch, RefObject } from "react";

import { ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { useEffect, useMemo, useRef } from "react";
import { useFetcher } from "react-router";
import { z } from "zod";

import { MarkdownView } from "~/components/markdown";
import { Toolbar } from "~/ui/Toolbar";
import { Markdown } from "~/utils/markdown";

import type { Route } from "./+types/route";
import type { Actions } from "./use-editor";

import { Button } from "./buttons";
import { Provider, useEditor } from "./use-editor";

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(request, z.object({ content: z.string() }));
	if (isFailure(result)) return ok({ content: null });
	return ok({ content: Markdown.parse(result.data.content) });
}

type TextboxProps = {
	value: string;
	dispatch: Dispatch<Actions>;
	fieldRef: RefObject<HTMLTextAreaElement | null>;
};

export function Textbox(props: TextboxProps) {
	return (
		<div className="dark:bg-zinc-800 flex h-full flex-col rounded-md border border-neutral-300 bg-white">
			<div role="menubar" className="flex items-center justify-between p-2">
				<Toolbar aria-label="Text Formatting" orientation="horizontal">
					<Button.Bold />
					<Button.Italic />
					<Button.Link />
					<Button.Code />
					<Button.Quote />
					<Button.Image />
					<Button.Heading />
				</Toolbar>
			</div>

			<textarea
				name="content"
				ref={props.fieldRef}
				value={props.value}
				onChange={(event) => {
					let value = event.currentTarget.value;
					props.dispatch({ type: "write", payload: { value } });
				}}
				className="ring-blue-600 mx-2 mb-2 grow resize-none rounded-md border-none font-mono focus:ring-2 focus:outline-none"
			/>
		</div>
	);
}

type PreviewProps = {
	rendereable?: RenderableTreeNode;
};

export function Preview(props: PreviewProps) {
	return (
		<div className="prose max-w-prose overflow-y-auto prose-blue sm:prose-lg dark:prose-invert">
			{props.rendereable ? <MarkdownView content={props.rendereable} /> : null}
		</div>
	);
}

export function Editor({ defaultContent }: { defaultContent?: string }) {
	let { submit, data } = useFetcher<typeof action>();
	let $textarea = useRef<HTMLTextAreaElement>(null);

	let [state, dispatch] = useEditor($textarea.current, defaultContent);

	let stateValue = state.value;

	let providerValue = useMemo(() => {
		return { element: $textarea, state, dispatch };
	}, [dispatch, state]);

	useEffect(() => {
		submit({ content: stateValue }, { action: "/components/editor", method: "post" });
	}, [submit, stateValue]);

	return (
		<Provider value={providerValue}>
			<div className="grid h-[calc(100vh-90px-72px-64px)] gap-4 sm:grid-cols-2">
				<Textbox fieldRef={$textarea} value={stateValue} dispatch={dispatch} />
				<Preview rendereable={data?.content} />
			</div>
		</Provider>
	);
}
