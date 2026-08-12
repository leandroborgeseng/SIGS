# Amostra “Novas Fichas Exemplo” (2026-08-12)

**Pasta local (não versionar):** `Downloads/SIGS-Exemplos/Novas Fichas Exemplo`  
**LGPD:** XMLs com CNS reais — só análise local.

## Composição (39 arquivos)

| Prefixo | Tipo LEDI | Qtd | Tratar em |
|---|---|---:|---|
| `atendimentoodontologico-*` | **FAO (5)** | 12 | Já coberto → `/odonto/lote` (ignorar nesta entrega) |
| `cadastroatendimentoindividual-*` | **FAI (4)** | 20 | **Novo** → `/aps/lote` |
| `cadastroprocedimentos-*` | **Procedimentos (7)** | 7 | **Novo** → `/procedimentos/lote` |

## Achados nesta amostra

### FAI (20)
- **100%** sem `stNaoPossuiCpf` → blocker auto-corrigível
- CNS presente em todas; CPF ausente
- CNES 7 dígitos ok
- INE ausente em ~4/20 (warn)
- Tag de local: `localDeAtendimento` (não `localAtendimento` da FAO)

### Procedimentos (7)
- **100%** sem `stNaoPossuiCpf`
- SIGTAP em `<procedimentos>`: `0301100039`, `0101040024` (ok; sem ABPG nesta amostra)
- INE/CNES/turno ok

### FAO (12)
- Mesmo padrão odonto já tratado (Previne + Siaps) — **não reimplementar** aqui.

## Correção automática disponível

1. `stNaoPossuiCpf=false` quando há CNS/CPF (FAO, FAI e Procedimentos).
2. Preencher INE se informado na UI.
3. FAO continua com CIAP/CBO/vigilância/Previne B1–B6.

## API

`POST /v1/dental/ledi/batches` com `expectedTipo: "FAI" | "PROCEDIMENTOS" | "FAO"`.
