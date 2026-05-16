import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-business-card",
  description: "Trade vCards by QR — collect contacts and export to .vcf, no account",
  accentHex: "#3b82f6",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
