/**
 * The Spanish body of the reference for every key the reading surfaces answer, in the
 * order the in-app panel lists them, and the rule that a field being typed in leaves every
 * key alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle, RemixNode } from "remix/component";

import { UiLabel } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { FactTable, H2Es, Kbd } from "~/resources/docs/blocks";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "keys", text: "Todas las teclas", level: 2 },
	{ id: "panel", text: "Consúltalas en Reader", level: 2 },
	{ id: "fields", text: "Escribir en un campo", level: 2 },
];

/** Each key and what it does, in the order the in-app panel lists them. */
const KEYS: [RemixNode, string][] = [
	[<Kbd>j</Kbd>, "Entrada siguiente"],
	[<Kbd>k</Kbd>, "Entrada anterior"],
	[<Kbd>o</Kbd>, "Abrir la entrada"],
	[<Kbd>m</Kbd>, "Marcar como leída o no leída"],
	[<Kbd>s</Kbd>, "Guardar la entrada, o dejar de guardarla"],
	[<Kbd>r</Kbd>, "Revisar todas las fuentes"],
	[
		<>
			<Kbd>Shift</Kbd> <Kbd>J</Kbd>
		</>,
		"Fuente siguiente",
	],
	[
		<>
			<Kbd>Shift</Kbd> <Kbd>K</Kbd>
		</>,
		"Fuente anterior",
	],
	[<Kbd>/</Kbd>, "Busca en tus entradas"],
	[<Kbd>?</Kbd>, "Mostrar estos atajos"],
];

/** The shortcuts reference's body. */
export default function KeyboardShortcuts(_handle: Handle<DocBody.Props>) {
	return () => (
		<>
			<H2Es id="keys">Todas las teclas</H2Es>
			<p>
				Funcionan en todas las páginas de Reader una vez que has iniciado sesión. Moverte entre
				entradas funciona en cualquier lugar donde haya una lista de entradas.
			</p>
			<FactTable
				caption="Atajos de teclado mientras lees."
				head={["Tecla", "Qué hace"]}
				rows={KEYS}
			/>

			<H2Es id="panel">Consúltalas en Reader</H2Es>
			<p>
				Pulsa <Kbd>?</Kbd>, o <UiLabel>Atajos de teclado</UiLabel>, para abrir la misma lista sobre
				la página. Pulsa <Kbd>Esc</Kbd> para cerrarla.
			</p>

			<H2Es id="fields">Escribir en un campo</H2Es>
			<p>
				Mientras escribes en un campo, como la búsqueda o el cuadro para seguir feeds, todas las
				teclas escriben con normalidad. Haz clic fuera del campo para volver a usar los atajos.
			</p>
		</>
	);
}
