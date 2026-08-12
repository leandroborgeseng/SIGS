# Manual técnico — Seed SIGTAP expandido (sem zip MS)

**Versão:** 0.3.0-dev  
**RF:** RF-10.1, RF-9.1, RF-9.5

## O que mudou

- `SIGTAP_SEED` passou de ~8 para **27** códigos APS/piloto (BPA, odonto, AD, coletivo, enfermagem, regulação).
- `ensureSeeded()` **sincroniza** ausentes em bases já seedadas (não só no banco vazio).
- Não sobrescreve linhas `source=import|ms`.
- JSON piloto: `data/sigtap/piloto-franca.json`
- `GET /v1/sigtap/seed-catalog` · `POST /v1/sigtap/seed?force=1`

## Competência do seed

`202608` (`SIGTAP_SEED_COMPETENCIA`).

## Quando o MS voltar

Continuar com `import-ms` do `TB_PROCEDIMENTO.txt` — linhas `ms` têm prioridade sobre seed.
