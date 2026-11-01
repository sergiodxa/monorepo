/**
 * The Spanish body of the search guide: what a search reads, the operators it understands,
 * how far back each plan reaches, and keeping a search in the sidebar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle, RemixNode } from "remix/component";

import { Steps, UiLabel } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import { SearchScene } from "~/resources/components/marketing/scenes";
import { FactTable, H2Es, Kbd, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "search", text: "Busca", level: 2 },
	{ id: "syntax", text: "Combina palabras", level: 2 },
	{ id: "reach", text: "Hasta dónde llega", level: 2 },
	{ id: "save", text: "Guarda una búsqueda", level: 2 },
];

/** What each way of typing a search finds, with an example a reader can copy. */
const SYNTAX: [RemixNode, string][] = [
	[<code>rust versión</code>, "Entradas que contienen todas las palabras."],
	[<code>"notas de versión"</code>, "Entradas que contienen la frase, tal como está escrita."],
	[<code>rust OR go</code>, "Entradas que contienen cualquiera de las dos palabras."],
	[<code>apple -iphone</code>, "Entradas que contienen apple y no iphone."],
	[<code>apple NOT iphone</code>, "Lo mismo que el signo menos."],
	[<code>"OR"</code>, "La palabra OR en sí, entre comillas para que no sea un operador."],
];

/** The search guide's body. */
export default function Search(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, t } = handle.props;
		return (
			<>
				<H2Es id="search">Busca</H2Es>
				<p>
					Escribe en <UiLabel>Busca en tus entradas</UiLabel>, arriba en la barra lateral, o pulsa{" "}
					<Kbd>/</Kbd> para saltar ahí, y pulsa Enter. Los resultados son tu cola reducida a las
					entradas que coinciden, de la más nueva a la más antigua, y <UiLabel>Mostrar</UiLabel>{" "}
					sigue reduciéndolas a sin leer o leídas.
				</p>
				<p>
					Una búsqueda lee el título, el resumen y el autor de cada entrada, que es lo que dio el
					feed. No lee el artículo detrás del enlace.
				</p>
				<Scene caption="Una búsqueda reduce la cola a las entradas que coinciden, y dice hasta dónde buscó.">
					<SearchScene t={t} />
				</Scene>

				<H2Es id="syntax">Combina palabras</H2Es>
				<FactTable
					caption="Qué encuentra cada forma de escribir una búsqueda."
					head={["Escribe", "Encuentra"]}
					rows={SYNTAX}
				/>
				<p>
					<code>OR</code>, <code>AND</code> y <code>NOT</code> funcionan como operadores cuando se
					escriben en mayúsculas. Una búsqueda admite hasta {figures.queryTerms} palabras y{" "}
					{figures.queryLength} caracteres.
				</p>

				<H2Es id="reach">Hasta dónde llega</H2Es>
				<p>
					En Gratis, una búsqueda llega a los últimos {figures.freeSearchDays} días. En De pago y
					Premium, llega a todo lo que has conservado. Debajo de los resultados, Reader siempre dice
					dónde se detuvo la búsqueda; pulsa <UiLabel>Seguir buscando</UiLabel> para ir más atrás.
				</p>
				<p>
					¿Falta una entrada que sabes que está? Consulta{" "}
					<a href={docHref("search-missing-post")}>
						La búsqueda no encuentra una entrada que sé que está
					</a>
					.
				</p>

				<H2Es id="save">Guarda una búsqueda</H2Es>
				<Steps>
					<Steps.Item title="Haz la búsqueda">
						<p>Busca lo que quieras volver a consultar.</p>
					</Steps.Item>
					<Steps.Item title="Ponle nombre">
						<p>
							Pulsa <UiLabel>Guardar esta búsqueda</UiLabel>, escribe un nombre de hasta{" "}
							{figures.searchNameLength} caracteres en <UiLabel>Ponle nombre a la búsqueda</UiLabel>{" "}
							y guárdala.
						</p>
					</Steps.Item>
					<Steps.Item title="Ábrela desde la barra lateral">
						<p>
							La búsqueda aparece bajo <UiLabel>Búsquedas guardadas</UiLabel> en la barra lateral y
							se vuelve a ejecutar cada vez que la abres. Para quitarla, ábrela y pulsa{" "}
							<UiLabel>Olvidar esta búsqueda</UiLabel>.
						</p>
					</Steps.Item>
				</Steps>
				<p>
					Gratis conserva {figures.freeSavedSearches} búsquedas guardadas; De pago y Premium
					conservan {figures.savedSearchLimit}.
				</p>
			</>
		);
	};
}
