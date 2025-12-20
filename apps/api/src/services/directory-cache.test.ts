import { describe, expect, it } from "vitest";

import type { ExternalDirectoryClient } from "../types/directory.js";
import { externalEntryToSummary } from "./directory-cache.js";

describe("directory-cache service", () => {
  it("mantem IDs de Google e GA4 mesmo quando o payload usa campos singulares", () => {
    const entry: ExternalDirectoryClient = {
      id: "client-1",
      clientName: "Clínica Alfa",
      googleCustomerId: "123-456-7890",
      ga4PropertyId: "properties/270511251",
      activePlatforms: ["google", "ga4"]
    };

    const summary = externalEntryToSummary(entry);
    expect(summary.metadata?.googleCustomerIds).toEqual(["123-456-7890"]);
    expect(summary.metadata?.ga4PropertyIds).toEqual(["properties/270511251"]);
  });
});
