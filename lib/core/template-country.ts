import twemoji from "@twemoji/api";
import type { Country } from "world-countries";

export const CRYPTO_COUNTRY_CCA2 = [
  "AR",
  "AU",
  "BR",
  "CL",
  "DE",
  "ES",
  "GB",
  "IL",
  "IN",
  "IT",
  "KR",
  "SG",
  "TH",
  "TR",
  "TW",
  "VN",
  "ZA",
] as const;

const CCA2_TO_QURE_ICON: Record<string, string> = {
  AR: "Argentina",
  AU: "Australia",
  BR: "Brazil",
  CA: "Canada",
  CN: "China",
  DE: "Germany",
  EG: "Egypt",
  FI: "Finland",
  FR: "France",
  HK: "Hong_Kong",
  IN: "India",
  JP: "Japan",
  KR: "Korea",
  MO: "Macao",
  MY: "Malaysia",
  PH: "Philippines",
  RU: "Russia",
  SG: "Singapore",
  TH: "Thailand",
  TR: "Turkey",
  TW: "Taiwan",
  UA: "Ukraine",
  UN: "United_Nations",
  US: "United_States",
};

export function iconFromCountry(country: Country): string {
  const qureIcon: string | undefined = CCA2_TO_QURE_ICON[country.cca2];
  if (qureIcon) {
    return `https://cdn.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/${qureIcon}.png`;
  }
  return [
    twemoji.base,
    twemoji.size,
    "/",
    twemoji.convert.toCodePoint(country.flag),
    twemoji.ext,
  ].join("");
}
