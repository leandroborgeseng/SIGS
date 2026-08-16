/**
 * Seed versionado TB_IMUNOBIOLOGICO / faixas — gerado a partir de seeds/*.json
 * Fonte LEDI: dicionário oficial e-SUS AB (sem dados de pacientes).
 * Não editar à mão: regenerar a partir dos JSON em seeds/.
 */

import type { AgeRange, CatalogOpt } from './catalog.types';

export const CATALOG_VERSION = 'ledi-dictionary-v3+faixa-etaria-seed-v3' as const;
export const IMMUNO_SEED_META = {
  version: 'ledi-dictionary-v3',
  source: "https://integracao.esusab.ufsc.br/ledi/documentacao/referencias/dicionario.html#Imunobiologico",
  table: 'TB_IMUNOBIOLOGICO',
  count: 99,
} as const;
export const AGE_SEED_META = {
  version: 'faixa-etaria-seed-v3',
  source: "calendario-basico-PNI + aproximação municipal (≠ dump TB_FAIXA_ETARIA_VACINACAO e-SUS)",
  table: 'TB_FAIXA_ETARIA_VACINACAO',
  count: 54,
} as const;

export const IMMUNOBIOLOGICALS_SEED: CatalogOpt[] = [
  {
    "id": "IGHAT",
    "code": "IGHAT",
    "label": "Imunoglobulina humana antitétano",
    "lediId": 1
  },
  {
    "id": "SAT",
    "code": "SAT",
    "label": "Soro antitetânico",
    "lediId": 2
  },
  {
    "id": "SAAR",
    "code": "SAAR",
    "label": "Soro antiaracnídico (Loxosceles, Phoneutria, Tityus)",
    "lediId": 3
  },
  {
    "id": "SAESC",
    "code": "SAESC",
    "label": "Soro antiescorpiônico",
    "lediId": 4
  },
  {
    "id": "DT_INF",
    "code": "DT",
    "label": "Vacina difteria e tétano infantil",
    "lediId": 5
  },
  {
    "id": "SAELA",
    "code": "SAELA",
    "label": "Soro antielapídico",
    "lediId": 6
  },
  {
    "id": "SAR",
    "code": "SAR",
    "label": "Soro antirrábico",
    "lediId": 7
  },
  {
    "id": "SABR",
    "code": "SABR",
    "label": "Soro antibotrópico (pentavalente)",
    "lediId": 8
  },
  {
    "id": "HB",
    "code": "HB",
    "label": "Vacina hepatite B",
    "lediId": 9
  },
  {
    "id": "SAD",
    "code": "SAD",
    "label": "Soro antidiftérico",
    "lediId": 10
  },
  {
    "id": "SABC",
    "code": "SABC",
    "label": "Soro antibotrópico (pentavalente) e anticrotálico",
    "lediId": 11
  },
  {
    "id": "SABL",
    "code": "SABL",
    "label": "Soro antibotrópico (pentavalente) e antilaquético",
    "lediId": 12
  },
  {
    "id": "MENINGO_AC",
    "code": "Meningo AC",
    "label": "Vacina meningocócica AC",
    "lediId": 13
  },
  {
    "id": "FA",
    "code": "VFA",
    "label": "Vacina febre amarela",
    "lediId": 14
  },
  {
    "id": "BCG",
    "code": "BCG",
    "label": "Vacina BCG",
    "lediId": 15
  },
  {
    "id": "SAC",
    "code": "SAC",
    "label": "Soro anticrotálico",
    "lediId": 16
  },
  {
    "id": "HIB",
    "code": "Hib",
    "label": "Vacina Hib",
    "lediId": 17
  },
  {
    "id": "VR",
    "code": "VR",
    "label": "Vacina raiva embrião de galinha",
    "lediId": 18
  },
  {
    "id": "IGHAVZ",
    "code": "IGHAVZ",
    "label": "Imunoglobulina humana antivaricela",
    "lediId": 19
  },
  {
    "id": "IGHAHB",
    "code": "IGHAHB",
    "label": "Imunoglobulina humana anti-hepatite B",
    "lediId": 20
  },
  {
    "id": "PNEUMO23",
    "code": "VPP23",
    "label": "Vacina pneumo 23",
    "lediId": 21
  },
  {
    "id": "VIP",
    "code": "VIP",
    "label": "Vacina polio injetável",
    "lediId": 22
  },
  {
    "id": "IGHAR",
    "code": "IGHAR",
    "label": "Imunoglobulina humana antirrábica",
    "lediId": 23
  },
  {
    "id": "SCR",
    "code": "SCR",
    "label": "Vacina sarampo, caxumba, rubéola",
    "lediId": 24
  },
  {
    "id": "DT",
    "code": "dT",
    "label": "Vacina difteria e tétano adulto",
    "lediId": 25
  },
  {
    "id": "VPC10",
    "code": "VPC10",
    "label": "Vacina pneumo 10",
    "lediId": 26
  },
  {
    "id": "VOPB",
    "code": "VOPb",
    "label": "vacina oral poliomielite bivalente",
    "lediId": 28
  },
  {
    "id": "PENTA_ACELULAR",
    "code": "PENTA acelular",
    "label": "Vacina penta acelular (DTPa/VIP/Hib)",
    "lediId": 29
  },
  {
    "id": "FTP",
    "code": "FTp",
    "label": "Vacina febre tifóide",
    "lediId": 30
  },
  {
    "id": "SALOX",
    "code": "SALOX",
    "label": "Soro antiloxoscélico (trivalente)",
    "lediId": 31
  },
  {
    "id": "SALON",
    "code": "SALON",
    "label": "Soro antilonômico",
    "lediId": 32
  },
  {
    "id": "INF3",
    "code": "INF3",
    "label": "Vacina influenza trivalente",
    "lediId": 33
  },
  {
    "id": "VZ",
    "code": "VZ",
    "label": "Vacina varicela",
    "lediId": 34
  },
  {
    "id": "HA",
    "code": "HA",
    "label": "Vacina hepatite A",
    "lediId": 35
  },
  {
    "id": "SR",
    "code": "SR",
    "label": "Vacina Dupla Viral",
    "lediId": 36
  },
  {
    "id": "VERO",
    "code": "Vero",
    "label": "Vacina raiva",
    "lediId": 37
  },
  {
    "id": "SBOTULTRI",
    "code": "SBOTULTRI",
    "label": "Soro antibotulínico (trivalente)",
    "lediId": 38
  },
  {
    "id": "TETRA",
    "code": "Tetra",
    "label": "Vacina DTP/Hib",
    "lediId": 39
  },
  {
    "id": "PNCC7V",
    "code": "Pncc7V",
    "label": "Vacina pneumocócica 7V",
    "lediId": 40
  },
  {
    "id": "MENC",
    "code": "MenC",
    "label": "Vacina meningo C",
    "lediId": 41
  },
  {
    "id": "PENTA",
    "code": "PENTA",
    "label": "Vacina penta (DTP/HepB/Hib)",
    "lediId": 42
  },
  {
    "id": "HEXA",
    "code": "Hexa acelular",
    "label": "Vacina hexa (DTPa/HepB/VIP/Hib)",
    "lediId": 43
  },
  {
    "id": "INFH1N1_2009",
    "code": "INFH1N1-2009",
    "label": "Vacina influenza A (H1N1) (inativada, fragmentada)",
    "lediId": 44
  },
  {
    "id": "ROTA",
    "code": "ROTA",
    "label": "Vacina rotavírus",
    "lediId": 45
  },
  {
    "id": "DTP",
    "code": "DTP",
    "label": "Vacina DTP",
    "lediId": 46
  },
  {
    "id": "DTPA",
    "code": "DTPa",
    "label": "Vacina DTPa infantil",
    "lediId": 47
  },
  {
    "id": "FTA",
    "code": "Fta",
    "label": "Vacina febre tifóide (atenuada)",
    "lediId": 51
  },
  {
    "id": "HAINF",
    "code": "HAinf",
    "label": "Vacina hepatite A infantil",
    "lediId": 55
  },
  {
    "id": "SCRV",
    "code": "SCRV",
    "label": "Vacina sarampo, caxumba, rubéola e varicela",
    "lediId": 56
  },
  {
    "id": "DTPA_57",
    "code": "dTpa",
    "label": "Vacina dTpa adulto",
    "lediId": 57
  },
  {
    "id": "DTPA_VIP",
    "code": "DTPa/VIP",
    "label": "Vacina tetra acelular DTPa/VIP",
    "lediId": 58
  },
  {
    "id": "VPC13",
    "code": "VPC13",
    "label": "Vacina pneumo 13",
    "lediId": 59
  },
  {
    "id": "HPV2",
    "code": "HPV2",
    "label": "Vacina HPV bivalente",
    "lediId": 60
  },
  {
    "id": "TT",
    "code": "TT",
    "label": "Vacina toxóide tetânico",
    "lediId": 61
  },
  {
    "id": "HA_HBINF",
    "code": "HA-HBinf",
    "label": "Vacina hepatite A e B infantil",
    "lediId": 62
  },
  {
    "id": "HA_HBAD",
    "code": "HA-HBad",
    "label": "Vacina hepatite A e B adulto",
    "lediId": 63
  },
  {
    "id": "INF3_ID",
    "code": "INF3-ID",
    "label": "Vacina influenza trivalente ID",
    "lediId": 64
  },
  {
    "id": "ROTA5",
    "code": "ROTA5",
    "label": "Vacina rotavírus pentavalente",
    "lediId": 65
  },
  {
    "id": "MEN_BC",
    "code": "MEN BC",
    "label": "Vacina meningocócica B/C",
    "lediId": 66
  },
  {
    "id": "HPV4",
    "code": "HPV4",
    "label": "Vacina HPV quadrivalente",
    "lediId": 67
  },
  {
    "id": "SAB",
    "code": "SAB",
    "label": "Soro antibotulínico AB (bivalente)",
    "lediId": 69
  },
  {
    "id": "SARAMPO",
    "code": "Sarampo",
    "label": "Vacina sarampo",
    "lediId": 70
  },
  {
    "id": "RUBEOLA",
    "code": "Rubeola",
    "label": "Vacina rubéola",
    "lediId": 71
  },
  {
    "id": "GRIPE_SAZONAL",
    "code": "Gripe Sazonal",
    "label": "Vacina gripe",
    "lediId": 72
  },
  {
    "id": "QUADRUPLA_VIRAL",
    "code": "Quadrupla Viral",
    "label": "Vacina quádrupla viral",
    "lediId": 73
  },
  {
    "id": "MENACWY",
    "code": "MenACWY",
    "label": "Vacina meningo ACWY",
    "lediId": 74
  },
  {
    "id": "VCO",
    "code": "VCO",
    "label": "Vacina cólera oral",
    "lediId": 75
  },
  {
    "id": "VHZ",
    "code": "VHZ",
    "label": "Vacina herpes-zóster (atenuada)",
    "lediId": 76
  },
  {
    "id": "INF4",
    "code": "INF4",
    "label": "Vacina influenza tetravalente",
    "lediId": 77
  },
  {
    "id": "MENB",
    "code": "MenB",
    "label": "Vacina meningo B",
    "lediId": 78
  },
  {
    "id": "DENGUE_REC",
    "code": "Dengue",
    "label": "Vacina dengue (recombinante e atenuada)",
    "lediId": 82
  },
  {
    "id": "HAAD",
    "code": "HAad",
    "label": "Vacina hepatite A adulto",
    "lediId": 83
  },
  {
    "id": "VFA_F",
    "code": "VFA-F",
    "label": "Vacina febre amarela fracionada",
    "lediId": 84
  },
  {
    "id": "COVID_19_ASTRAZENECA_FIOCRUZ_COVISHIELD",
    "code": "COVID-19 ASTRAZENECA/FIOCRUZ - COVISHIELD",
    "label": "Vacina COVID-19-recombinante, AstraZeneca/Fiocruz (Covishield)",
    "lediId": 85
  },
  {
    "id": "COVID_CORONAVAC",
    "code": "COVID-19 SINOVAC/BUTANTAN - CORONAVAC",
    "label": "Vacina COVID-19-inativada, Sinovac/Butantan (Coronavac)",
    "lediId": 86
  },
  {
    "id": "COVID",
    "code": "COVID-19 PFIZER - COMIRNATY",
    "label": "Vacina COVID-19-RNAm, Pfizer (Comirnaty)",
    "lediId": 87
  },
  {
    "id": "COVID_19_JANSSEN_AD26_COV2_S",
    "code": "COVID-19 JANSSEN - Ad26.COV2.S",
    "label": "Vacina COVID-19-recombinante, Janssen (Ad26.COV2.S)",
    "lediId": 88
  },
  {
    "id": "COVID_19_ASTRAZENECA_CHADOX1_S",
    "code": "COVID-19 ASTRAZENECA - ChAdOx1-S",
    "label": "Vacina COVID-19-recombinante, AstraZeneca/Covax (ChAdOx1-S)",
    "lediId": 89
  },
  {
    "id": "HPV9",
    "code": "HPV9",
    "label": "Vacina HPV nonavalente",
    "lediId": 93
  },
  {
    "id": "COVID_19_MODERNA_SPIKEVAX",
    "code": "COVID-19 MODERNA - SPIKEVAX",
    "label": "vacina COVID-19-RNAm, Moderna (Spikevax)",
    "lediId": 97
  },
  {
    "id": "COVID_19_SINOVAC_CORONAVAC",
    "code": "COVID-19 SINOVAC - CORONAVAC",
    "label": "Vacina COVID-19-inativada, Sinovac (Coronavac)",
    "lediId": 98
  },
  {
    "id": "COVID_PED",
    "code": "COVID-19 PFIZER - COMIRNATY PEDIÁTRICA",
    "label": "Vacina COVID-19-RNAm, Pfizer (Comirnaty) pediátrica",
    "lediId": 99
  },
  {
    "id": "VVS",
    "code": "VVS",
    "label": "Vacina varíola símia (atenuada)",
    "lediId": 100
  },
  {
    "id": "VHZR",
    "code": "VHZR",
    "label": "Vacina Herpes-Zoster (recombinante)",
    "lediId": 101
  },
  {
    "id": "COVID_19_PFIZER_COMIRNATY_PEDIATRICA_MENOR_DE_5_ANOS",
    "code": "COVID-19 PFIZER - COMIRNATY PEDIÁTRICA MENOR DE 5 ANOS",
    "label": "Vacina COVID-19-RNAm, Pfizer (Comirnaty) pediátrica menor de 5 anos",
    "lediId": 102
  },
  {
    "id": "COVID_19_PFIZER_COMIRNATY_BIVALENTE",
    "code": "COVID-19 PFIZER - COMIRNATY BIVALENTE",
    "label": "Vacina COVID-19-RNAm, Pfizer (Comirnaty) bivalente",
    "lediId": 103
  },
  {
    "id": "DENGUE",
    "code": "DNG",
    "label": "Vacina dengue (atenuada)",
    "lediId": 104
  },
  {
    "id": "COVID_19_MODERNA_SPIKEVAX_BIVALENTE",
    "code": "COVID-19 MODERNA - SPIKEVAX BIVALENTE",
    "label": "Vacina Covid-19-RNAm, Moderna (Spikevax) bivalente",
    "lediId": 105
  },
  {
    "id": "VPC15",
    "code": "VPC15",
    "label": "Vacina pneumo 15",
    "lediId": 106
  },
  {
    "id": "VPC20",
    "code": "VPC20",
    "label": "Vacina Pneumo 20",
    "lediId": 107
  },
  {
    "id": "VVSR_REC",
    "code": "VVSR-Rec",
    "label": "Vacina Vírus Sincicial Respiratório A e B (recombinante)",
    "lediId": 108
  },
  {
    "id": "VVSR_RECADJ",
    "code": "VVSR-RecAdj",
    "label": "Vacina vírus sincicial respiratório (recombinante, adjuvada)",
    "lediId": 109
  },
  {
    "id": "INF4_ALTA_DOSAGEM",
    "code": "INF4-alta dosagem",
    "label": "Vacina Influenza Tetravalente - Alta Dosagem",
    "lediId": 110
  },
  {
    "id": "DTPA_VIP_111",
    "code": "dTpa/VIP",
    "label": "Vacina Tetra Acelular dTpa/VIP",
    "lediId": 111
  },
  {
    "id": "COVID_19_SERUM_ZALIKA",
    "code": "COVID-19 SERUM/ZALIKA",
    "label": "Vacina Covid-19-recombinante, Serum/Zalika",
    "lediId": 112
  },
  {
    "id": "CHIK_A",
    "code": "CHIK-A",
    "label": "Vacina chikungunya (recombinante e atenuada)",
    "lediId": 113
  },
  {
    "id": "COVID_19_SINOPHARM",
    "code": "COVID-19 SINOPHARM",
    "label": "Vacina Covid-19-inativada, Sinopharm",
    "lediId": 114
  },
  {
    "id": "NIRSEVIMABE_0_5ML",
    "code": "NIRSEVIMABE 0,5ml",
    "label": "Nirsevimabe 0,5ml",
    "lediId": 115
  },
  {
    "id": "NIRSEVIMABE_1_0ML",
    "code": "NIRSEVIMABE 1,0ml",
    "label": "Nirsevimabe 1,0ml",
    "lediId": 116
  }
];

