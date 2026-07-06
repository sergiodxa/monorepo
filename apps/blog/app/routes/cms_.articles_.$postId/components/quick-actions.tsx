/**
 * Vertical quick-actions toolbar for the article editor. It offers an image-upload
 * button and a prettify button that submits the editor form with a "prettify" intent,
 * then writes the formatted content back into the editor via dispatch. Exists to give
 * authors inline formatting and asset shortcuts while writing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Toolbar, Tooltip, TooltipTrigger } from "@pkg/ui";
import { Brush, ImagePlus } from "lucide-react";
import { type Dispatch, useEffect } from "react";
import { useFetcher } from "react-router";

import type { Actions } from "../../components.editor/use-editor";
import type { action } from "../route";

type QuickActionsProps = {
	dispatch: Dispatch<Actions>;
};

export function QuickActions({ dispatch }: QuickActionsProps) {
	let prettify = useFetcher<typeof action>();

	let value = prettify.data && "content" in prettify.data ? prettify.data.content : undefined;

	useEffect(() => {
		if (value) dispatch({ type: "write", payload: { value } });
	}, [dispatch, value]);

	return (
		<Toolbar
			orientation="vertical"
			className="rounded-lg border border-neutral-200 p-1 dark:border-neutral-700"
		>
			<TooltipTrigger>
				<Button type="button" variant="ghost" aria-label="Upload image" className="size-10">
					<ImagePlus className="size-7 shrink-0" />
				</Button>
				<Tooltip placement="left">Upload image</Tooltip>
			</TooltipTrigger>

			<TooltipTrigger>
				<Button
					type="button"
					variant="ghost"
					aria-label="Prettify"
					className="size-10"
					onPress={(event) => {
						if (event.target instanceof HTMLButtonElement && event.target.form) {
							let formData = new FormData(event.target.form);
							formData.set("intent", "prettify");
							prettify.submit(formData, { method: "post" });
						}
					}}
				>
					<Brush className="size-7 shrink-0" />
				</Button>
				<Tooltip placement="left">Prettify</Tooltip>
			</TooltipTrigger>
		</Toolbar>
	);
}
