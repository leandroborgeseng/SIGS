# Manual técnico — LEDI enums + lotação no header

**Versão:** 0.1.0-dev  
**RF:** RF-10.3, RF-10.20 (Obr / e-SUS) · RF-2.60 (lotação)  
**Fonte:** e-SUS 5.5.24 DbEnum (specs neutras; reimplementação Nest)

## O que mudou

| Antes | Agora |
|---|---|
| Header só CNES + CNS + INE | + `cboCodigo_2002` e `lotacaoFormPrincipal` |
| Condutas/turno/local como texto | ids numéricos LEDI + labels auxiliares |
| Sem catálogo de enums | `GET /v1/ledi/enums` |

## Resolução de lotação

Ordem: `assignmentId` → lotação ativa (profissional + unidade, preferindo `teamId`) → `cbo` no body.

Campos emitidos:

```json
"headerTransport": {
  "profissionalCNS": "…",
  "cboCodigo_2002": "225125",
  "cnes": "9999999",
  "ine": "0000000001",
  "lotacaoFormPrincipal": { "profissionalCNS": "…", "cboCodigo_2002": "225125", "cnes": "…", "ine": "…" }
}
```

## Aliases úteis (UI → id)

| Campo | Exemplo UI | id |
|---|---|---|
| turno | `MANHA` / `MORNING` | 1 |
| conduta | `ALTA` | 9 |
| local | `UBS` | 1 |
| tipo | `CONSULTA` | 2 |
| sexo | `F` / `FEMALE` | 1 |

IBGE município: env `SIGS_IBGE_MUNICIPIO` (opcional no header).

## Teste de faturamento

1. Garantir lotação em `/lotacoes`.  
2. Finalizar atendimento com `outcomes: ["ALTA"]`.  
3. `GET /v1/production/preflight` — sem `CBO_MISSING` / sem `LEDI_ENUM_STRING`.  
4. `GET /v1/production/bpa/export` — linha com CBO + CNS profissional.
