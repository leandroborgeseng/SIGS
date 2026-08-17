# Nomenclatura do financiamento APS (2026) — Previne acabou; regras de indicador já são outras

**Registrado:** 2026-08-17  
**Pergunta:** o programa ainda se chama Previne Brasil? As regras (indicadores, denominadores, LEDI/SISAB) também mudaram?  
**Resposta curta:** **não se chama mais Previne.** Nome jurídico = **cofinanciamento federal do Piso da APS** (Portaria GM/MS nº 3.493/2024). Regras de **pagamento: sim, mudaram**. Códigos **C1–C7 / B1–B6 / M\* / CR\*** do SIGS já são os **novos** (não os 7 do Previne). **Envio LEDI tipos 2–14 continua**; o canal passou a ser **Siaps**.

---

## 1. Nome atual (não confundir)

| Camada | Nome | Fonte |
|---|---|---|
| **Jurídico / portaria** | Nova metodologia de **cofinanciamento federal do Piso de Atenção Primária à Saúde (APS)** — altera a Portaria de Consolidação GM/MS nº 6/2017 | [Portaria GM/MS nº 3.493/2024](https://bvsms.saude.gov.br/bvs/saudelegis/gm/2024/prt3493_11_04_2024.html) · [FAQ SAPS](https://www.gov.br/saude/pt-br/composicao/saps/esf/faq-novo-modelo-de-cofinanciamento-federal-da-aps) |
| **Política** | **PNAB** continua; não houve “novo PAB” clássico nem “APS Mais” como substituto legal | Consolidação nº 6/2017 |
| **Comunicação** | **Saúde Brasil 360** — estratégia citada pelo FNS (cartilha 2026) e por municípios; **não** é o título da 3.493 | [Cartilha FNS 2026](https://portalfns.saude.gov.br/wp-content/uploads/2026/02/CARTILHA_2026.pdf) |
| **Encerrado** | **Previne Brasil** (Portaria nº 2.979/2019) — vigente **até** a 3.493/2024 | [Dados Abertos SUS](https://dadosabertos.saude.gov.br/dataset/indicadores_desempenho_sisab) |

O Previne **não foi rebatizado 1:1**: foi **substituído**. Capitação ponderada + 7 indicadores de desempenho saíram; entraram **componente fixo (IED)**, **vínculo e acompanhamento territorial** e **qualidade** (indicadores novos).

---

## 2. Indicadores: o que mudou vs o que o SIGS já tem

Os **7 indicadores do Previne** (pré-natal 6 consultas, sífilis/HIV, odonto gestante, citopatológico, vacina criança, HAS, DM) estão **descontinuados** no SISAB.

Os códigos **C1–C7, B1–B6, M1–M2** (e **CR\*** eCR) são do **componente de qualidade atual** ([CONASEMS](https://portal.conasems.org.br/noticias/1116_webserie-explica-novos-indicadores-de-cofinanciamento-federal-da-aps) · [fichas técnicas SAPS](https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/fichas-tecnicas/equipe-de-atencao-primaria-e-saude-da-familia) · Portaria GM/MS nº 6.907/2025). **`docs/conhecimento/14-indicadores-aps-previne-brasil.md` já descreve esses códigos** (guia CONASEMS jul/2026) — o gap é **nome “Previne”**, não fórmula antiga.

**NT 30/2025** (vínculo pessoa↔equipe; cadastro 30% + acompanhamento 70%) é do **modelo novo**, não da NT antiga do Previne. O SIGS já cita NT 30/2025.

---

## 3. Envio (quase o mesmo) vs pagamento (outro)

| Não mudou de essência | Mudou |
|---|---|
| LEDI / XML tipos **2–14** (cadastro, FAI, FAO, coletivo, PROC, visita, AD, vacina…) | **Fórmula de pagamento** (3 componentes + IED + faixas Ótimo/Bom/Suficiente/Regular) |
| Prazo ~**10º dia útil** da competência | Destino da produção: **Siaps** substitui o SISAB ([Portaria GM/MS nº 7.639/2025](https://bvsms.saude.gov.br/bvs/saudelegis/gm/2025/prt7639_22_07_2025.html)) |
| Identificação CNS/CPF, CNES, CBO, INE | LEDI/e-SUS com versão **>12 meses** invalida no Siaps a partir de **01/01/2026** ([NT 12/2025](https://sisaps.saude.gov.br/sistemas/esusaps/assets/files/NT_12-2025_criterio_validacao_dados_siaps-0394bed57dc6efcddaa83dab337f9533.pdf)) |

Transição de **efeito financeiro** das faixas: proteção “bom” em 2026; implantação plena citada para **1º quadrimestre de 2027** (Portaria GM/MS nº 10.994/2026 — DOU 14/05/2026; texto reproduzido na imprensa especializada; HTML BVS não recuperado neste registro).

---

## 4. Gap SIGS e o que fazer

O produto ainda fala **“Previne”** em badges, ajuda (`siaps-vs-previne`), registry LEDI, `STATUS.md` e docs 14/15. **As regras C\*/B\*/M\*/CR\* e o eixo Siaps × indicador já são do modelo 3.493.** Motor de indicadores e fórmula de **R$** (IED / faixas pagas) **não** estão implementados.

**Recomendação:**

1. **Renomear na UI/ajuda** — badge laranja `Previne` → `Indicador` (ou `Qualidade APS`). Manter eixo A **Siaps** vs eixo B **indicador**. Evitar “Saúde Brasil 360” como nome legal.
2. **Não reescrever C1–C7/B1–B6** como se fossem os 7 do Previne — já não são.
3. **Atualizar títulos** dos docs 14/15 e desta nota; motor de **pagamento** só quando houver spec de IED/faixas (fora do MVP de correção LEDI).

---

## Links oficiais (consulta 17/08/2026)

- [Portaria GM/MS nº 3.493/2024](https://bvsms.saude.gov.br/bvs/saudelegis/gm/2024/prt3493_11_04_2024.html)
- [FAQ SAPS — novo modelo](https://www.gov.br/saude/pt-br/composicao/saps/esf/faq-novo-modelo-de-cofinanciamento-federal-da-aps)
- [Dados Abertos — Previne encerrado na 3.493](https://dadosabertos.saude.gov.br/dataset/indicadores_desempenho_sisab)
- [Fichas C1–C7 + NT 30/2025](https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/fichas-tecnicas/equipe-de-atencao-primaria-e-saude-da-familia)
- [NT 30/2025 PDF](https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/notas-tecnicas/2025/nota-tecnica-no-30-2025-cgesco-desco-saps-ms.pdf)
- [Portaria GM/MS nº 6.907/2025](https://bvsms.saude.gov.br/bvs/saudelegis/gm/2025/prt6907_08_05_2025.html) (temas dos indicadores)
- [Portaria GM/MS nº 7.639/2025](https://bvsms.saude.gov.br/bvs/saudelegis/gm/2025/prt7639_22_07_2025.html) (Siaps)
- [Calendário Siaps 2026](https://sisaps.saude.gov.br/sistemas/siaps/docs/manual/calendario-siaps/)
- [CONASEMS — 15 indicadores](https://portal.conasems.org.br/noticias/1116_webserie-explica-novos-indicadores-de-cofinanciamento-federal-da-aps)
