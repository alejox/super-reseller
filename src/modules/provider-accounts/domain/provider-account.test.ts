import { describe, expect, it } from "vitest";

import { createProviderAccount, InvalidProviderAccountError } from "./provider-account";

const TENANT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SERVICE = "ssssssss-ssss-4sss-8sss-ssssssssssss";
const CREATOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

// PA: Provider Account Identifies A Real Panel Login.
describe("createProviderAccount", () => {
  it("persists the provider, real panel username, and label — no credential field exists on the type", async () => {
    const account = createProviderAccount({
      tenantId: TENANT,
      serviceId: SERVICE,
      panelUsername: "stella_juan_2024",
      label: "Cuenta principal",
      createdBy: CREATOR,
    });

    expect(account.tenantId).toBe(TENANT);
    expect(account.serviceId).toBe(SERVICE);
    expect(account.panelUsername).toBe("stella_juan_2024");
    expect(account.label).toBe("Cuenta principal");
    expect(account.createdBy).toBe(CREATOR);
    expect(account.archivedAt).toBeNull();
    // No credential/secret field on the entity shape.
    expect(Object.keys(account)).not.toContain("password");
    expect(Object.keys(account)).not.toContain("credential");
  });

  it("trims the panel username and rejects a blank one", () => {
    expect(
      createProviderAccount({
        tenantId: TENANT,
        serviceId: SERVICE,
        panelUsername: "  padded_username  ",
        createdBy: CREATOR,
      }).panelUsername,
    ).toBe("padded_username");

    expect(() =>
      createProviderAccount({
        tenantId: TENANT,
        serviceId: SERVICE,
        panelUsername: "   ",
        createdBy: CREATOR,
      }),
    ).toThrow(InvalidProviderAccountError);
  });

  it("defaults an omitted or blank label to null, not an empty string", () => {
    const omitted = createProviderAccount({
      tenantId: TENANT,
      serviceId: SERVICE,
      panelUsername: "user1",
      createdBy: CREATOR,
    });
    const blank = createProviderAccount({
      tenantId: TENANT,
      serviceId: SERVICE,
      panelUsername: "user2",
      label: "   ",
      createdBy: CREATOR,
    });

    expect(omitted.label).toBeNull();
    expect(blank.label).toBeNull();
  });

  // PA: Duplicate provider is allowed — the pure constructor never dedupes;
  // two calls for the same (tenant, service, panel username) each mint a
  // fresh, distinct account.
  it("allows a second account for the same provider and panel username (duplicate is a repository concern, not a domain one)", () => {
    const first = createProviderAccount({
      tenantId: TENANT,
      serviceId: SERVICE,
      panelUsername: "stella_juan_2024",
      createdBy: CREATOR,
    });
    const second = createProviderAccount({
      tenantId: TENANT,
      serviceId: SERVICE,
      panelUsername: "stella_juan_2024",
      createdBy: CREATOR,
    });

    expect(second.id).not.toBe(first.id);
    expect(second.panelUsername).toBe(first.panelUsername);
  });
});
