# Política de manuais — SGS / SIGS

**Decisão de projeto (2026-08-10):** desde a primeira função implementada, toda entrega funcional gera **manual técnico** e **manual do usuário**, versionados e **disponíveis na interface** do software.

---

## 1. Regra obrigatória de Definition of Done

Uma funcionalidade só é considerada **pronta** quando:

1. Código + testes mínimos
2. **Manual do usuário** atualizado (ou criado) na versão corrente
3. **Manual técnico** atualizado (ou criado) na versão corrente
4. Entrada no índice in-app de ajuda (`/?` / Central de Ajuda)
5. Link contextual “Ajuda desta tela” apontando para o artigo certo
6. Changelog da versão do manual registrado

Sem manuais → a tarefa **não fecha**.

---

## 2. Dois tipos de manual

| Tipo | Público | Objetivo | Onde vive |
|---|---|---|---|
| **Manual do usuário** | Profissionais de saúde, recepção, gestores, ACS | Como usar a tela/fluxo | UI → Central de Ajuda + `?` contextual |
| **Manual técnico** | TI municipal, sustentação, desenvolvedores | Como funciona, integra, configura, audita | UI (perfil TI) + repositório `docs/manuais/tecnico/` |

---

## 3. Versionamento

### 3.1 Versão do produto × versão do artigo

```text
produto:  0.1.0-mvp → 0.2.0 → 1.0.0
artigo:   cadastros.paciente@1.0.0 → @1.1.0
```

- Cada artigo tem `id` estável (slug) e `version` semver do **conteúdo**.
- O produto referencia o conjunto de artigos publicados naquela release.
- Artigos antigos ficam consultáveis (histórico), com badge “versão anterior”.
- Breaking change de fluxo → major do artigo + aviso na UI.

### 3.2 Metadados obrigatórios (frontmatter)

```yaml
id: cadastros.paciente
title: Cadastro de pacientes
type: user | technical
module: cadastros
feature: paciente
version: 1.0.0
product_min: 0.1.0
status: draft | published | deprecated
audience: [recepcao, profissional, gestor, ti]
related_rf: [RF-2.27, RF-2.56, RF-2.57]
related_screens: [PacienteListPage, PacienteFormPage]
updated_at: 2026-08-10
authors: [SIGS]
```

---

## 4. Estrutura no repositório

```text
docs/manuais/
  README.md                 ← esta política
  campos-siaps-previne.md   ← convenção visual vermelho (Siaps) × laranja (Previne)
  templates/
    manual-usuario.md
    manual-tecnico.md
  usuario/
    _index.yaml             ← índice publicado
    plataforma/
    cadastros/
    ambulatorial/
    ...
  tecnico/
    _index.yaml
    plataforma/
    cadastros/
    ...
  releases/
    0.1.0-mvp.md            ← o que mudou nos manuais nesta release
```

### Campos Siaps × Previne (UI operacional)

Nas fichas de produção (APS, odonto, vacina, AD, coletivo e lotes LEDI quando couber):

- **Vermelho + badge “Siaps”** — obrigatório para envio legal (BLOCKER LEDI).
- **Laranja + badge “Previne”** — indicador / qualidade (não bloqueia finish se Siaps ok).

Detalhe e checklist: [`campos-siaps-previne.md`](./campos-siaps-previne.md). Componente: `FieldHint` / `LabeledField` (`apps/web/src/components/ui/FieldHint.tsx`).

**Central de Ajuda — regras internas do funil:** `faturamento.funil-pre-envio` · `faturamento.regras-por-tipo` · `faturamento.cruzamentos` · `faturamento.siaps-vs-previne` (espelho em `apps/web/src/lib/help.ts`).

No software (futuro):

```text
/ajuda                      ← Central de Ajuda (usuário)
/ajuda/tecnica              ← Manual técnico (role TI)
/ajuda/:slug                ← artigo
GET /api/help/articles
GET /api/help/articles/:id?version=
GET /api/help/search?q=
```

Conteúdo pode ser Markdown compilado no build ou servido da API — decisão de implementação na fase de plataforma.

---

## 5. Conteúdo mínimo por tipo

### Manual do usuário

1. Para que serve
2. Quem pode usar (perfil)
3. Pré-requisitos
4. Passo a passo (com nomes reais de botões/campos)
5. Validações e mensagens de erro comuns
6. Dicas / atalhos
7. O que acontece depois (ex.: vai para fila, gera produção)
8. FAQ curto (3–5 itens)

### Manual técnico

1. Escopo e RF relacionados
2. Modelo de dados / entidades tocadas
3. APIs / eventos / integrações
4. Regras de negócio e validações
5. Permissões e auditoria
6. Configuração / parâmetros
7. Dependências e limites conhecidos
8. Troubleshooting
9. Proveniência (se regra veio de e-SUS/TR/norma)

---

## 6. Disponibilidade na interface (RF alinhados)

Atende parcialmente aos RF gerais de orientação (ex.: manuais/videoaulas desejável RF-1.17) e prepara:

- Menu **Ajuda** global
- Ícone **?** em cada tela/módulo
- Busca full-text nos artigos publicados
- Filtro por módulo e perfil
- Histórico de versões do artigo
- (Opcional MVP+) videoaula embutida por URL

---

## 7. Checklist por PR / feature

```text
[ ] Artigo usuário criado/atualizado
[ ] Artigo técnico criado/atualizado
[ ] _index.yaml atualizado
[ ] Link contextual da tela
[ ] releases/<versão>.md atualizado
[ ] Revisão ortográfica PT-BR
[ ] Sem dados reais de pacientes nos exemplos (usar fictícios)
```

---

## 8. Responsabilidade

| Papel | Responsabilidade |
|---|---|
| Quem implementa a feature | Escreve rascunho dos dois manuais |
| Revisor de produto/negócio | Valida manual do usuário |
| Revisor técnico | Valida manual técnico |
| Release | Publica versão e atualiza Central de Ajuda |

---

## 9. Exemplos sintéticos (obrigatório)

Usar sempre dados fictícios, ex.:

- Paciente: “Maria Exemplo Silva”, CPF `000.000.001-91`
- Unidade: “UBS Centro Demonstração”
- Profissional: “Dr(a). Ana Exemplo”, CNS fictício
