/**
 * The Spanish body of working through the queue: narrowing it by read state, marking posts
 * and whole feeds read, opening a post in place, and what arrives while the page is open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui";

import type { DocBody } from "~/resources/docs/blocks";

import { ArticleView, ReaderWindow } from "~/resources/components/marketing/reader-window";
import { Faq, H2Es, Kbd, Scene } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "queue", text: "Qué contiene la cola", level: 2 },
	{ id: "narrow", text: "Mostrar todas, sin leer o leídas", level: 2 },
	{ id: "mark", text: "Marca entradas como leídas", level: 2 },
	{ id: "open", text: "Abre una entrada", level: 2 },
	{ id: "new", text: "Cuando llegan entradas nuevas", level: 2 },
	{ id: "questions", text: "Preguntas", level: 2 },
];

/** The queue guide's body. */
export default function Reading(handle: Handle<DocBody.Props>) {
	return () => {
		let { t } = handle.props;
		return (
			<>
				<H2Es id="queue">Qué contiene la cola</H2Es>
				<p>
					<UiPath items={["Lectura"]} /> es una sola lista con todas las entradas de todos los feeds
					que sigues, de la más reciente a la más antigua, y sigue cargando a medida que te
					desplazas. La página de cada feed, en <UiLabel>Feeds</UiLabel> en la barra lateral, es la
					misma lista reducida a ese feed.
				</p>

				<H2Es id="narrow">Mostrar todas, sin leer o leídas</H2Es>
				<p>
					Junto al título, <UiLabel>Mostrar</UiLabel> elige <UiLabel>Todas</UiLabel>,{" "}
					<UiLabel>Sin leer</UiLabel> o <UiLabel>Leídas</UiLabel>. La elección forma parte de la
					dirección de la página, así que un marcador la conserva, y funciona junto con una
					búsqueda.
				</p>

				<H2Es id="mark">Marca entradas como leídas</H2Es>
				<ul>
					<li>
						<strong>Una entrada</strong>: pulsa la marca al inicio de su fila, o pulsa <Kbd>m</Kbd>.
						En un teléfono, desliza la fila hacia un lado. Vuelve a pulsarla para marcarla como no
						leída.
					</li>
					<li>
						<strong>Un feed</strong>: en la página del feed, pulsa{" "}
						<UiLabel>Marcar feed leído</UiLabel>.
					</li>
					<li>
						<strong>Todo</strong>: en Lectura, pulsa <UiLabel>Marcar todo leído</UiLabel> y
						confirma.
					</li>
				</ul>
				<Callout kind="warning" label="Atención">
					<p>
						Marcar todo leído no se puede deshacer. Reader no guarda registro de qué entradas
						estaban sin leer antes.
					</p>
				</Callout>

				<H2Es id="open">Abre una entrada</H2Es>
				<p>
					Pulsa el título de una entrada para abrirla en el sitio de quien la publica; eso la marca
					como leída. Pulsa <UiLabel>Leer aquí</UiLabel> para abrirla dentro de Reader, con el
					título del feed, el autor, la fecha y el extracto, y un enlace para{" "}
					<UiLabel>Abrir el original</UiLabel>. Un pódcast o un vídeo adjunto a una entrada se
					reproduce ahí mismo, en el reproductor de tu navegador.
				</p>
				<p>
					En De pago y Premium, la página de la entrada también trae el artículo completo que hay
					detrás del enlace y lo muestra ahí mismo, indicando quién lo publica.
				</p>
				<Scene caption="Una entrada abierta en Reader, con el artículo traído del sitio de origen debajo.">
					<ReaderWindow
						t={t}
						title={t("nav.reading")}
						path="/reading/the-verge/post"
						label="Una entrada abierta dentro de Reader con su artículo completo"
					>
						<ArticleView t={t} />
					</ReaderWindow>
				</Scene>
				<p>
					Si el artículo no aparece, consulta{" "}
					<a href={docHref("article-not-loading")}>El artículo no carga en Reader</a>.
				</p>

				<H2Es id="new">Cuando llegan entradas nuevas</H2Es>
				<p>
					Cuando abres Reader, ya sabe qué feeds tienen algo nuevo. Te dice cuántos feeds tienen
					entradas en camino y las trae mientras usas la página. Para revisar ahora mismo, pulsa{" "}
					<UiLabel>Revisar todos</UiLabel> en Lectura, o <Kbd>r</Kbd>.
				</p>

				<H2Es id="questions">Preguntas</H2Es>
				<Faq
					items={[
						{
							question: "¿Por qué desaparecieron entradas antiguas de mi cola?",
							answer: (
								<p>
									Cada feed conserva sus entradas durante el tiempo que elijas, desde tres horas
									hasta siempre. Leídas o no, las entradas más antiguas se van; las guardadas se
									quedan siempre. Consulta <a href={docHref("feeds")}>Seguir y gestionar feeds</a>.
								</p>
							),
						},
						{
							question: "¿Adónde fue una entrada que el feed dejó de listar?",
							answer: (
								<p>
									Cuando un feed indica que lista todo lo que tiene, una entrada que retira también
									sale de tu lista, salvo que la hayas guardado.
								</p>
							),
						},
					]}
				/>
			</>
		);
	};
}
