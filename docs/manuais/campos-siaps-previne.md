# Convenção visual — campos Siaps × Previne

**Atualizado:** 2026-08-16  
**Fontes (não inventar regras LEDI):** `docs/conhecimento/15-faturamento-indicadores-campos-obrigatorios.md` · `apps/web/src/lib/ledi/error-registry.ts` · validators FAO/FAI/preflight · `docs/conhecimento/14-indicadores-aps-previne-brasil.md`

---

## 1. Dois eixos

| Tom UI | Badge | Eixo | Severidade típica | Finalizar atendimento |
|---|---|---|---|---|
| **Vermelho** | `Siaps` | A — envio legal LEDI → Siaps/SISAB | `BLOCKER` (e MONEY_RISK que a ficha trata como bloqueio de envio) | Sem isso, **não** finaliza / não envia |
| **Laranja** | `Previne` (ou `Indicador`) | B — indicadores / qualidade | `MONEY_RISK` Previne · `QUALITY_WARN` | Orienta; **não** impede finish se Siaps ok |
| Neutro | — | Clínico / UX local | — | Sem vínculo federal direto |

Regra de produto: **Pronto Siaps ≠ Pronto Previne**. O painel LEDI e o wizard de lote já separam esses eixos; a ficha operacional deve espelhar isso nos campos.

---

## 2. Componente UI

- `apps/web/src/components/ui/FieldHint.tsx` — `FieldBadge`, `FieldHint`, `LabeledField`, `FieldSection`, `FieldToneLegend`
- CSS: `--field-siaps*` / `--field-previne*` em `apps/web/src/app/globals.css`
- Uso: `tone="siaps" | "previne" | "neutral"`

Não alterar o wizard LEDI (`/faturamento/lote/*`) nesta convenção — ele já tem funil Siaps/Previne próprio.

---

## 3. Manual do usuário por tela

Cada artigo em `docs/manuais/usuario/` da ficha operacional deve ter:

1. Link contextual (`help.ts` + `HelpLink` + `_index.yaml`)
2. Tabela **Campos Siaps vs Previne** (somente o que validators/registry/docs já classificam)
3. Passo a passo com nomes reais dos botões

Checklist DoD (além de `docs/manuais/README.md`):

```text
[ ] Badge vermelho/laranja nos campos críticos da tela
[ ] Tabela Siaps × Previne no stub do manual
[ ] help.ts + _index.yaml
```

---

## 4. Como classificar um campo novo

1. Abrir o código no `error-registry` / validador da ficha.
2. Se `severity: BLOCKER` e `channel: LEDI` → **Siaps** (vermelho).
3. Se código `PREVINE_*` ou `channel: PREVINE` / gap B1–B6 / QUALITY que o doc 15 chama de indicador → **Previne** (laranja).
4. Se só UX clínico (anamnese, notas) → neutro.
5. Em dúvida: **não** pintar de vermelho. Documentar no manual como “a confirmar no registry”.

---

## 5. Telas cobertas (onda UI)

| Rota | Manual usuário | help id |
|---|---|---|
| `/odonto/[id]` | `usuario/odonto/atendimento-onda1.md` | `odonto.atendimento` |
| `/aps/[id]` | `usuario/ambulatorial/atendimento-aps-fai-onda1.md` | `aps.atendimento` |
| `/vacinacao` | `usuario/vacinacao/aplicacao.md` | `vacinacao.aplicacao` |
| `/ad` | `usuario/ambulatorial/atencao-domiciliar.md` | `ad.stub` |
| `/coletivo` | `usuario/ambulatorial/atividade-coletiva.md` | `coletivo.stub` |
