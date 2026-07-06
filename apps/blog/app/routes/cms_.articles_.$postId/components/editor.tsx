/**
 * Controlled Markdown text-area component for the article editor. It renders a
 * growing, monospaced textarea named "content" and reports edits through an onChange
 * callback. Exists as the raw writing surface for the article body within the editor
 * layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Group, TextArea } from "@pkg/ui";
import { useRef } from "react";

type EditorProps = {
	value: string;
	onChange(value: string): void;
};

export function Editor({ value, onChange }: EditorProps) {
	let $textarea = useRef<HTMLTextAreaElement>(null);

	return (
		<Group className="w-prose h-auto grow flex-col items-stretch">
			<TextArea
				ref={$textarea}
				name="content"
				value={value}
				onChange={(event) => {
					onChange(event.currentTarget.value);
				}}
				className="h-auto grow resize-none font-mono"
			/>
		</Group>
	);
}
