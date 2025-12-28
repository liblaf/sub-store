import { fetchMihomo } from "@shared/fetch/mihomo";
import { Sublink } from "@shared/fetch/utils/sublink";
import type { Provider } from "@shared/schema/provider";
import { buildCommand } from "@stricli/core";
import ky, { type KyInstance } from "ky";

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
    const BASE_URL: string =
      process.env.SUB_STORE_URL ?? "https://sub.liblaf.me";
    const TOKEN: string = process.env.SUB_STORE_TOKEN!;
    const client: KyInstance = ky.create({
      headers: { Authorization: `Bearer ${TOKEN}` },
      prefixUrl: `${BASE_URL}/`,
      redirect: "follow",
    });

    const id: string = flags.provider;
    const provider: Provider = {
      id,
      bwcounter: flags.bwcounter,
      mihomo: flags.mihomo,
      singbox: flags.singbox,
      xray: flags.xray,
    };
    await create(client, provider);

    const sublink = new Sublink();
    await uploadMihomo(client, provider, sublink);
  },
});

async function create(client: KyInstance, provider: Provider): Promise<void> {
  await client.post(`api/providers/${provider.id}`, { json: provider });
}

async function uploadMihomo(
  client: KyInstance,
  provider: Provider,
  sublink: Sublink,
): Promise<void> {
  const { id } = provider;
  const { content, userinfo } = await fetchMihomo(provider, sublink);
  await client.post(`api/providers/${id}/mihomo.yaml`, { body: content });
  await client.post(`api/providers/${id}/userinfo.json`, { json: userinfo });
}
