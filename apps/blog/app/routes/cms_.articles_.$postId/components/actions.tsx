/**
 * Toolbar component for the article editor. It renders a back link to the articles
 * list and a submit button whose intent value carries the current editor mode
 * (write/update). Exists to provide the editor's top-bar navigation and save action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Link, Toolbar } from "@pkg/ui";
import { ArrowLeft } from "lucide-react";

interface ActionsProps {
	mode: string;
}

export function Actions({ mode }: ActionsProps) {
	return (
		<Toolbar className="items-center">
			<Link href="/cms/articles" className="flex items-center gap-1">
				<ArrowLeft className="size-5" />
				<span>Go back</span>
			</Link>
			<div className="grow" />
			<Button type="submit" color="primary" name="intent" value={mode}>
				Save
			</Button>
		</Toolbar>
	);
}