export const AGE_RANGES_SEED: AgeRange[] = [
  {
    "immunobiologicalId": "BCG",
    "minDays": 0,
    "maxDays": 1825,
    "label": "BCG: 0–5 anos (catch-up básico)"
  },
  {
    "immunobiologicalId": "HB",
    "minDays": 0,
    "maxDays": null,
    "label": "Hepatite B: desde o nascimento"
  },
  {
    "immunobiologicalId": "ROTA",
    "minDays": 42,
    "maxDays": 245,
    "label": "Rotavírus: ~6 sem–8 meses"
  },
  {
    "immunobiologicalId": "ROTA5",
    "minDays": 42,
    "maxDays": 245,
    "label": "Rotavírus penta: ~6 sem–8 meses"
  },
  {
    "immunobiologicalId": "PENTA",
    "minDays": 60,
    "maxDays": 2555,
    "label": "Penta: ~2 meses–7 anos"
  },
  {
    "immunobiologicalId": "HEXA",
    "minDays": 60,
    "maxDays": 2555,
    "label": "Hexa: ~2 meses–7 anos"
  },
  {
    "immunobiologicalId": "PENTA_ACELULAR",
    "minDays": 60,
    "maxDays": 2555,
    "label": "Penta acelular: ~2 meses–7 anos"
  },
  {
    "immunobiologicalId": "VIP",
    "minDays": 60,
    "maxDays": null,
    "label": "VIP: a partir de ~2 meses"
  },
  {
    "immunobiologicalId": "VOPB",
    "minDays": 60,
    "maxDays": 1825,
    "label": "VOPb: ~2 meses–5 anos"
  },
  {
    "immunobiologicalId": "VPC10",
    "minDays": 60,
    "maxDays": 1825,
    "label": "Pneumo 10: ~2 meses–5 anos"
  },
  {
    "immunobiologicalId": "VPC13",
    "minDays": 60,
    "maxDays": 1825,
    "label": "Pneumo 13: ~2 meses–5 anos (seed)"
  },
  {
    "immunobiologicalId": "VPC15",
    "minDays": 60,
    "maxDays": null,
    "label": "Pneumo 15: a partir de ~2 meses (seed)"
  },
  {
    "immunobiologicalId": "VPC20",
    "minDays": 60,
    "maxDays": null,
    "label": "Pneumo 20: a partir de ~2 meses (seed)"
  },
  {
    "immunobiologicalId": "MENC",
    "minDays": 90,
    "maxDays": null,
    "label": "Meningo C: a partir de ~3 meses"
  },
  {
    "immunobiologicalId": "MENB",
    "minDays": 60,
    "maxDays": null,
    "label": "Meningo B: a partir de ~2 meses (seed)"
  },
  {
    "immunobiologicalId": "MENACWY",
    "minDays": 4015,
    "maxDays": 5110,
    "label": "MenACWY: 11–14 anos (rotina seed)"
  },
  {
    "immunobiologicalId": "SCR",
    "minDays": 365,
    "maxDays": null,
    "label": "SCR: a partir de 12 meses"
  },
  {
    "immunobiologicalId": "SCRV",
    "minDays": 365,
    "maxDays": null,
    "label": "SCRV: a partir de 12 meses"
  },
  {
    "immunobiologicalId": "SR",
    "minDays": 365,
    "maxDays": null,
    "label": "Dupla viral: a partir de 12 meses"
  },
  {
    "immunobiologicalId": "VZ",
    "minDays": 365,
    "maxDays": null,
    "label": "Varicela: a partir de 12 meses"
  },
  {
    "immunobiologicalId": "HA",
    "minDays": 365,
    "maxDays": null,
    "label": "Hepatite A: a partir de 12 meses"
  },
  {
    "immunobiologicalId": "HAINF",
    "minDays": 365,
    "maxDays": 6570,
    "label": "Hepatite A infantil: 12 meses–17 anos (seed)"
  },
  {
    "immunobiologicalId": "HAAD",
    "minDays": 6570,
    "maxDays": null,
    "label": "Hepatite A adulto: ≥18 anos (seed)"
  },
  {
    "immunobiologicalId": "FA",
    "minDays": 274,
    "maxDays": null,
    "label": "Febre amarela: a partir de ~9 meses"
  },
  {
    "immunobiologicalId": "VFA_F",
    "minDays": 274,
    "maxDays": null,
    "label": "Febre amarela fracionada: a partir de ~9 meses"
  },
  {
    "immunobiologicalId": "DT_INF",
    "minDays": 60,
    "maxDays": 2554,
    "label": "DT infantil: ~2 meses–<7 anos"
  },
  {
    "immunobiologicalId": "DT",
    "minDays": 2555,
    "maxDays": null,
    "label": "dT: a partir de 7 anos"
  },
  {
    "immunobiologicalId": "DTPA",
    "minDays": 2555,
    "maxDays": null,
    "label": "dTpa: a partir de 7 anos"
  },
  {
    "immunobiologicalId": "DTP",
    "minDays": 60,
    "maxDays": 2555,
    "label": "DTP: ~2 meses–7 anos"
  },
  {
    "immunobiologicalId": "DTPA",
    "minDays": 60,
    "maxDays": 2555,
    "label": "DTPa infantil: ~2 meses–7 anos"
  },
  {
    "immunobiologicalId": "HIB",
    "minDays": 60,
    "maxDays": 1825,
    "label": "Hib: ~2 meses–5 anos"
  },
  {
    "immunobiologicalId": "TETRA",
    "minDays": 60,
    "maxDays": 2555,
    "label": "Tetra DTP/Hib: ~2 meses–7 anos"
  },
  {
    "immunobiologicalId": "HPV2",
    "minDays": 3285,
    "maxDays": 16425,
    "label": "HPV2: 9–45 anos (seed ampliado)"
  },
  {
    "immunobiologicalId": "HPV4",
    "minDays": 3285,
    "maxDays": 5475,
    "label": "HPV4: 9–14 anos (rotina seed)"
  },
  {
    "immunobiologicalId": "HPV9",
    "minDays": 3285,
    "maxDays": 16425,
    "label": "HPV9: 9–45 anos (seed)"
  },
  {
    "immunobiologicalId": "PNEUMO23",
    "minDays": 21900,
    "maxDays": null,
    "label": "Pneumo 23: ≥60 anos (rotina seed)"
  },
  {
    "immunobiologicalId": "INF3",
    "minDays": 180,
    "maxDays": null,
    "label": "Influenza: a partir de 6 meses"
  },
  {
    "immunobiologicalId": "INF4",
    "minDays": 180,
    "maxDays": null,
    "label": "Influenza tetra: a partir de 6 meses"
  },
  {
    "immunobiologicalId": "INF3_ID",
    "minDays": 6570,
    "maxDays": null,
    "label": "Influenza ID: ≥18 anos (seed)"
  },
  {
    "immunobiologicalId": "INF4_ALTA_DOSAGEM",
    "minDays": 21900,
    "maxDays": null,
    "label": "Influenza alta dose: ≥60 anos (seed)"
  },
  {
    "immunobiologicalId": "COVID",
    "minDays": 1825,
    "maxDays": null,
    "label": "COVID Pfizer: ≥5 anos (seed)"
  },
  {
    "immunobiologicalId": "COVID_PED",
    "minDays": 180,
    "maxDays": 1824,
    "label": "COVID pediátrica: 6 meses–<5 anos (seed)"
  },
  {
    "immunobiologicalId": "COVID_CORONAVAC",
    "minDays": 1095,
    "maxDays": null,
    "label": "Coronavac: ≥3 anos (seed)"
  },
  {
    "immunobiologicalId": "COVID_19_PFIZER_COMIRNATY_PEDIATRICA_MENOR_DE_5_ANOS",
    "minDays": 180,
    "maxDays": 1824,
    "label": "COVID Pfizer <5 anos: 6 meses–<5 anos"
  },
  {
    "immunobiologicalId": "DENGUE",
    "minDays": 1460,
    "maxDays": 21900,
    "label": "Dengue atenuada: 4–59 anos (seed)"
  },
  {
    "immunobiologicalId": "DENGUE_REC",
    "minDays": 1460,
    "maxDays": 21900,
    "label": "Dengue recombinante: 4–59 anos (seed)"
  },
  {
    "immunobiologicalId": "VHZ",
    "minDays": 18250,
    "maxDays": null,
    "label": "Herpes-zóster atenuada: ≥50 anos (seed)"
  },
  {
    "immunobiologicalId": "VHZR",
    "minDays": 18250,
    "maxDays": null,
    "label": "Herpes-zóster recombinante: ≥50 anos (seed)"
  },
  {
    "immunobiologicalId": "TT",
    "minDays": 2555,
    "maxDays": null,
    "label": "Toxóide tetânico: ≥7 anos (seed)"
  },
  {
    "immunobiologicalId": "VERO",
    "minDays": 0,
    "maxDays": null,
    "label": "Raiva Vero: qualquer idade (pós-exposição seed)"
  },
  {
    "immunobiologicalId": "VR",
    "minDays": 0,
    "maxDays": null,
    "label": "Raiva embrião: qualquer idade (seed)"
  },
  {
    "immunobiologicalId": "CHIK_A",
    "minDays": 6570,
    "maxDays": 21900,
    "label": "Chikungunya: 18–60 anos (seed)"
  },
  {
    "immunobiologicalId": "NIRSEVIMABE_0_5ML",
    "minDays": 0,
    "maxDays": 365,
    "label": "Nirsevimabe 0,5ml: <12 meses (seed)"
  },
  {
    "immunobiologicalId": "NIRSEVIMABE_1_0ML",
    "minDays": 0,
    "maxDays": 365,
    "label": "Nirsevimabe 1,0ml: <12 meses (seed)"
  }
];
