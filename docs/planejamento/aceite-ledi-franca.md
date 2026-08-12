# Aceite operacional LEDI — lote Franca

**Status:** checklist pronto · execução com ZIP real fica com o operador (dados LGPD locais)  
**Atualizado:** 2026-08-12

## Pré-requisitos

1. API + Web (`npm run dev`) e login `admin@sigs.local`
2. ZIP/XMLs locais (não versionar CNS reais):
   - FAO ~1131 → `/odonto/lote`
   - Amostra FAI/PROC → `/aps/lote` e `/procedimentos/lote`
3. Preferir copiar ZIP para o Desktop antes do upload

## Roteiro (FAO)

1. Upload do lote em `/odonto/lote`
2. **Dry-run** — anotar blockers antes→depois e `wouldTouch`
3. Auto-correção / guia por código (vermelho → laranja)
4. Fichas individuais restantes (CPF/CNS inválidos = dado real)
5. **Relatório fechamento (.md)** — arquivar
6. Baixar ZIP conformes e validar `readyForFinalSend`

## Critérios de aceite

| Critério | Meta |
|---|---|
| Códigos no registry com caminho A–E | 100% (já P0–P2) |
| Dry-run disponível sem gravar | sim |
| Relatório MD gerado | sim |
| Goldens BLOCKER auto no CI | sim (`ledi-p5-golden-pipeline.spec.ts`) |
| Pipeline FAI/PROC | `/aps/lote` · `/procedimentos/lote` |
| Siaps-ready no lote amostra | ≥ 90% dos BLOCKERs auto/semi tratados |

## Gate honesto

- **Siaps-ready** ≠ **Previne-ideal**
- CPF/CNS inválidos exigem correção cadastral
- UUID ausente = reexport (não inventar)
- Aceite numérico do lote 1131 só com o arquivo municipal em mãos
