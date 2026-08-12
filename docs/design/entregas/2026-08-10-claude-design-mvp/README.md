# Handoff — SIGS (Sistema de Informação em Gestão de Saúde) — Franca/SP

Sistema web operacional para a Secretaria Municipal de Saúde: cadastros (pacientes, profissionais, unidades, equipes, território), agenda, fila/atendimento APS, vacinação, relatórios mínimos, administração (usuários/perfis/auditoria) e Central de Ajuda. Escopo: **MVP** apenas (sem SAMU/LIS/hospitalar/farmácia/2FA/Gov.br).

## 0. Sobre os arquivos deste pacote

O `.html` aqui é uma **referência de design** — protótipo interativo mostrando visual e comportamento pretendidos, **não é código de produção**. Recrie estas telas no ambiente/stack escolhido pelo time (React/Next.js sugerido), usando os padrões e bibliotecas próprias do projeto.

| Arquivo | O que é |
|---|---|
| `SIGS (protótipo).html` | Protótipo interativo de todas as telas (login → shell → módulos). Abra no navegador; use a barra inferior para navegar. **Fonte de verdade visual/comportamental.** |
| `assets/franca-mark.png` | Marca da Prefeitura (cata-vento), usada como placeholder de brasão municipal. |
| `PROMPT-CURSOR.md` | Especificação funcional original (prompt completo do SIGS) — regras de negócio, IA, telas obrigatórias A–F. |

**Fidelidade:** alta (hifi) para tokens visuais, estrutura de telas e regras de status/campos abaixo. Dados exibidos são fictícios (Maria Exemplo Silva, UBS Centro Demonstração etc.) — nunca usar dados reais de pacientes em ambiente de design/protótipo.

**Nota de identidade:** por decisão do cliente, o SIGS **reutiliza a cor de marca do GestOP** (`#0066CC`, azul), e não a direção "azul petróleo/verde saúde" sugerida no prompt original — isso foi intencional e não deve ser alterado na implementação.

---

## 1. Design tokens

```css
:root {
  --brand: #0066CC; --brand-hover: #005BB5; --brand-bright: #1E7BD6; --brand-soft: #E8F1FC;

  --canvas: #EEF3F2; --surface: #FFFFFF; --surface-2: #FAFCFB;
  --ink: #1B2624; --ink-2: #34453F; --ink-3: #5B6E6C; --ink-4: #8B9C99;
  --line: #DCE6E4; --line-2: #EAF0EE;

  --ok: #15924E; --ok-bg: #E5F4EB; --ok-bd: #BFE4CD;
  --warn: #B5680A; --warn-bg: #FBF0DD; --warn-bd: #F0D8AE;
  --danger: #D62B2B; --danger-bg: #FBE9E9; --danger-bd: #F2C9C9;
  --muted: #5B6B82; --muted-bg: #EDF1F6; --off: #8A97A8;

  --r-card: 14px; --r-md: 10px; --r-sm: 8px; --r-pill: 999px;
  --sh-sm: 0 1px 2px rgba(15,27,45,.06); --sh-md: 0 6px 22px -8px rgba(15,27,45,.14);

  --sb-w: 236px; --topbar-h: 58px;
  --font: "IBM Plex Sans", system-ui, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, monospace;
}
```
Tipografia: **IBM Plex Sans** (UI, 400/500/600/700) + **IBM Plex Mono** (CPF, CNS, datas, códigos — `font-feature-settings:"tnum" 1"`). Texto nunca < 11px; toque mínimo 44px em tablet.

Componentes: mesmos padrões do design system GestOP (Button, StatusBadge com dot, Badge, Chip, Input/Select foco brand + anel `#E8F1FC`, Table, Tabs, Toast, Sidebar com item ativo em brand-soft + barra 3px brand).

---

## 2. Arquitetura de informação e rotas sugeridas

```
/login
/selecionar-unidade
/dashboard
/pacientes                    (B4 — lista/busca)
/pacientes/:id                (B5 — form) e /pacientes/:id/prontuario (B6 — timeline)
/agenda                       (C1 grade semanal, C2 slot/bloqueio, C3 agendar, C4 lista do dia)
/atendimento                  (D2 fila)
/atendimento/:id              (D4 — clínico split: dados paciente + SOAP + CIAP/CID + desfecho)
/vacinacao                    (E1 aplicar, E2 cartão, E3 lista do dia)
/relatorios                   (F1 atendimentos, F2 vacinas)
/admin/usuarios /admin/grupos /admin/auditoria
/ajuda                        (central + leitor de artigos Markdown)
```

---

## 3. Regras de status e campos (obrigatórias — validadas com o cliente)

