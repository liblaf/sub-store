import * as fs from "node:fs/promises";
import path from "node:path";
import { SubStoreClient } from "@cli/client";
import { MihomoOutboundWrapper } from "@core/formats/mihomo/outbound";
import { parseMihomoConfig } from "@core/formats/mihomo/parse";
import type { MihomoConfig, MihomoOutbound } from "@core/formats/mihomo/schema";
import { MihomoTemplate } from "@core/formats/mihomo/template";
import type { Grouper } from "@core/group/abc";
import { defaultGroupers } from "@core/group/factory";
import type { Processor } from "@core/processor/abc";
import { defaultProcessors } from "@core/processor/factory";
import type { Profiles } from "@shared/schema/profile";
import type { Provider, Providers } from "@shared/schema/provider";
import { buildCommand } from "@stricli/core";
import consola from "consola";
import type { KyResponse } from "ky";

type Flags = {
  filename: string;
  template: string;
};

export default buildCommand({
  docs: {
    brief: "",
  },
  parameters: {
    flags: {
      filename: {
        kind: "parsed",
        parse: String,
        brief: "",
        default: "mihomo.yaml",
      },
      template: {
        kind: "parsed",
        parse: String,
        brief: "",
        default: "builtin://mihomo.yaml",
      },
    },
  },
  async func(flags: Flags): Promise<void> {
    const template: MihomoTemplate = await MihomoTemplate.load(flags.template);
    const groupers: Grouper[] = defaultGroupers();
    const processors: Processor[] = defaultProcessors();

    const client = new SubStoreClient();
    const profiles: Profiles = await client.listProfiles();
    const providers: Providers = await client.listProviders();
    let outbounds: MihomoOutboundWrapper[] = (
      await Promise.all(
        Object.values(providers).map(
          async (provider: Provider): Promise<MihomoOutboundWrapper[]> =>
            await fetchMihomoOutbounds(client, provider),
        ),
      )
    ).flat();
    for (const processor of processors)
      outbounds = await processor.process(outbounds);
    for (const profile of Object.values(profiles)) {
      const content: string = template.render(
        outbounds.filter((o: MihomoOutboundWrapper): boolean => {
          return profile.providers.includes(o.provider.id);
        }),
        groupers,
      );
      const filepath: string = path.join("outputs", profile.id, flags.filename);
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, content);
      await template.test(filepath);
      consola.success(`-> ${filepath}`);
      await client.uploadProfileArtifact(profile.id, flags.filename, content);
    }
  },
});

async function fetchMihomoOutbounds(
  client: SubStoreClient,
  provider: Provider,
): Promise<MihomoOutboundWrapper[]> {
  const response: KyResponse = await client.downloadProviderArtifact(
    provider.id,
    "mihomo.yaml",
  );
  const content: string = await response.text();
  const config: MihomoConfig = parseMihomoConfig(content);
  if (!config.proxies) {
    consola.warn(`No proxies found in ${provider.id}/mihomo.yaml`);
    return [];
  }
  return config.proxies.map(
    (o: MihomoOutbound): MihomoOutboundWrapper =>
      new MihomoOutboundWrapper(o, provider),
  );
}
