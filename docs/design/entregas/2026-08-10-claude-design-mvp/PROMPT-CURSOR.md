# Prompt original — SIGS (Sistema de Gestão em Saúde / SGS)

> Especificação funcional completa fornecida pelo cliente. Usar como fonte de regras de negócio, IA e escopo do MVP — o protótipo HTML neste pacote implementa visualmente as telas descritas aqui, com as regras de status/campos detalhadas no README.md.

## Contexto do produto

Nome: SGS — Sistema de Gestão em Saúde (também referido como SIGS no repositório)
Cliente: Secretaria Municipal de Saúde de Franca/SP
Tipo: aplicação WEB operacional (não landing page de marketing)
Usuários: recepção, médicos, enfermagem, ACS (perfil limitado), gestores, TI municipal
Idioma da UI: Português do Brasil
Desktop (prioridade) e tablet (1024px+)

## Arquitetura de informação (MVP)

Após login: Dashboard · Cadastros (Unidades, Profissionais, Equipes, Pacientes, Território) · Agenda · Atendimento (fila + consulta) · Vacinação · Relatórios · Administração (usuários, grupos/perfis, auditoria) · Ajuda.

## Telas obrigatórias (A–F)

**A. Plataforma:** A1 Login · A2 Primeiro acesso/definir senha · A3 Seleção de unidade · A4 Shell autenticado · A5 Dashboard · A6 Usuários · A7 Grupos/perfis (matriz de permissões) · A8 Auditoria · A9 Central de Ajuda · A10 Ajuda contextual (drawer/`?` reutilizável).

**B. Cadastros:** B1 Unidades de saúde · B2 Profissionais · B3 Equipes · B4 Pacientes (busca avançada) · B5 Paciente form · B6 Prontuário somente leitura (timeline) · B7 Território · B8 Anexos do paciente.

**C. Agenda:** C1 Grade semanal · C2 Criar/editar slot/bloqueio · C3 Agendar paciente · C4 Lista do dia.

**D. Atendimento APS:** D1 Entrada do paciente · D2 Fila de atendimento · D3 Pré-consulta/sinais vitais · D4 Atendimento clínico (split: dados + SOAP/CIAP-CID + procedimentos + desfecho) · D5 Encerramento/conduta · D6 Impressão/documentos.

**E. Vacinação:** E1 Aplicar vacina · E2 Histórico/cartão · E3 Lista do dia.

**F. Relatórios mínimos:** F1 Atendimentos por período/unidade · F2 Vacinas aplicadas por período.

## Componentes do design system (mínimo)

Button, Input/Textarea/Select/Combobox/DatePicker/Checkbox/Radio/Switch, FormField, Table, Tabs, Accordion, Modal/Dialog confirm, Drawer, Toast/Alert/Banner, Badge/StatusPill (texto + cor, nunca só cor), Avatar, EmptyState, Skeleton, PageHeader/Breadcrumb/Toolbar, Timeline, Stepper, HelpButton, Command palette (Ctrl+K).

## Regras de status/campos validadas com o cliente (ver README.md seção 3)

- Fila: Aguardando · Escuta inicial · Em atendimento · Aguardando observação · Em observação · Realizado · Não aguardou · Evadiu
- Agenda: Agendado · Presente na unidade · Não compareceu · Não aguardou · Cancelado · Realizado · Excluído (excluir **só** se status = Agendado)
- Paciente: nome social sempre visível; CPF/CNS; nome da mãe/pai cada um com "desconhece"; óbito revela campos condicionais
- Vacinação: Imunobiológico → Estratégia → Dose → Lote/Fabricante/Via/Local; Estratégia Especial → CBO + CID; BCG → comunicante de hanseníase

## Restrições

Não incluir no escopo visual: chat interno, 2FA, Gov.br, totem, painel de senha, SAMU, lab, farmácia, UPA, TFD (podem aparecer "em breve" desabilitados no menu, no máximo). Priorizar excelência em D4 (atendimento) e B4/B5 (paciente). Manuais técnicos/usuário em Markdown na Central de Ajuda.
