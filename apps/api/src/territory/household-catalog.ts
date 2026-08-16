/** Catálogo CDS domiciliar (códigos LEDI CadastroDomiciliar) — referência local, sem GIS. */

export const PROPERTY_TYPES = [
  { id: 1, label: 'Domicílio' },
  { id: 2, label: 'Comércio' },
  { id: 3, label: 'Terreno baldio' },
  { id: 4, label: 'Ponto estratégico' },
  { id: 5, label: 'Escola' },
  { id: 6, label: 'Creche' },
  { id: 7, label: 'Abrigo' },
  { id: 8, label: 'Instituição de longa permanência' },
  { id: 9, label: 'Unidade prisional' },
  { id: 10, label: 'Outros' },
  { id: 11, label: 'Domicílio indígena / aldeado' },
] as const;

export const LOCATION_TYPES = [
  { id: 1, label: 'Urbana' },
  { id: 2, label: 'Rural' },
] as const;

export const DWELLING_TYPES = [
  { id: 1, label: 'Casa' },
  { id: 2, label: 'Apartamento' },
  { id: 3, label: 'Cômodo' },
  { id: 4, label: 'Outro' },
] as const;

export const OWNERSHIP_STATUSES = [
  { id: 1, label: 'Próprio' },
  { id: 2, label: 'Financiado' },
  { id: 3, label: 'Alugado' },
  { id: 4, label: 'Arrendado' },
  { id: 5, label: 'Cedido' },
  { id: 6, label: 'Ocupação' },
  { id: 7, label: 'Outra' },
] as const;

export const WATER_SUPPLIES = [
  { id: 1, label: 'Rede encanada' },
  { id: 2, label: 'Poço / nascente' },
  { id: 3, label: 'Cisterna' },
  { id: 4, label: 'Outro' },
] as const;

export const WATER_CONSUMPTIONS = [
  { id: 1, label: 'Filtrada' },
  { id: 2, label: 'Fervida' },
  { id: 3, label: 'Clorada' },
  { id: 4, label: 'Mineral' },
  { id: 5, label: 'Sem tratamento' },
] as const;

export const SEWAGE_DISPOSALS = [
  { id: 1, label: 'Rede coletora' },
  { id: 2, label: 'Fossa séptica' },
  { id: 3, label: 'Fossa rudimentar' },
  { id: 4, label: 'Direto para rio/lago/mar' },
  { id: 5, label: 'Céu aberto' },
  { id: 6, label: 'Outra' },
] as const;

export const WASTE_DISPOSALS = [
  { id: 1, label: 'Coletado' },
  { id: 2, label: 'Queimado / enterrado' },
  { id: 3, label: 'Céu aberto' },
  { id: 4, label: 'Outro' },
] as const;

export const HOUSEHOLD_INCOME_CODES = [
  { id: 1, label: '1/4 salário mínimo' },
  { id: 2, label: '1/2 salário mínimo' },
  { id: 3, label: '1 salário mínimo' },
  { id: 4, label: '2 salários mínimos' },
  { id: 5, label: '3 salários mínimos' },
  { id: 6, label: '4 salários mínimos' },
  { id: 7, label: 'Mais de 4 salários mínimos' },
] as const;

export const FAMILY_RELATIONSHIPS = [
  { id: 'RESPONSAVEL', label: 'Responsável' },
  { id: 'CONJUGE', label: 'Cônjuge / companheiro(a)' },
  { id: 'FILHO', label: 'Filho(a)' },
  { id: 'OUTRO', label: 'Outro' },
] as const;

export function householdCatalog() {
  return {
    propertyTypes: PROPERTY_TYPES,
    locationTypes: LOCATION_TYPES,
    dwellingTypes: DWELLING_TYPES,
    ownershipStatuses: OWNERSHIP_STATUSES,
    waterSupplies: WATER_SUPPLIES,
    waterConsumptions: WATER_CONSUMPTIONS,
    sewageDisposals: SEWAGE_DISPOSALS,
    wasteDisposals: WASTE_DISPOSALS,
    householdIncomeCodes: HOUSEHOLD_INCOME_CODES,
    familyRelationships: FAMILY_RELATIONSHIPS,
  };
}

export function isValidPropertyType(n: number) {
  return PROPERTY_TYPES.some((p) => p.id === n);
}

export function isValidRelationship(r: string) {
  return FAMILY_RELATIONSHIPS.some((x) => x.id === r);
}
