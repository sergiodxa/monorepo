/**
 * Toolbar component for the CMS tutorial editor. Actions renders a "Go back" link
 * to the tutorials list and a submit button whose intent value is set from the
 * editor's mode (write or update), so saving triggers the right action branch. It
 * exists to provide the editor's top navigation and save control.
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
			<Link href="/cms/tutorials" className="flex items-center gap-1">
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
