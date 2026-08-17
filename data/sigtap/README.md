# SIGTAP — pacote local (offline)

O site `sigtap.datasus.gov.br` cai com frequência. O SIGS **não depende** dele em runtime: importe o ZIP/TXT já baixado.

## O que colocar aqui

| Arquivo | Uso |
|---|---|
| `TabelaUnificada_YYYYMM.zip` (oficial) | Preferido — contém `TB_PROCEDIMENTO.txt` |
| `TB_PROCEDIMENTO.txt` | Layout largura fixa DATASUS |
| `fixture-tb-procedimento-sample.txt` | Fixture sintética (~7 códigos APS) para smoke |
| `piloto-franca.json` | Stub JSON legado |
| `abpg-map-piloto.json` | Template ABPG→SIGTAP (preencher `sigtap`) |

**Não commitar** ZIPs oficiais completos (`*.zip` ignorado). Fixtures/README/JSON piloto ok.

## Como obter o ZIP (quando o site falha)

1. **Portal SIGTAP** (quando no ar): [sigtap.datasus.gov.br](http://sigtap.datasus.gov.br) → Download → competência mensal → ZIP com TXT.
2. **FTP / Chrome**: a área de download usa FTP; Chrome moderno bloqueia — use Firefox, cliente FTP ou outro navegador com FTP, ou baixe em máquina que ainda consiga.
3. **Espelhos / TI estadual / consórcio**: peça a competência mensal (`TabelaUnificada_YYYYMM.zip`) ao setor de faturamento/SIA que já tenha o pacote.
4. **SIGTAP Desktop**: mesmo portal (aba Desktop) — os TXT da competência são os mesmos.
5. **Fallback imediato no SIGS**: `npm run sync:sigtap -- --seed` ou a fixture sample (não substitui a tabela MS completa).

Competência = mês de vigência (`YYYYMM`). Atualize quando o município fechar o BPA/LEDI daquele mês.

## Como importar no SIGS

```bash
# Descobre automaticamente ZIP/TXT/JSON em data/sigtap/
npm run sync:sigtap

# Arquivo explícito
npm run sync:sigtap -- --file=data/sigtap/TabelaUnificada_202608.zip --competencia=202608

# Só catálogo piloto (~27 códigos)
npm run sync:sigtap -- --seed --force
```

UI: **Gestão → SIGTAP** (`/sigtap`) — upload ZIP/TXT/CSV · ou botão “Importar pasta local”.

API:

| Método | Rota |
|---|---|
| POST | `/api/v1/sigtap/import-file` (multipart `file`) |
| POST | `/api/v1/sigtap/import-local` |
| POST | `/api/v1/sigtap/import-ms` (JSON `{ content }`) |
| GET | `/api/v1/sigtap/offline-status` |
| GET | `/api/v1/sigtap/abpg-map` |

## Faturamento APS (o que valida)

- Catálogo `sigtap_procedures` (código 10 dígitos, nome, competência, `source`: seed\|import\|ms)
- Auditoria: `SIGTAP_UNKNOWN` / `SIGTAP_INACTIVE` / `SIGTAP_COMPETENCIA`
- Lote PROC (tipo 7): `PROC_CODE_ABPG` se vier `ABPGxxx` — use o mapa + repair na ficha
- BPA: `enrichProcedureCodes` marca known/unknown
