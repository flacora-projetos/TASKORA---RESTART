import { describe, expect, it } from "vitest";

import type { ExternalDirectoryClient } from "../types/directory.js";
import { collectIdentifiers } from "./directory-sync.js";

describe("directory-sync collectIdentifiers", () => {
  it("normaliza IDs unicos de Google e GA4 vindos do diretorio", () => {
    const entry: ExternalDirectoryClient = {
      id: "client-2",
      clientName: "Hannover",
      googleCustomerId: "321-654-9870",
      ga4PropertyId: "properties/300123456",
      activePlatforms: ["google", "ga4"]
    };

    const identifiers = collectIdentifiers(entry);
    expect(identifiers.googleCustomerIds).toEqual(["321-654-9870"]);
    expect(identifiers.ga4PropertyIds).toEqual(["properties/300123456"]);
  });
});
