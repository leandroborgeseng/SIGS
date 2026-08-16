# Seeds vacinação (TB_IMUNOBIOLOGICO / faixa etária)

| Arquivo | Conteúdo |
|---------|----------|
| `tb-imunobiologico.ledi-v3.json` | 99 imunobiológicos do dicionário LEDI oficial |
| `tb-faixa-etaria-vacinacao.seed-v3.json` | 54 faixas em dias (calendário PNI aproximado) |

**Fonte imuno:** https://integracao.esusab.ufsc.br/ledi/documentacao/referencias/dicionario.html#Imunobiologico  

**Não há dump SQL `TB_FAIXA_ETARIA_VACINACAO` no repo** (`AGE_SEED_META.officialDumpPresent=false`).  
Faixas = seed municipal PNI aproximado + overlay via `POST /v1/catalog/vaccination/sync` quando o dump existir.  
Não inventar calendário/norma além do seed versionado.

Runtime: `catalog.seed.ts` (gerado a partir destes JSON). Regenerar:

```bash
# após editar os JSON, re-gerar catalog.seed.ts com o script da onda (node)
```

Sem dados de pacientes.
