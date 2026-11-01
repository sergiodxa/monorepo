/**
 * The Spanish body of the plan reference: the comparison table read from the limits that
 * enforce it, moving up a plan or managing billing, and what a failed payment or a downgrade does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableOfContents } from "@sdxc/ui/docs";
import type { Handle } from "remix/component";

import { Callout, UiLabel, UiPath } from "@sdxc/ui/docs";

import type { DocBody } from "~/resources/docs/blocks";

import PlansTable from "~/resources/components/marketing/plans-table";
import { H2Es } from "~/resources/docs/blocks";
import { docHref } from "~/resources/docs/registry";

/** The rail's headings, in page order. */
export const TOC: TableOfContents.Item[] = [
	{ id: "compare", text: "Compara los planes", level: 2 },
	{ id: "your-plan", text: "Consulta tu plan", level: 2 },
	{ id: "change", text: "Cambia de plan", level: 2 },
	{ id: "payments", text: "Si falla un pago", level: 2 },
];

/** The plans reference's body. */
export default function Plans(handle: Handle<DocBody.Props>) {
	return () => {
		let { figures, locale, t } = handle.props;
		return (
			<>
				<p>
					Todos los planes leen todos los feeds de la misma manera. Se diferencian en cuánto
					conservan y en lo que hacen por ti mientras no estás.
				</p>

				<H2Es id="compare">Compara los planes</H2Es>
				<PlansTable t={t} locale={locale} />

				<H2Es id="your-plan">Consulta tu plan</H2Es>
				<p>
					<UiPath items={["Preferencias", "Tu plan"]} /> dice en qué plan estás, qué conserva y
					cuánto usas de él: cuántos feeds sigues y cuántas entradas has guardado.
				</p>

				<H2Es id="change">Cambia de plan</H2Es>
				<p>
					En <UiLabel>Tu plan</UiLabel>, pulsa <UiLabel>Cambiar a De pago</UiLabel> o{" "}
					<UiLabel>Cambiar a Premium</UiLabel>. Pagas en una página segura de nuestro proveedor de
					pagos y vuelves a Reader con el plan nuevo.
				</p>
				<p>
					Para cambiar tu tarjeta, ver facturas o cancelar, pulsa{" "}
					<UiLabel>Gestionar la facturación</UiLabel>.
				</p>
				<Callout kind="note" label="Nota">
					<p>
						Un cambio de plan nunca borra nada. Pasar a un plan menor pausa lo nuevo mientras
						superes sus números. Consulta{" "}
						<a href={docHref("over-plan-limits")}>Superé los límites de mi plan</a>.
					</p>
				</Callout>

				<H2Es id="payments">Si falla un pago</H2Es>
				<p>
					Todo se conserva durante {figures.graceDays} días. Actualiza tu tarjeta en{" "}
					<UiLabel>Gestionar la facturación</UiLabel> dentro de ese plazo y no cambia nada.
				</p>
			</>
		);
	};
}
