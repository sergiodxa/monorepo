/** @jsxImportSource react */

import { cn } from "@pkg/cn";

import { CopyButton } from "./copy-button.js";

/**
 * Groups React code fence types under the component namespace.
 */
export namespace Fence {
	/**
	 * Describes the highlighted code block and optional header metadata.
	 */
	export interface Props {
		content: string;
		language: string;
		path?: string;
		title?: string;
		copyId?: string;
	}
}

/**
 * Renders a highlighted code block with optional metadata and copy controls.
 *
 * @param props - Highlighted code content and optional fence metadata
 */
export function Fence({ content, language, path, title, copyId }: Fence.Props) {
	let hasHeader = Boolean(path || title);

	return (
		<div className="relative">
			<pre
				className={cn(
					`language-${language}`,
					"overflow-x-auto rounded-lg border bg-neutral-50 p-4 text-sm dark:bg-neutral-900",
				)}
			>
				{hasHeader && (
					<header className="mb-3 flex items-center justify-between border-b border-neutral-200 pb-2 dark:border-neutral-700">
						<div className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
							{title && <span className="font-medium">{title}</span>}
							{path && <span className="font-mono">{path}</span>}
						</div>
						{copyId && <CopyButton targetId={copyId} />}
					</header>
				)}

				<code
					id={copyId}
					className={`language-${language}`}
					dangerouslySetInnerHTML={{ __html: content }}
				/>
			</pre>

			{!hasHeader && copyId && (
				<div className="absolute right-2 top-2">
					<CopyButton targetId={copyId} />
				</div>
			)}
		</div>
	);
}
