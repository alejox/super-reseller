import { notFound } from "next/navigation";

import { adminCustomerDetailDeps } from "./admin-customer-detail";
import { CreateProviderAccountOnBehalfForm } from "./provider-account-on-behalf-form";

import { CARD_CLASS, Card } from "@/app/_components/ui/card";
import { Table, Td, Th, Tr } from "@/app/_components/ui/table";

/**
 * The dynamic half of the admin customer-detail screen. Read-only listing
 * of the target customer's `provider_account` rows plus the on-behalf
 * create form (PA: ADMIN May Create A Provider Account On A Customer's
 * Behalf).
 */

export async function CustomerDetailWorkspace({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id: targetUserId } = await params;
  const deps = await adminCustomerDetailDeps(targetUserId);

  if (deps.target === null) {
    notFound();
  }

  const [accounts, services] = await Promise.all([
    deps.providerAccounts.listForTenant(deps.target.resellerId ?? ""),
    deps.catalog.listServices(),
  ]);

  const serviceNameById = new Map(services.map((service) => [service.id, service.name]));

  return (
    <Card as="section" aria-labelledby="customer-detail-heading">
      <h2
        className="text-lg font-semibold text-zinc-950 dark:text-zinc-50"
        id="customer-detail-heading"
      >
        {deps.target.email}
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Cuentas de proveedor de este cliente. Solo lectura, salvo la creación de soporte.
      </p>

      <div className="mt-4">
        {accounts.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            Este cliente todavía no tiene cuentas registradas.
          </p>
        ) : (
          <Table minWidth="lg">
            <thead>
              <Tr head>
                <Th scope="col">Servicio</Th>
                <Th scope="col">Usuario</Th>
                <Th scope="col">Etiqueta</Th>
              </Tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <Tr key={account.id}>
                  <Td className="font-medium text-zinc-950 dark:text-zinc-50">
                    {serviceNameById.get(account.serviceId) ?? account.serviceId}
                  </Td>
                  <Td>{account.panelUsername}</Td>
                  <Td>{account.label ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>

      {services.length === 0 ? (
        <p className="mt-6 rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
          Cree un servicio antes de registrar cuentas de soporte.
        </p>
      ) : (
        <CreateProviderAccountOnBehalfForm
          services={services.map((service) => ({ id: service.id, name: service.name }))}
          targetUserId={deps.target.id}
        />
      )}
    </Card>
  );
}

export function CustomerDetailWorkspaceFallback() {
  return (
    <div className={`${CARD_CLASS} animate-pulse`}>
      <div className="h-5 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100 dark:bg-zinc-800/60" />
      <div className="mt-6 h-24 rounded bg-zinc-50 dark:bg-zinc-800/40" />
    </div>
  );
}
