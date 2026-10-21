import type { AnalysisItem, ResolvedItem, SkuRecord } from "@/domain/types";
import { PACKS, detectVendor, getPack, lookupSku, normalizeSku, findHardware } from "@/packs";

/** Sufixos que costumam aparecer em listas de clientes e não mudam o produto. */
const VARIANT_SUFFIXES = [/-R$/, /=$/, /-WW$/, /-RW$/, /-US$/, /-EU$/, /-BR$/];

function parseWithPacks(sku: string): SkuRecord | undefined {
  for (const pack of PACKS) {
    const parsed = pack.parseSku?.(sku);
    if (parsed) {
      return { ...parsed, status: parsed.status ?? "draft", sourceIds: parsed.sourceIds ?? [] } as SkuRecord;
    }
  }
  return undefined;
}

function vendorNameFor(id?: string): string | undefined {
  if (!id) return undefined;
  const pack = PACKS.find((p) => p.vendor === id);
  return pack?.vendorName ?? detectVendor(id)?.name;
}

/**
 * Normaliza e reconhece cada linha importada.
 * Estados: reconhecida, parcial, duplicada, inconsistente, não reconhecida.
 */
export function resolveItems(items: AnalysisItem[]): ResolvedItem[] {
  const serialSeen = new Map<string, string>();
  const rowSeen = new Map<string, number>();

  return items.map((item, index) => {
    const effectiveSku = normalizeSku(item.overrideSku || item.rawSku || "");
    const out: ResolvedItem = { ...item, effectiveSku, status: "unrecognized", category: "UNKNOWN" };

    let record = effectiveSku ? lookupSku(effectiveSku) : undefined;
    let note: string | undefined;
    let partial = false;

    if (!record && effectiveSku) record = parseWithPacks(effectiveSku);

    if (!record && effectiveSku) {
      for (const re of VARIANT_SUFFIXES) {
        if (!re.test(effectiveSku)) continue;
        const base = effectiveSku.replace(re, "");
        const hit = lookupSku(base) ?? parseWithPacks(base);
        if (hit) {
          record = hit;
          partial = true;
          note = `Reconhecido como ${hit.sku} (sufixo removido). Confirmar.`;
          break;
        }
      }
    }

    if (record) {
      out.record = record;
      out.familyId = record.familyId;
      out.vendor = record.vendor;
      out.vendorName = getPack(record.familyId)?.vendorName;
      out.category = record.category;
      out.model = record.model;
      out.status = partial ? "partial" : "recognized";
      if (!partial && record.kind !== "hardware" && record.model === undefined && getPack(record.familyId)?.metric === "HARDWARE_ATTACHED") {
        out.status = "partial";
        note = "Licença presa a equipamento, mas o modelo não está no catálogo.";
      }
      if (record.kind === "hardware") {
        const pack = getPack(record.familyId);
        if (pack && !findHardware(pack, record.model)) {
          note = note ?? "Modelo fora do catálogo do pacote. Ciclo de vida não confirmado.";
        }
      }
      if (!note && record.status === "draft") note = "Registro do catálogo em rascunho.";
      if (!note && record.legacy) note = `SKU antigo. Substituto: ${record.legacy.replacedBy}.`;
    } else if (effectiveSku) {
      const vendor = detectVendor(effectiveSku);
      if (vendor) {
        out.status = "partial";
        out.vendor = vendor.id;
        out.vendorName = vendor.name;
        note = vendor.hasPack
          ? `Fabricante ${vendor.name} identificado, mas o SKU não está no catálogo.`
          : `Fabricante ${vendor.name} identificado. Ainda não há pacote de catálogo para ele.`;
      }
    }

    if (!effectiveSku) {
      out.status = "inconsistent";
      note = "Linha sem SKU.";
    } else if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      out.status = "inconsistent";
      note = "Quantidade ausente ou inválida.";
    } else if (item.startDate && item.endDate && item.endDate < item.startDate) {
      out.status = "inconsistent";
      note = "Vencimento anterior ao início do contrato.";
    }

    if (out.status !== "inconsistent") {
      const serial = item.serial?.trim().toUpperCase();
      if (serial) {
        const prev = serialSeen.get(serial);
        if (prev) {
          out.status = "duplicate";
          note = `Número de série repetido (também em ${prev}).`;
        } else {
          serialSeen.set(serial, effectiveSku);
        }
      }
      // Linhas idênticas vindas do mesmo arquivo costumam ser cópia. Vão para revisão.
      const fileName = (item.sourceRef ?? "").replace(/,? linha \d+$/, "");
      const rowKey = [effectiveSku, item.quantity, serial ?? "", item.contractNumber ?? "", item.startDate ?? "", item.endDate ?? "", item.source, fileName].join("|");
      if (out.status !== "duplicate" && item.source !== "manual" && rowSeen.has(rowKey)) {
        out.status = "duplicate";
        note = `Linha idêntica à linha ${rowSeen.get(rowKey)! + 1}.`;
      } else {
        rowSeen.set(rowKey, index);
      }
    }

    out.statusNote = note;
    out.vendorName = out.vendorName ?? vendorNameFor(out.vendor);
    return out;
  });
}

/** Itens que entram nas regras: reconhecidos (ou parciais com registro), não ignorados. */
export function usable(i: ResolvedItem): boolean {
  return !i.ignored && !!i.record && (i.status === "recognized" || i.status === "partial");
}
