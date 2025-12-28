import { SubStoreClient } from "@cli/client";
import { MihomoLocalFetcher } from "@shared/fetch/mihomo";
import type { Provider } from "@shared/schema/provider";
import { buildCommand } from "@stricli/core";

type Flags = {
  provider: string;
  bwcounter?: string;
  mihomo?: string;
  singbox?: string;
  xray?: string;
};

export default buildCommand({
  docs: {
    brief: "",
  },
  parameters: {
    flags: {
      provider: { kind: "parsed", parse: String, brief: "" },
      bwcounter: { kind: "parsed", parse: String, brief: "", optional: true },
      mihomo: { kind: "parsed", parse: String, brief: "", optional: true },
      singbox: { kind: "parsed", parse: String, brief: "", optional: true },
      xray: { kind: "parsed", parse: String, brief: "", optional: true },
    },
  },
  async func(flags: Flags): Promise<void> {
    const client = new SubStoreClient();
    const id: string = flags.provider;
    const provider: Provider = {
      id,
      bwcounter: flags.bwcounter,
      mihomo: flags.mihomo,
      singbox: flags.singbox,
      xray: flags.xray,
    };
    await client.createProvider(provider);

    const fetcher = new MihomoLocalFetcher();
    const { content, userinfo } = await fetcher.fetch(provider);
    await client.uploadProviderArtifact(id, "mihomo.yaml", content);
    await client.uploadProviderArtifact(id, "userinfo.json", userinfo);
  },
});
