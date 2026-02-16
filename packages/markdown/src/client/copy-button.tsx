import { useClipboard } from "@pkg/hooks";
import { Button } from "@pkg/ui";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useEffect } from "react";

export namespace CopyButton {
	export interface Props {
		targetId: string;
	}
}

export function CopyButton({ targetId }: CopyButton.Props) {
	let { status, write, reset } = useClipboard();

	useEffect(() => {
		if (status === "idle" || status === "loading") return;
		let timeout = setTimeout(reset, 2000);
		return () => clearTimeout(timeout);
	}, [status, reset]);

	return (
		<Button
			variant="ghost"
			size="sm"
			onPress={async () => {
				let element = document.getElementById(targetId);
				if (!element) return;

				let text = element.textContent ?? "";
				let item = new ClipboardItem({ "text/plain": new Blob([text], { type: "text/plain" }) });

				await write([item]);
			}}
			isDisabled={status === "loading"}
			aria-label={status === "success" ? "Copied" : "Copy code"}
		>
			{status === "success" ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
		</Button>
	);
}
