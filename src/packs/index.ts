import type { FamilyPack, HardwareModel, SkuRecord, Source } from "@/domain/types";
import { ciscoMerakiMr } from "./cisco-meraki-mr";
import { ciscoDuo } from "./cisco-duo";
import { fortinetFortigate } from "./fortinet-fortigate";
import { paloaltoNgfw } from "./paloalto-ngfw";
import { arubaCentralAp } from "./aruba-central-ap";
import { huaweiWlan } from "./huawei-wlan";
import { watchguardFirebox } from "./watchguard-firebox";

/**
 * Registro de pacotes. Para incluir um fabricante novo, crie o arquivo do
 * pacote e adicione-o aqui. O motor e as telas não mudam.
 */
export const PACKS: FamilyPack[] = [
  ciscoMerakiMr,
  ciscoDuo,
  fortinetFortigate,
  paloaltoNgfw,
  arubaCentralAp,
  watchguardFirebox,
  huaweiWlan,
];

const byId = new Map(PACKS.map((p) => [p.id, p]));

export function getPack(id: string): FamilyPack | undefined {
  return byId.get(id);
}

export function normalizeSku(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const skuIndex = new Map<string, SkuRecord>();
for (const pack of PACKS) {
  for (const rec of pack.skus) {
    skuIndex.set(normalizeSku(rec.sku), rec);
    for (const a of rec.aliases ?? []) skuIndex.set(normalizeSku(a), rec);
  }
}

export function lookupSku(sku: string): SkuRecord | undefined {
  return skuIndex.get(normalizeSku(sku));
}

export function findHardware(pack: FamilyPack, model: string | undefined): HardwareModel | undefined {
  if (!model) return undefined;
  const m = normalizeSku(model);
  return pack.hardware.find((h) => normalizeSku(h.model) === m || h.skus.some((s) => normalizeSku(s) === m));
}

export function findSource(id: string): (Source & { packId: string }) | undefined {
  for (const p of PACKS) {
    const s = p.sources.find((x) => x.id === id);
    if (s) return { ...s, packId: p.id };
  }
  return undefined;
}

export interface VendorInfo {
  id: string;
  name: string;
  hasPack: boolean;
}

/**
 * Reconhece o fabricante pelo formato do part number, mesmo sem catálogo.
 * Permite separar "fabricante sem pacote" de "item desconhecido".
 */
const VENDOR_PATTERNS: { vendor: VendorInfo; re: RegExp }[] = [
  { vendor: { id: "cisco", name: "Cisco", hasPack: true }, re: /^(LIC-|DUO-|SVS-DUO|MR\d|MS\d{3}|MX\d|MV\d|MT\d|MG\d|CW9\d|C9\d{3}|CON-|E2SF|ISE-|L-ISE|C1-|N9K-|WS-C|AIR-)/ },
  { vendor: { id: "fortinet", name: "Fortinet", hasPack: true }, re: /^(FG-|FWF-|FC-?\d{1,2}-|FAP-|FS-\d|FAZ-|FMG-|FCT-|FSA-)/ },
  { vendor: { id: "paloalto", name: "Palo Alto Networks", hasPack: true }, re: /^PAN-/ },
  { vendor: { id: "hpe-aruba", name: "HPE Aruba Networking", hasPack: true }, re: /^(AP-\d{3}|Q9Y\d{2}AAE|J[LWXZ]\d{3}A|R[0-9][A-Z0-9]{2}\d{2}A|S[0-9][A-Z0-9]{3}A)/ },
  { vendor: { id: "huawei", name: "Huawei", hasPack: true }, re: /^(AIRENGINE|AP\d{4}[A-Z]{2}|N1-|S57\d{2}|S67\d{2}|USG\d|CE\d{4}|02\d{6}|88\d{6})/ },
  { vendor: { id: "watchguard", name: "WatchGuard", hasPack: true }, re: /^(WG[TM]?\d{4,6}|FIREBOX)/ },
  { vendor: { id: "checkpoint", name: "Check Point", hasPack: false }, re: /^(CP(AP|SB|SM|ES|AC)-|CPCES)/ },
  { vendor: { id: "sophos", name: "Sophos", hasPack: false }, re: /^(XGS?\d{3,4}|XG\d{2,3}|SOPHOS|XT[A-Z]{2}\d)/ },
  { vendor: { id: "juniper", name: "Juniper Networks", hasPack: false }, re: /^(SRX\d{3,4}|EX\d{4}|QFX\d{4}|JNP|MIST-|SUB-)/ },
  { vendor: { id: "extreme", name: "Extreme Networks", hasPack: false }, re: /^(XIQ-|AP\d{3}C-|5520-|X\d{3}-)/ },
];

export function detectVendor(sku: string): VendorInfo | undefined {
  const s = normalizeSku(sku);
  return VENDOR_PATTERNS.find((p) => p.re.test(s))?.vendor;
}

export const VENDOR_NAMES: Record<string, string> = Object.fromEntries(
  VENDOR_PATTERNS.map((p) => [p.vendor.id, p.vendor.name]),
);

export const ALL_VENDORS = VENDOR_PATTERNS.map((p) => p.vendor);
