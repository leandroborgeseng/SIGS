# Catálogo de erros LEDI FAO + Previne (linguagem simples)

**Atualizado:** 2026-08-12  

**Fonte na UI:** `apps/web/src/app/odonto/lote/error-catalog.ts`  

Textos pensados para o servidor municipal **leigo** em faturamento SUS.  

Severidades: **BLOCKER** (não envia) · **MONEY_RISK** (envia mas pode perder ponto/repasse) · **QUALITY_WARN** · **INFO**.

Para a lista completa e explicações “o que significa / o que fazer”, abra um lote em `/odonto/lote`, clique no alerta da ficha ou no gráfico.

### Glossário rápido Previne (saúde bucal)

| Indicador | Em português simples |
|---|---|
| **B1** | Quantas pessoas tiveram a **1ª consulta** odontológica programada (entrada no cuidado) |
| **B2** | Entre quem começou tratamento, quantos **concluíram** |
| **B3** | Quanto das ações são **extração** (ideal: menos extração, mais prevenção) |
| **B4** | Escovação supervisionada em **grupo** (não entra na ficha individual) |
| **B5** | Quanto do atendimento é **prevenção** (flúor, limpeza, orientação) |
| **B6** | Uso de **ART/TRA** quando há restauração |

### Campo que mais rejeita lote Franca

`ST_NAO_POSSUI_CPF` — o Ministério exige um campo **sim/não** dizendo se o cidadão tem CPF. Mesmo com cartão SUS (CNS), se o campo não existir no arquivo, o envio é rejeitado.
