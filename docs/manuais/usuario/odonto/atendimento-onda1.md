# Atendimento odontológico — Onda 1 (stub usuário)

**Tela:** `/odonto` (lista) · `/odonto/[id]` (ficha)  
**API:** `POST/PATCH/GET /v1/dental-encounters` · `GET .../preview-fao` · `POST .../finish`  
**Desenho:** `docs/planejamento/desenho-atendimento-odontologico.md`

## Como usar

1. Selecione unidade e paciente → **Abrir atendimento** (tipo padrão **5**).
2. Preencha: vigilância ≥1, CIAP/CID ≥1, conduta ≥1, fornecimentos (opcional), local/turno/gestante.
3. **Validar agora** — painel lista BLOCKERs LEDI.
4. **Finalizar e faturar** — só grava se zero BLOCKER (`enforceFaoConformity`).
5. Lote XML legado continua em `/odonto/lote`.

## Parametrização

| Env | Default Franca | Outra cidade |
|---|---|---|
| `REQUIRE_INE_DENTAL_OPEN` | `true` (prod) | `false` se não usar eSB |
| `DENTAL_DEFAULT_TIPO_ATENDIMENTO` | `5` | conforme protocolo |
| `MUNICIPIO_IBGE` | `3516200` | IBGE local |

## RF cobertos (parcial Onda 1)

RF-12.2, 12.3, 12.5, 12.6, 12.7, 12.8 (fornecimentos), 12.9 · LEDI FAO Siaps.
