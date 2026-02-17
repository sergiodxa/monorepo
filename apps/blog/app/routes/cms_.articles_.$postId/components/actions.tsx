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