### Fila de atendimento (D2) — status possíveis
`Aguardando` · `Escuta inicial` · `Em atendimento` · `Aguardando observação` · `Em observação` · `Realizado` · `Não aguardou` · `Evadiu`
Cores no protótipo: Aguardando=neutro, Escuta inicial/Em atendimento=brand, Aguardando/Em observação=warn, Realizado=ok, Não aguardou=off, Evadiu=danger.

### Agenda (C) — status de slot
`Agendado` · `Presente na unidade` · `Não compareceu` · `Não aguardou` · `Cancelado` · `Realizado` · `Excluído`
**Regra de negócio crítica:** um slot só pode ser **excluído** se seu status atual for `Agendado`. Qualquer outro status (presente, realizado, cancelado etc.) não permite exclusão — o backend deve validar essa transição, não só a UI.

### Paciente (B4/B5)
- **Nome social**: campo sempre visível no formulário (não escondido/opcional por configuração), exibido junto ao nome de registro nas listagens quando preenchido.
- **CPF** e **CNS (Cartão SUS)** como identificadores formais, sempre em `IBM Plex Mono`.
- **Nome da mãe** e **Nome do pai**: cada um com checkbox **"Desconhece"** que desabilita o campo de texto correspondente (mutuamente exclusivos — marcar "desconhece" limpa/ignora o valor digitado).
- **Óbito**: checkbox "Paciente é falecido(a)"; quando marcado, revela campos **condicionais** (data do óbito, número da certidão) destacados visualmente (painel de alerta). Quando desmarcado, esses campos não devem ser exibidos nem exigidos.

### Vacinação (E1) — cascata de campos
Ordem de preenchimento: **Imunobiológico → Estratégia → Dose → Lote/Fabricante/Via/Local**.
- **Se Estratégia = "Estratégia Especial"** → exibir campos adicionais obrigatórios: **CBO** (do profissional solicitante) e **CID-10** (da indicação clínica).
- **Se Imunobiológico = "BCG"** → exibir campo adicional: checkbox **"Comunicante de hanseníase"**.
- Esses campos condicionais devem ser validados no backend também (não confiar apenas na exibição condicional do front).

---

## 4. Telas construídas no protótipo (por onda do prompt original)

- **A. Plataforma:** Login (split brand/form) · Seleção de unidade (multi-unidade) · Shell autenticado (sidebar 236px agrupada + topbar com busca global "Ctrl K" + ajuda contextual "?") · Usuários (lista) · Grupos/perfis (matriz de permissões ver/alterar/excluir) · Auditoria (busca + log) · Central de Ajuda (busca + cards de artigo por módulo, com versão/data).
- **B. Cadastros:** Pacientes (busca + lista com nome social/CPF/CNS) · Ficha do paciente (identificação completa + regras da seção 3) · Prontuário (placeholder para timeline — ver seção 6 "fora do MVP visual desta rodada").
- **C. Agenda:** Grade semanal (tabela dia×hora, slots preenchidos com status coloridos, legenda de status).
- **D. Atendimento:** Fila (tabela com filtro por status, ação "Atender") · Atendimento clínico D4 (layout split: card fixo do paciente à esquerda + abas SOAP/Procedimentos/Exames/Documentos + campos CIAP-2/CID-10 + conduta + ações salvar rascunho/finalizar).
- **E. Vacinação:** Aplicar vacina (formulário em cascata da seção 3 + histórico recente do paciente).
- **F. Relatórios:** Atendimentos por período/unidade (filtros + tabela + exportar CSV).

## 5. O que ficou fora desta rodada de design (mencionar ao time)

- B7 Território (microáreas/domicílios), B8 Anexos do paciente, C2/C3 (criar slot/bloqueio, tela dedicada de agendar), D1/D3/D5/D6 (entrada dedicada, pré-consulta/sinais vitais, encerramento dedicado, preview de impressão), E2/E3 dedicadas (cartão de vacina completo, lista do dia), F2 (vacinas por período), A2 primeiro acesso, A7 detalhe de permissões por tela, A10 padrão reutilizável de ajuda contextual (drawer). Todas fazem parte do MVP do prompt original — podem ser desenhadas em uma próxima rodada; não foram "inventadas" como prontas no protótipo atual.

## 6. Requisitos técnicos (do prompt original, para o backend)

Frontend sugerido: React/Next.js, desktop-first (prioridade), utilizável em tablet 1024px+. Acessibilidade: contraste AA, foco visível, não depender só de cor para status (por isso toda StatusPill usa texto + cor). Idioma pt-BR, sem termos em inglês na UI. Central de Ajuda: artigos em Markdown, com leitor limpo + versão/data — ver tela de Ajuda no protótipo.

Perfis: Recepção, Enfermagem/Médico, Gestor UBS, TI. Ações destrutivas (excluir slot) exigem confirmação e devem respeitar a regra de status da seção 3.
