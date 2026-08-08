import Link from "next/link";

import { adminCustomerDeps } from "./admin-customers";
import { CreateCustomerForm } from "./customer-form";

import { CARD_CLASS, Card } from "@/app/_components/ui/card";
import { Table, Td, Th, Tr } from "@/app/_components/ui/table";

/**
 * The dynamic half of the customers screen — mirrors
 * `app/admin/resellers/resellers-workspace.tsx`'s `ResellersWorkspace`.
 * Customers carry no wallet (that seam belongs to `payment-gateway`,
 * out of scope here — design.md "Untouched: src/modules/wallet/**"), so
 * this screen is list + create only, unlike the reseller one.
 */

export async function CustomersWorkspace() {
  const deps = await adminCustomerDeps();

  const [allUsers, tiers] = await Promise.all([
    deps.users.listUsers(),
    deps.catalog.listPriceTiers(),
  ]);

  // An ADMIN scope reads every row; this screen is about customers, so
  // resellers and other admins are filtered out here rather than by
  // narrowing the repository — the isolation rule belongs to the scope,
  // not to a presentation filter.
  const customers = allUsers
    .filter((user) => user.role === "CUSTOMER")
    .sort((a, b) => a.email.localeCompare(b.email, "es"));

  const tierById = new Map(tiers.map((tier) => [tier.id, tier]));

  return (
    <Card as="section" aria-labelledby="customers-heading">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50" id="customers-heading">
        Cuentas de cliente
      </h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Cada cliente queda fijado a un nivel de precio y recibe su propia identidad de cuenta,
        igual que un revendedor.
      </p>

      <div className="mt-4">
        {customers.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
            Todavía no hay clientes.
          </p>
        ) : (
          <Table minWidth="lg">
            <thead>
              <Tr head>
                <Th scope="col">Correo electrónico</Th>
                <Th scope="col">Nivel</Th>
                <Th scope="col">Estado</Th>
                <Th scope="col">
                  <span className="sr-only">Detalle</span>
                </Th>
              </Tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const tier = customer.priceTierId ? tierById.get(customer.priceTierId) : undefined;
                return (
                  <Tr key={customer.id}>
                    <Td className="font-medium text-zinc-950 dark:text-zinc-50">
                      {customer.email}
                    </Td>
                    <Td>{tier ? `${tier.code} · ${tier.name}` : "—"}</Td>
                    <Td>{customer.deactivatedAt === null ? "Activo" : "Desactivado"}</Td>
                    <Td>
                      <Link
                        className="text-emerald-700 hover:underline dark:text-emerald-400"
                        href={`/admin/customers/${customer.id}`}
                      >
                        Ver cuentas
                      </Link>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </div>

      {tiers.length === 0 ? (
        <p className="mt-6 rounded-lg bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
          {/* CI: Retail Tier Is A Prerequisite For Provisioning — the form
              cannot be offered before a tier exists; it could only ever be
              rejected. */}
          Cree un nivel de precio antes de dar de alta clientes.
        </p>
      ) : (
        <CreateCustomerForm
          tiers={tiers.map((tier) => ({ id: tier.id, code: tier.code, name: tier.name }))}
        />
      )}
    </Card>
  );
}

export function CustomersWorkspaceFallback() {
  return (
    <div className={`${CARD_CLASS} animate-pulse`}>
      <div className="h-5 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-3 h-4 w-full max-w-md rounded bg-zinc-100 dark:bg-zinc-800/60" />
      <div className="mt-6 h-24 rounded bg-zinc-50 dark:bg-zinc-800/40" />
    </div>
  );
}
