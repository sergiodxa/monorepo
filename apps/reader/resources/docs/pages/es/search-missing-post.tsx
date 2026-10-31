/**
 * The Spanish body of the missed-search symptom page: the plan's search window, the fields
 * a search reads, the read-state filter, and how operators change what matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { UiLabel } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { H2Es } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "window", text: "La entrada es más antigua de lo que alcanza tu búsqueda", level: 2 },
	{ id: "fields", text: "Las palabras están en el artículo, no en la entrada", level: 2 },
	{ id: "show", text: "Mostrar está en Sin leer o Leídas", level: 2 },
	{ id: "words", text: "Una palabra actúa como operador", level: 2 },
	{ id: "gone", text: "La entrada salió de tu cola", level: 2 },
];

/** The missed-search symptom page's body. */
export default function SearchMissingPost(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures } = handle.props;
		return (
			<>
				<p>
					Lee primero la línea bajo los resultados: dice hasta dónde llegó la búsqueda hacia atrás.
				</p>

				<H2Es id="window">La entrada es más antigua de lo que alcanza tu búsqueda</H2Es>
				<p>
					Si dice que el plan Gratis busca en los últimos {figures.freeSearchDays} días, la entrada
					es más antigua. De pago y Premium buscan en todo lo que has guardado. Si dice que la
					búsqueda se detuvo en una fecha, pulsa <UiLabel>Seguir buscando</UiLabel> para seguir más
					atrás.
				</p>

				<H2Es id="fields">Las palabras están en el artículo, no en la entrada</H2Es>
				<p>
					La búsqueda lee el título, el resumen y el autor de cada entrada, tal como los dio el
					feed. Las palabras que solo están en el artículo detrás del enlace no aparecen. Busca
					mejor una palabra del título.
				</p>

				<H2Es id="show">Mostrar está en Sin leer o Leídas</H2Es>
				<p>
					Una búsqueda respeta el ajuste <UiLabel>Mostrar</UiLabel>. Ponlo en{" "}
					<UiLabel>Todas</UiLabel> para buscar en todas las entradas.
				</p>

				<H2Es id="words">Una palabra actúa como operador</H2Es>
				<p>
					<code>OR</code>, <code>AND</code> y <code>NOT</code> en mayúsculas, y una palabra que
					empieza por <code>-</code>, cambian el sentido de una búsqueda. Ponlas entre comillas para
					buscarlas como palabras: <code>"OR"</code>.
				</p>

				<H2Es id="gone">La entrada salió de tu cola</H2Es>
				<p>
					Una entrada que caducó según el plazo de su feed, o que se fue al dejar de seguir su feed,
					ya no se conserva, así que la búsqueda no puede encontrarla. Las entradas guardadas
					siempre se quedan; consulta <a href={docHref("saving")}>Guardar entradas</a>.
				</p>
			</>
		);
	};
}
