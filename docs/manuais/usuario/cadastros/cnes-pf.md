# Manual do usuário — CNES municipal e profissionais lotados (PF)

**Versão:** 0.1.0-stub  
**Telas:** `/cadastros/cnes-auditoria` · `/unidades`  
**RF:** RF-10.2 · RF-9.6 · RF-2.2 · RF-2.47 · RF-2.19  
**UI final:** fase 2 (Claude Design). Este manual cobre o fluxo técnico atual.

## O que faz

1. **Sincroniza a rede municipal** (Prefeitura — natureza jurídica **1244**): estabelecimentos + equipes.
2. **Importa profissionais lotados (PF)** nas equipes municipais: nome + CNS + CBO + CNES + INE (cadastro público CNES; **sem CPF**).
3. **Audita** inconsistências de cadastro e, no faturamento, cruzamento ficha × rede.

## Passo a passo

1. Abra **Unidades** (`/unidades`) — a lista default é **Rede Prefeitura (mantenedora)** (~59 ativas em Franca), não a cidade inteira (~545).
2. Ou abra **Cadastros → CNES / auditoria** (`/cadastros/cnes-auditoria`).
3. Clique em **Sincronizar rede municipal**. Aguarde o resumo (ex.: 66 estabelecimentos / 123 equipes).
4. Em seguida **Importar profissionais lotados** (PF). Ordem importa: unidades/equipes **antes** de profissionais.
5. Revise findings; exporte CSV se precisar.
6. No faturamento: `/faturamento/auditoria?competencia=YYYY-MM`.

Toggle em Unidades: **Todos IBGE** mostra a cidade inteira (só para inspeção).

## Escopo

| Modo | O que entra |
|---|---|
| `gestao=municipal` (default) | Só Prefeitura (natureza **1244**; CNPJ mantenedora `47970769000104`) |
| `gestao=todos` | Cidade inteira (particulares + outros) |

## Limites (documentados)

- PF só equipes CnesWeb do snapshot; sem CPF.
- Sync live depende de rede; fallback = snapshot `data/cnes/franca-3516200*.json`.
- Não altera o wizard LEDI FAI/FAO/PROC.

## Ajuda na tela

Help ids: `cadastros.cnes` (se existir) · hub faturamento · auditoria faturamento.  
Manual técnico: `docs/manuais/tecnico/cadastros/cnes-import.md`.
