import z from "zod";

export const API_RESPONSE_VPN_SCHEMA = z.object({
  service: z.string(),
  url: z.string(),
  type: z.string(),
  last_seen: z.number(),
  last_seen_str: z.string(),
  exit_node_region: z.string(),
  country_code: z.string(),
  city_name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export const API_RESPONSE_DATACENTER_SCHEMA = z.object({
  datacenter: z.string(),
  domain: z.string(),
  network: z.string(),
});

export const API_RESPONSE_COMPANY_SCHEMA = z.object({
  name: z.string(),
  abuser_score: z.string(),
  domain: z.string(),
  type: z.string(),
  network: z.string(),
  whois: z.string(),
});

export const API_RESPONSE_ABUSE_SCHEMA = z.object({
  name: z.string(),
  address: z.string(),
  country: z.string(),
  email: z.string(),
  phone: z.string(),
});

export const API_RESPONSE_ASN_SCHEMA = z.object({
  asn: z.number().int(),
  abuser_score: z.string(),
  route: z.string(),
  descr: z.string(),
  country: z.string(),
  active: z.string(),
  org: z.string(),
  domain: z.string(),
  abuse: z.string(),
  type: z.string(),
  created: z.string(),
  updated: z.string(),
  rir: z.string(),
  whois: z.string(),
});

export const API_RESPONSE_LOCATION_SCHEMA = z.object({
  is_eu_member: z.boolean(),
  calling_code: z.string(),
  currency_code: z.string(),
  continent: z.string(),
  country: z.string(),
  country_code: z.string(),
  state: z.string(),
  city: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  zip: z.string(),
  timezone: z.string(),
  local_time: z.string(),
  local_time_unix: z.number().int(),
  is_dst: z.boolean(),
  other: z.array(z.any()).optional(),
});

export const API_RESPONSE_SCHEMA = z.object({
  ip: z.string(),
  rir: z.string(),
  is_bogon: z.boolean(),
  is_mobile: z.boolean(),
  is_satellite: z.boolean(),
  is_crawler: z.boolean(),
  is_datacenter: z.boolean(),
  is_tor: z.boolean(),
  is_proxy: z.boolean(),
  is_vpn: z.boolean(),
  is_abuser: z.boolean(),
  elapsed_ms: z.number(),
  vpn: API_RESPONSE_VPN_SCHEMA,
  datacenter: API_RESPONSE_DATACENTER_SCHEMA,
  company: API_RESPONSE_COMPANY_SCHEMA,
  asn: API_RESPONSE_ASN_SCHEMA,
  location: API_RESPONSE_LOCATION_SCHEMA,
});

export type APIResponse = z.infer<typeof API_RESPONSE_SCHEMA>;

export const API_BULK_RESPONSE_SCHEMA = z.record(
  z.string(),
  API_RESPONSE_SCHEMA,
);

export type APIBulkResponse = z.infer<typeof API_BULK_RESPONSE_SCHEMA>;
