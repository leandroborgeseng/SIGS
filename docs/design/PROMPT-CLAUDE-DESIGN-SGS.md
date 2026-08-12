# Prompt para Claude Design — Interface gráfica do SGS

**Como usar:** copie o bloco abaixo **inteiro** (da linha “PROMPT INICIA” até “PROMPT TERMINA”) e cole no Claude Design / Claude para gerar o design system e as telas.  
**Depois:** devolva o pacote (Figma/código de UI/export) para implementação no repositório SIGS.

**Escopo deste prompt:** apenas **MVP** (plataforma, cadastros, agenda, atendimento APS, vacinação, ajuda in-app, relatórios mínimos). Não pedir SAMU/LIS/hospitalar agora.

---

## PROMPT INICIA

```text
Você é um designer de produto sênior especializado em sistemas públicos de saúde (SUS / APS municipal) e em design systems para software operacional denso.

# Contexto do produto

Nome: SGS — Sistema de Gestão em Saúde (também referido como SIGS no repositório)
Cliente: Secretaria Municipal de Saúde de Franca/SP
Tipo: aplicação WEB operacional (não landing page de marketing)
Usuários: recepção, médicos, enfermagem, ACS (perfil limitado), gestores, TI municipal
Idioma da UI: Português do Brasil
Acessível via navegadores modernos (Firefox, Chrome, Edge, Opera, Safari)
Deve funcionar bem em desktop (prioridade) e ser utilizável em tablet (1024px+)

# O que você deve entregar

1. Design system completo (tokens, tipografia, cor, espaçamento, componentes, estados, ícones)
2. Fluxos e telas do MVP listados abaixo
3. Especificação de cada tela: objetivo, atores, layout, componentes, estados vazios/erro/loading, microcópia PT-BR
4. Mapa de navegação (IA — information architecture)
5. Protótipo navegável OU exports claros (Figma + specs) para handoff de engenharia
6. Guia de responsividade (desktop-first)
7. Acessibilidade: contraste AA, foco teclado, labels, não depender só de cor

NÃO entregar backend, APIs ou regras de negócio implementadas — só interface e especificação visual/UX.
NÃO inventar módulos fora do MVP.
NÃO usar aparência de “template SaaS genérico roxo/indigo”.

# Direção visual (obrigatória)

Este é um sistema clínico-operacional municipal. A primeira tela após login É um workspace/dashboard operacional (exceção válida a landing pages).

Direção:
- Sóbrio, legível, denso mas organizado (dados clínicos precisam caber)
- Identidade de saúde pública brasileira: confiança, clareza, seriedade
- Marca: placeholder “SGS Franca” / brasão municipal (slot para SVG/PNG)
- Evitar: purple-on-white, cream+#terracotta clichê, dark mode forçado, glow, pills excessivas, multi-shadow
- Preferir: azul petróleo / verde saúde institucional / neutros quentes sóbrios — escolha UMA direção clara e documente tokens CSS
- Tipografia: tipografia expressiva porém legível para UI densa (evitar Inter/Roboto/Arial como stack default; escolher fontes com licença livre adequadas, ex. família humana para UI + display contido para marca)
- Fundo: não flat único; usar textura/gradiente sutil institucional sem reduzir contraste de formulários
- Cards: usar só quando forem container de interação; evitar card-spam no dashboard
- Tabelas e formulários são cidadãos de primeira classe
- Densidade: modo “confortável” default + suporte a densidade compacta em listagens

# Princípios UX

- Uma tarefa principal por tela
- Hierarquia: o que o profissional precisa agora > dados secundários
- Busca de paciente onipresente (atalho global)
- Unidade de saúde / equipe de trabalho sempre visíveis no header
- Ações destrutivas com confirmação
- Feedback imediato (toast/inline) em PT-BR claro
- Toda tela tem: título, breadcrumb, ação primária, ajuda contextual “?” 
- Estados obrigatórios em toda lista/form: loading, empty, error, success, forbidden
- Manuais in-app: área “Central de Ajuda” + painel lateral ou drawer de ajuda por tela

# Arquitetura de informação (MVP)

Após login:
- Dashboard inicial (atalhos, agenda do dia, fila resumida, uso recente)
- Cadastros
  - Unidades
  - Profissionais
  - Equipes
  - Pacientes / cidadãos
  - Território (microáreas / domicílios simplificado)
- Agenda
- Atendimento (fila + consulta)
- Vacinação
- Relatórios (mínimos)
- Administração (usuários, grupos/perfis, auditoria)
- Ajuda (manuais do usuário; manuais técnicos se perfil TI)

# Personas (para decisões de UI)

1. Recepção — velocidade, busca paciente, agenda, senha/fila
2. Enfermeiro(a)/médico(a) — prontuário, atendimento, pouca fricção, histórico
3. Gestor UBS — visão do dia, indicadores simples
4. TI — usuários, auditoria, manuais técnicos

# Telas obrigatórias a desenhar

## A. Plataforma
A1. Login
A2. Primeiro acesso / definir senha
A3. Seleção de unidade de trabalho (se multi-unidade)
A4. Shell autenticado (header, nav, busca global, user menu)
A5. Dashboard inicial
A6. Usuários — listagem + formulário
A7. Grupos/perfis — listagem + matriz de permissões (visualizar/alterar/excluir por funcionalidade)
A8. Auditoria — busca por usuário/período/palavra + detalhe do evento
A9. Central de Ajuda — busca, lista por módulo, leitura de artigo, histórico de versão do artigo
A10. Ajuda contextual (drawer/? na tela Pacientes e na tela Atendimento — como padrão reutilizável)

## B. Cadastros
B1. Unidades de saúde — lista + formulário (CNES, tipo, endereço, contatos)
B2. Profissionais — lista + formulário (CNS/CPF, conselho, CBO, vínculos)
B3. Equipes — lista + formulário (INE, tipo, profissionais)
B4. Pacientes — busca avançada (nome, nasc., mãe, CPF, CNS) + lista
B5. Paciente — formulário criar/editar
B6. Paciente — visão do prontuário somente leitura (linha do tempo de atendimentos/vacinas/anexos)
B7. Território — microáreas e domicílios (visão simplificada + vínculo a equipe)
B8. Anexos do paciente (upload/lista) — UI apenas

## C. Agenda
C1. Grade semanal do profissional
C2. Criar/editar slot / bloqueio
C3. Agendar paciente em horário
C4. Lista do dia (chegou / faltou / aguardando)

## D. Atendimento APS
D1. Entrada do paciente (agendado ou espontâneo) — tela única de busca
D2. Fila de atendimento (kanban OU tabela densa com filtros; export visual)
D3. Pré-consulta / sinais vitais (opcional no MVP, mas desenhar)
D4. Atendimento clínico — layout split: dados do paciente + SOAP/CIAP-CID + procedimentos + desfecho
D5. Encerramento / conduta
D6. Impressão/documentos do atendimento (preview)

## E. Vacinação
E1. Aplicar vacina (paciente, vacina, dose, lote, validade, local)
E2. Histórico / cartão de vacina (visual + ação imprimir/PDF)
E3. Lista do dia (doses aplicadas)

## F. Relatórios mínimos
F1. Atendimentos por período/unidade
F2. Vacinas aplicadas por período
(Filtros + tabela + exportar CSV/Excel visual)

# Componentes do design system (mínimo)

- Button (primary/secondary/danger/ghost; sizes)
- Input, Textarea, Select, Combobox/autocomplete, DatePicker, Checkbox, Radio, Switch
- FormField (label, hint, error)
- Table (sort, pagination, row actions, bulk opcional)
- Tabs, Accordion
- Modal / Dialog confirm
- Drawer (ajuda, filtros)
- Toast / Alert / Banner
- Badge / StatusPill (usar com texto, não só cor)
- Avatar, EmptyState, Skeleton
- PageHeader, Breadcrumb, Toolbar
- Timeline (prontuário)
- Stepper (etapas de atendimento) — se fizer sentido
- HelpButton (?)
- Command palette / busca global (Ctrl+K)

Documentar cada componente com: anatomia, variantes, estados, dos/don’ts.

# Microcópia (PT-BR)

- Tom: claro, respeitoso, sem jargão de TI para usuários clínicos
- Erros: dizer o que aconteceu + como corrigir
- Exemplos de dados: sempre fictícios (Maria Exemplo Silva, UBS Centro Demonstração)
- Evitar inglês na UI

# Acessibilidade e inclusão

- Contraste WCAG AA
- Nome social deve caber nos formulários de paciente (campo visível)
- Não transmitir status só por cor (fila/classificação)
- Foco visível; ordem de tab lógica em formulários longos
- Áreas de toque adequadas em tablet

# Entregáveis formatados

Organize a resposta assim:

1. Resumo da direção visual + tokens (cores, type scale, spacing, radius, elevation)
2. Mapa de navegação (mermaid ou lista hierárquica)
3. Inventário de componentes
4. Telas uma a uma (wire→hi-fi description) com anotações de interação
5. Fluxos principais:
   - Login → dashboard
   - Buscar paciente → agendar → check-in → atender → finalizar
   - Aplicar vacina → ver cartão
   - Abrir ajuda contextual
6. Specs de handoff para engenharia (nomes de rotas sugeridas, ex.: /pacientes, /atendimento/:id)
7. Lista do que ficou fora do MVP de propósito

# Restrições finais

- Não incluir chat interno, 2FA, Gov.br, totem, painel de senha, SAMU, lab, farmácia, UPA, TFD no escopo visual agora (podem aparecer como “em breve” desabilitados no menu, no máximo).
- Priorizar excelência nas telas D4 (atendimento) e B4/B5 (paciente) — são o coração do MVP.
- Considere que os manuais técnicos/usuário serão renderizados em Markdown dentro da Central de Ajuda: desenhe um leitor de artigos limpo, com versão e data.

Ao final, confirme que o pacote está pronto para handoff de implementação front-end.
```

## PROMPT TERMINA

---

## Checklist ao receber o retorno do Claude Design

- [ ] Tokens/CSS variables documentados
- [ ] Todas as telas A–F presentes
- [ ] Estados empty/loading/error nas listas principais
- [ ] Ajuda in-app desenhada
- [ ] Rotas/nomes alinháveis ao front
- [ ] Sem módulos fora do MVP “inventados” como prontos
- [ ] Arquivos exportados anexados neste repositório em `docs/design/entregas/`

## Pasta de entregas

```text
docs/design/entregas/
  YYYY-MM-DD-claude-design/
    README.md
    (exports, links Figma, screenshots, tokens)
```
