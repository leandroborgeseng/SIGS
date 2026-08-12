# Manual do usuário — Produção BPA, Odontologia e AD

| Campo | Valor |
|---|---|
| id | integracao.bpa-odonto-ad |
| version | 0.2.0 |
| status | published |
| atualizado | 2026-08-10 |

1. **Odontologia** (`/odonto`): paciente + profissional + dente/código SIGTAP → **Finalizar** gera lote `dental_encounter`. Confira em Produção / export BPA.
2. **Atenção domiciliar** (`/ad`): AD1/AD2/AD3 + turno + procedimento `0101040024` → **Finalizar** gera lote `home_care`.
3. **Produção / BPA**: liste lotes, marque enviado, **Exportar BPA stub** (checa SIGTAP known/unknown).
4. **Fila APS**: se o cidadão já está na fila do dia, “Entrar na fila” **continua** o mesmo atendimento.
