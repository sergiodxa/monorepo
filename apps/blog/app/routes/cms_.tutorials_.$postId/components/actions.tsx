import { Button, Link, Toolbar } from "@pkg/ui";
import { ArrowLeft } from "lucide-react";

interface ActionsProps {
	mode: string;
}

export function Actions({ mode }: ActionsProps) {
	return (
		<Toolbar className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
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
