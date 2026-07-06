/**
 * Editor component for the tutorial CMS route, rendering a full-height,
 * monospace textarea bound to a controlled string value. It wraps the shared
 * TextArea in a Group and forwards edits through an onChange callback so the
 * parent route can manage the tutorial's Markdown content state.
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
