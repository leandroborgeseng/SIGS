# O que vamos enfrentar no SAMU (síntese executiva)

**Atualizado:** 2026-08-10  
Após inventário de `Samu/` + decompilação de `esus-samu.dll`.

---

## Veredito em uma frase

Não é um CRUD: é uma **central de regulação pré-hospitalar** com ocorrência multi-vítima, fila entre operadores, classificação por cor, despacho de frota e timeline de tempos — implementada em **WebForms + SQL concatenado** (~200 classes, ~100 tabelas tocadas).

---

## Números

| Item | Escala |
|---|---|
| Telas ASPX | ~110 |
| Classes decompiladas | 196 |
| Maiores telas | Solicitante / Ocorrência / Avaliação / Frota (~1–2k linhas cada) |
| Tabelas em SQL | ~80–120 |
| RF TR (M5) | 30 (21 obrig.) |

Detalhe: `data/samu/analysis/data-model.md`.

---

## O que já está claro (bom)

1. Ciclo de negócio completo no código: abrir → avaliar → decidir → despachar → tempos → concluir.  
2. Tabelas-núcleo identificadas (`Ocorrencia`, `Vitimas`, `PosicaoOcorrencias`, frota `FORMEQUIPE_*`, `OcorrenciaMovimentacao`).  
3. Relatórios R1–R10 e monitores mapeáveis a RF-5.15–5.28.  
4. Dá para reescrever S0 sem o app embarcado (RF desejáveis 5.20–5.23 ficam para S4).

---

## O que vai doer

| Dor | Por quê |
|---|---|
| Regras espalhadas | Lógica em code-behind gigante, não em serviços |
| SQL stringly-typed | Concatenação; risco de perder regra ao portar |
| Sem DDL no repo | Colunas/FKs incompletas até extrair schema do SQL Server |
| Tempo real | Monitores/posição exigem push (não só REST) |
| Questionários dinâmicos | Fichas via `QuestionarioRespostas` — motor genérico |
| Segurança legada | Senhas em SQL legado — nunca replicar |
| App ambulância | **Ausente** nesta pasta |

---

## Ordem recomendada (quando voltar)

1. **APS principal** (produção LEDI / lotação / preflight) — agora.  
2. Depois SAMU: DDL se possível → specs `data/samu/spec/` → **S0** Nest (ocorrência + decisão + monitor mínimo).  
3. S1 frota/tempos; S2 relatórios; S3 leitos/mapa; S4 app.

Não misturar S0 SAMU com P0–P7 APS no mesmo PR.
