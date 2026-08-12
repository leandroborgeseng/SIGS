# Requisitos Funcionais — Sistema de Gestão em Saúde (SGS)

**Fonte:** Anexo I — Termo de Referência, Secretaria Municipal de Saúde de Franca/SP  
**Total:** 601 requisitos | 235 revisados (ok) | 531 pendentes de revisão  
**Arquivo de trabalho no repositório SIGS:** `docs/requisitos/RF-SGS-Franca-Anexo-I.md`  
**Gravado em:** 2026-08-10

---

## Instruções para o Cursor

Este documento lista os requisitos funcionais contratados para o SGS. Ao reescrever o programa Java existente, faça o seguinte para cada requisito abaixo:

1. Verifique no código-fonte Java atual se a funcionalidade descrita já existe (mesmo que parcialmente ou com outro nome/tela).
2. Marque cada requisito com um dos status: `Implementado`, `Parcial`, `Não implementado`.
3. Para requisitos `Obrigatório` marcados como `Não implementado` ou `Parcial`, avalie se é viável implementar a funcionalidade durante a própria reescrita, e liste isso como tarefa pendente separada.
4. Para requisitos `Desejável`, sinalize como oportunidade, mas não bloqueie a reescrita por causa deles.
5. Ao final, gere um relatório de lacunas (gap analysis) agrupado por módulo, priorizando os itens `Obrigatório` ainda não implementados.
6. Requisitos com status "pendente de revisão" (herdado do documento original) ainda não foram validados pela equipe da Secretaria — trate-os com a mesma atenção dos revisados, mas sinalize que podem mudar de escopo.

Colunas usadas abaixo: **Nº**, **Descrição do Requisito**, **Tipo** (Obrigatório/Desejável). Adicione mentalmente (ou em uma tabela de acompanhamento) as colunas **Status no Java atual** e **Ação recomendada**.

### Relação com a engenharia reversa e-SUS

- Fonte comportamental APS: `docs/conhecimento/`
- Mapeamento preliminar TR × e-SUS: `docs/conhecimento/07-mapeamento-tr-vs-esus.md`
- Não assumir que o e-SUS cobre módulos como SAMU, LIS completo, Farmácia estoque, Hospitalar/UPA, TFD, PPI.

---

## 1. Especificações Gerais do Sistema

*50 requisitos | 0 revisados | 50 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | O Sistema pode ser entregue como solução única, em módulos separados ou como conjunto de sistemas interoperáveis, contanto que atenda integralmente aos critérios de integração e disponibilização de funcionalidades necessárias para a Secretaria Municipal de Saúde de Franca, seguindo fielmente as especificações do edital e anexos. | Obrigatório |
| 2 | Banco de Dados singular, hospedado em servidor de alta performance em data center, permitindo que todos os usuários interajam em tempo real (inclusão/alteração/exclusão visível imediatamente para outros usuários). | Obrigatório |
| 3 | Usuários somente acessam as informações do Banco de Dados através da aplicação, de forma on-line. | Obrigatório |
| 4 | Proteção dos dados assegurada pelo sistema aplicativo, sem depender de ferramentas do banco de dados para gerenciamento de acesso. | Obrigatório |
| 5 | Interfaces de usuário padronizadas (tela de acesso, botões, navegação), exceto interfaces específicas de configuração de ambiente. | Desejável |
| 6 | Acesso obrigatório via navegadores: no mínimo Firefox, Chrome, Edge, Opera e Safari. | Obrigatório |
| 7 | Ambiente multiusuário, com uso simultâneo por diversos usuários. | Obrigatório |
| 8 | Suporte a múltiplos exercícios, permitindo consulta a dados de qualquer exercício de forma integrada, sem uso de múltiplos executáveis por módulo. | Desejável |
| 9 | Criação de favoritos para tarefas/telas específicas, reduzindo navegação por menus. | Desejável |
| 10 | Emissão de relatórios com opção de campos para assinatura ao final do documento. | Obrigatório |
| 11 | Relatórios com personalização de layout, incluindo impressão de brasões. | Desejável |
| 12 | Envio de relatórios por e-mail diretamente da tela de visualização/geração. | Obrigatório |
| 13 | Acesso ao gerador (designer) de relatórios para customização, com opção de restaurar modelos padrão. | Obrigatório |
| 14 | Log histórico detalhado de todas as operações por usuário (alterações, exclusões, visualizações), disponível para consulta e impressão (auditoria). | Obrigatório |
| 15 | Armazenamento temporal de relatórios, acessível depois via menu de acesso rápido. | Desejável |
| 16 | Solicitação de cadastro por "Primeiro Acesso" (matrícula funcional, CPF, data de nascimento), com envio de senha por e-mail após validação. | Obrigatório |
| 17 | Manuais de orientação (documentos ou videoaulas) sobre funcionalidades e uso das telas. | Desejável |
| 18 | Quantidade ilimitada de usuários cadastrados. | Obrigatório |
| 19 | Sem limitação de usuários simultâneos, mesmo em tarefas/telas iguais com registros distintos, mantendo integridade dos dados. | Obrigatório |
| 20 | Acesso com senha única por usuário, dando acesso a todas as funcionalidades permitidas. | Obrigatório |
| 21 | Interface para solicitação de senha pelo usuário e interface de aprovação para gestores, com envio automático de e-mail informando liberação de acesso. | Obrigatório |
| 22 | Interface para criação de grupos de usuários com perfis específicos. | Obrigatório |
| 23 | Cadastramento de grupos de usuários com atribuições e direitos semelhantes. | Obrigatório |
| 24 | Grupos de usuários com associação de funcionalidades e definição de níveis de comando no banco (alterar/excluir/visualizar). | Obrigatório |
| 25 | Associação de usuário a grupo existente, herdando características de segurança do grupo. | Obrigatório |
| 26 | Especialização dos direitos de acesso de um usuário vinculado a qualquer grupo. | Obrigatório |
| 27 | Inclusão de usuários sem senha prévia; senha definida pelo próprio usuário no primeiro acesso. | Obrigatório |
| 28 | Troca de senha pelo próprio usuário, sem depender de TI, mantendo histórico de acesso por usuário (não por senha). | Desejável |
| 29 | Cadastramento de todos os usuários desejados, com indicação de direito de acesso por funcionalidade. | Desejável |
| 30 | Definição de acessos por nível de comando no banco: alterações, exclusões, visualizações. | Obrigatório |
| 31 | Gerador de consultas padrão SQL para pesquisas (somente consulta, sem permissão de alteração no BD). | Obrigatório |
| 32 | Gerador de consultas para geração de resultados específicos não contratados no certame. | Obrigatório |
| 33 | Busca de registros de auditoria por palavra, intervalo de datas e usuário. | Obrigatório |
| 34 | Ferramenta de avaliação do nível de uso do sistema (inclusões, alterações, exclusões, consultas, relatórios impressos) por usuário, por sistema, por lotação/departamento e por tipo de operação. | Obrigatório |
| 35 | Compatibilidade com bancos de dados padrão SQL-ANSI, demonstrada em ao menos 2 bancos diferentes, permitindo futura migração. | Obrigatório |
| 36 | Ferramenta de definição de calendário da Secretaria, com inclusão de diversos eventos por dia. | Obrigatório |
| 37 | Emissão de relatórios do calendário com eventos lançados por data. | Obrigatório |
| 38 | Relatórios de acessos permitidos a usuários (por tela/tarefa, por área, por perfil). | Obrigatório |
| 39 | Ferramenta integrada de abertura de chamados de suporte técnico pela interface do sistema. | Obrigatório |
| 40 | Monitoramento de todas as etapas de resolução de chamado, da abertura até o "de acordo" final do usuário. | Obrigatório |
| 41 | Relatórios estatísticos de chamados (abertos, fechados, pendentes). | Obrigatório |
| 42 | Endereços de pessoas físicas/jurídicas conectados ao Google Maps (ou equivalente), com visualização de localização e imagens de satélite na própria tela. | Obrigatório |
| 43 | Mínimo de 10 gráficos com visão gerencial dos dados movimentados. | Desejável |
| 44 | Integração com plataforma OpenSource de monitoração de TI (métricas em séries temporais em tempo real: CPU, RAM, SWAP, carga do sistema, disco, tráfego de rede). | Obrigatório |
| 45 | Desenvolvimento em linguagem de programação de mercado que garanta portabilidade e manutenção. | Obrigatório |
| 46 | Chat para comunicação entre usuários cadastrados e logados. | Obrigatório |
| 47 | Acesso via Gov.br, restrito a usuários previamente autorizados. | Desejável |
| 48 | Autenticação em dois fatores no login (senha adicional enviada ao usuário). | Obrigatório |
| 49 | Dashboard inicial por usuário: gráfico de utilização do sistema, agenda de atividades, atalhos para telas mais usadas. | Obrigatório |
| 50 | Execução em Linux, Windows e macOS. | Desejável |


---

## 2. Módulo de Cadastros

*61 requisitos | 0 revisados | 37 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Cadastro das unidades de saúde: nome/razão social, CNES/INE, tipo de estabelecimento, demanda padrão, procedimentos permitidos, tipos de atendimento, profissionais vinculados, dependências, fichas de saúde praticadas, atividades, tipos de leitos, tipos de crachás, cadastro de crachás, equipes disponíveis, grupos de medicamentos, almoxarifado vinculado, plantões, endereço. | Obrigatório |
| 2 | Cadastro de profissionais: CNS/CPF, nome, conselho profissional, UF do conselho, número do conselho, matrícula, documentos pessoais, origem, endereços, assinatura eletrônica, dados comerciais (CBO), biometria, vínculos. | Obrigatório |
| 3 | Cadastro de complexo regulador e tipo. | Obrigatório |
| 4 | Cadastro de tipos de plantão. | Obrigatório |
| 5 | Cadastro de campos de formulário para atendimento. | Obrigatório |
| 6 | Cadastro de fichas de saúde vinculando campos previamente cadastrados. | Obrigatório |
| 7 | Cadastro/alteração/exclusão de cotas de procedimentos com distribuição pelas unidades de saúde e geração de relatórios. | Obrigatório |
| 8 | Cadastro de crachás com tipos determinados pela gestão. | Desejável |
| 9 | Cadastro de tipos de cardápios para CND. | Obrigatório |
| 10 | Cadastro de cardápios para distribuição na unidade de internação. | Obrigatório |
| 11 | Cadastro de parâmetros de medicamentos: tipo de receita, controle especial, notificação de receita, via de administração. | Obrigatório |
| 12 | Cadastro de tipos de prescrição: itens do kit, CIDs para kit, unidade disponibilizada, tipo do item, posologia, doses, recomendações, advertência, efeito colateral. | — |
| 13 | Cadastro de fichas de notificação e agravo, com preenchimento obrigatório conforme o CID informado no atendimento. | Obrigatório |
| 14 | Cadastro de procedimentos não padronizados no SUS. | Obrigatório |
| 15 | Cadastro de protocolos de atendimento. | Obrigatório |
| 16 | Cadastro de vínculo do profissional aos plantões disponíveis. | Obrigatório |
| 17 | Cadastro de agendas profissionais com tipos de atendimento por agenda. | Obrigatório |
| 18 | Cadastro de procedimentos agendáveis. | Obrigatório |
| 19 | Cadastro de equipes de saúde vinculadas às regras do SUS e da gestão. | Obrigatório |
| 20 | Cadastro de vacinas. | Obrigatório |
| 21 | Cadastro de estratégias das doses de vacinas. | Obrigatório |
| 22 | Cadastro de doses de vacinas. | Obrigatório |
| 23 | Cadastro de local de aplicação da dose. | Obrigatório |
| 24 | Cadastro de ficha de exames: nome, natureza, forma de exibição, sigilo, procedimento, agrupamento, CBOs permitidos, modelo de impressão com variáveis, permissão de arquivos, preparo de exames. | Obrigatório |
| 25 | Cadastro de preparo para procedimentos. | — |
| 26 | Cadastro de scripts de resultado de exames. | Obrigatório |
| 27 | Cadastro de pacientes: nome, mãe, data de nascimento, CPF, CNS, endereço completo, contatos, raça/cor, deficiência, naturalidade, nacionalidade, vínculo com unidade/equipe, documentação, observações, documentos digitais, biometria, digitais. | Obrigatório |
| 28 | Cadastro das equipes de saúde conforme exigências do SUS. | Obrigatório |
| 29 | Cadastro domiciliar e territorial conforme regras da APS. | Obrigatório |
| 30 | Cadastro individual conforme regras da APS. | Obrigatório |
| 31 | Cadastro de protocolos de acesso por grupo, subgrupo, forma de organização ou procedimento, apoiando decisão da regulação. | Obrigatório |
| 32 | Cadastro de etapas do atendimento. | Obrigatório |
| 33 | Cadastro e listagem dos tipos de atendimento. | Obrigatório |
| 34 | Cadastro de contratos e serviços de saúde. | Obrigatório |
| 35 | Cadastro de pactuações municipais de procedimentos. | Obrigatório |
| 36 | Cadastro de tipos de item de agenda. | Obrigatório |
| 37 | Cadastro de informativos exibidos na abertura do sistema (mensagem, jpg, etc.). | Obrigatório |
| 38 | Cadastro de indicadores de saúde: nome, período, descrição, objetivo, definição do script, escopo do contexto, área de resultado, parâmetros. | Obrigatório |
| 39 | Cadastro de numeração de APAC conforme portarias, com geração automática de quantidades. | Obrigatório |
| 40 | Cadastro de fichas de atestado no padrão do município. | Obrigatório |
| 41 | Atualização das fichas do e-SUS no modelo padronizado atual. | Obrigatório |
| 42 | Cadastro de filas de atendimento (tipos e status). | Obrigatório |
| 43 | Criação de grupos de procedimentos para tratamentos propostos, conforme gestão. | Obrigatório |
| 44 | Cadastro de numeração de AIH conforme portarias, com geração automática de quantidades. | Obrigatório |
| 45 | Relatório de CIDs por descrição, código e/ou tipo de agravo. | Obrigatório |
| 46 | Listagem de CIAPs. | Obrigatório |
| 47 | Listagem de unidades de saúde. | Obrigatório |
| 48 | Listagem de procedimentos. | Obrigatório |
| 49 | Listagem de procedimentos por unidade. | Obrigatório |
| 50 | Listagem de vacinas. | Obrigatório |
| 51 | Listagem de situação de leitos. | Obrigatório |
| 52 | Listagem de dependências físicas por unidade de saúde. | Obrigatório |
| 53 | Listagem dos tipos de atendimento. | Obrigatório |
| 54 | Listagem das etapas de atendimento. | Obrigatório |
| 55 | Listagem dos tipos de leito. | Obrigatório |
| 56 | Listagem de pacientes. | Obrigatório |
| 57 | Acesso ao prontuário eletrônico do paciente sem necessidade de criar atendimento, com todos os atendimentos já realizados, independente do período. | Obrigatório |
| 58 | Digitalização e anexo de arquivos digitais por paciente. | Obrigatório |
| 59 | Emissão de plantões de saúde. | Obrigatório |
| 60 | Listagem de profissionais por unidade de saúde. | Obrigatório |
| 61 | Listagem das equipes de saúde com filtros de unidade, equipe e tipo. | Obrigatório |

---

## 3. Módulo Ambulatorial

*73 requisitos | 60 revisados (ok) | 2 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Registro de entrada de pacientes com pesquisa em única tela (nome, data de nascimento, nome da mãe, CPF, CNS, cartão cidadão). | Obrigatório |
| 2 | Definição de serviço a ser executado no ato da entrada do paciente. | Obrigatório |
| 3 | Identificação do responsável pelo paciente, vinculado ao cadastro de pacientes. | Obrigatório |
| 4 | Localização do paciente registrado na entrada por tipo de atendimento, etapas, nível de urgência, período, situação, dados do paciente. | Obrigatório |
| 5 | Entrada do paciente a partir da agenda prévia. | Obrigatório |
| 6 | Encaminhamento para etapa pré-cadastrada na entrada do paciente. | Obrigatório |
| 7 | Marcação de não comparecimento de paciente agendado, com registro automático. | Obrigatório |
| 8 | Informar CBO no ato da entrada do paciente. | Desejável |
| 9 | Informar profissional no ato da entrada do paciente. | Desejável |
| 10 | Chamada do paciente em painel por voz/texto (nome, profissional, local, senha, procedimento). | Obrigatório |
| 11 | Uso de totem para retirada de senha com dados do serviço da unidade. | Obrigatório |
| 12 | Filtro de pacientes aguardando triagem por etapa(s). | Obrigatório |
| 13 | Classificação de risco por protocolos diversos definidos pela gestão. | Obrigatório |
| 14 | Classificação por cor no processo de classificação de risco. | Obrigatório |
| 15 | Lançamento de dados vitais na pré-consulta. | Obrigatório |
| 16 | Preenchimento de ficha de saúde na pré-consulta. | Obrigatório |
| 17 | Preenchimento de fichas exigidas pela Vigilância em Saúde. | Obrigatório |
| 18 | Informar procedimentos na pré-consulta. | Obrigatório |
| 19 | Identificar profissional que realizou o procedimento. | Obrigatório |
| 20 | Solicitar exames na pré-consulta. | Obrigatório |
| 21 | Visualizar lembretes na pré-consulta. | Desejável |
| 22 | Salvar pré-consulta encaminhando o paciente à próxima etapa. | Obrigatório |
| 23 | Chamada do paciente pelo painel. | Obrigatório |
| 24 | Lista de pacientes aguardando consulta médica (cor de classificação, etapa, dados do paciente, tempo de atendimento). | Obrigatório |
| 25 | Visualizar etapas já ocorridas com o paciente no ato do atendimento. | Obrigatório |
| 26 | Preenchimento da ficha padrão da unidade como primeiro processo do atendimento, com campos editáveis. | Obrigatório |
| 27 | Visualizar vacinas registradas do paciente. | Desejável |
| 28 | Preenchimento de outras fichas disponibilizadas para o atendimento. | Desejável |
| 29 | Lançamento dos procedimentos realizados ao paciente. | Obrigatório |
| 30 | Histórico completo de atendimentos no atendimento médico/multidisciplinar (atendimentos anteriores, medicamentos prescritos, exames e resultados, atendimentos odontológicos com odontograma, arquivos anexados, exames terceirizados). | Obrigatório |
| 31 | A partir de um CID/CIAP, direcionar preenchimento dos próximos passos para indicadores. | Desejável |
| 32 | Lançamento de lembretes para atendimento posterior. | Desejável |
| 33 | Prescrição de medicamentos (receituário ou prescrição interna), com medicamentos padrão do município ou digitação de medicamento fora do padrão com alerta e geração de receituário. | Obrigatório |
| 34 | Geração de receituários. | Obrigatório |
| 35 | Geração de atestados médicos no atendimento, com validação no portal da prefeitura. | Obrigatório |
| 36 | Solicitação de procedimentos informando procedimento, CID e CBO. | Obrigatório |
| 37 | Visualização de dados vitais da triagem e lançamento de novos, com histórico. | Obrigatório |
| 38 | Preenchimento de laudo médico para emissão de AIH, no padrão SUS, reaproveitando dados já lançados. | Obrigatório |
| 39 | Atendimentos remotos por videoconferência com outros profissionais e registro em tempo real. | Obrigatório |
| 40 | Definir próxima consulta por telemedicina, se necessário. | Desejável |
| 41 | Médico solicitar exames internos gerando demanda para o laboratório, com chamada em painel de senha. | Obrigatório |
| 42 | Acionamento pela interface quando exames/medicação/procedimentos forem checados, evitando espera desnecessária. | Obrigatório |
| 43 | Início de tratamento com definição de etapas, tipo, início e fim. | Obrigatório |
| 44 | Definição de conduta e encerramento do atendimento conforme padrões da gestão. | Obrigatório |
| 45 | Assinatura eletrônica com validação no portal da prefeitura via ICP-Brasil. | Desejável |
| 46 | Encaminhamento do paciente a outras etapas definidas no atendimento médico. | Obrigatório |
| 47 | Geração de documentos de todo o atendimento para impressão seletiva. | Obrigatório |
| 48 | Geração de lembretes determinados pela gestão conforme regras de indicadores do SUS. | Obrigatório |
| 49 | Alocação de paciente em leitos de observação, com indicadores por setor. | Desejável |
| 50 | Lançamento da escala de Glasgow com cálculos automáticos. | Obrigatório |
| 51 | Checagem de prescrições (CID, dados do paciente, medicamentos) com lançamento de evolução de enfermagem. | Obrigatório |
| 52 | Solicitação de procedimentos gerando demanda na central de regulação, com protocolos da gestão. | Obrigatório |
| 53 | Atendimentos por fichas de atendimento coletivo, conforme regras da APS. | Obrigatório |
| 54 | Atendimentos domiciliares conforme regras da APS. | Obrigatório |
| 55 | Registro de atendimentos da APS por fichas contemplando todos os campos exigidos pelo modelo de financiamento vigente. | Obrigatório |
| 56 | Atendimentos odontológicos com odontograma e próteses. | Obrigatório |
| 57 | Informações de patologias odontológicas no atendimento. | Obrigatório |
| 58 | Geração automática de procedimentos em todos os processos de produção ambulatorial, quando pertinente. | Obrigatório |
| 59 | Alertar/bloquear solicitações fora do protocolo cadastrado pelo município. | Obrigatório |
| 60 | Monitor com filtros de pesquisa (tipo/etapa de atendimento, nível de urgência, agendados, espontâneos, situação), visualização em lista/tabela dinâmica com arrastar-e-soltar, exportável para Excel, disponível em todas as telas. | Obrigatório |
| 61 | Monitor de checagens (tipo de prescrição, período, alertas de atraso), com checagem por clique. | Obrigatório |
| 62 | Programação de checagens com prazo e horários. | Obrigatório |
| 63 | Painel de informações gerais da unidade (totais por período, quantidade por CID/CIAP, profissionais, tempo médio por etapa, nível de urgência, faixa etária e sexo). | Obrigatório |
| 64 | Monitor de dispensações internas (dados do paciente e período das prescrições). | Obrigatório |
| 65 | Monitor de situação de exames. | Obrigatório |
| 66 | Monitor de acompanhamento de tratamentos. | Obrigatório |
| 67 | Emissão de receitas. | Obrigatório |
| 68 | Listagem de tratamentos de saúde. | Obrigatório |
| 69 | Listagem de atendimentos por CID. | Obrigatório |
| 70 | Consolidado de atendimento por CID/CIAP. | Obrigatório |
| 71 | Relatório de classificação de risco por etapa de atendimento (sintético e analítico). | Obrigatório |
| 72 | Listagem de internações. | Obrigatório |
| 73 | Ocupação de leitos. | Obrigatório |

---

## 4. Módulo de Contratualizações

*12 requisitos | 12 revisados (ok) | 0 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Cadastro de contratos de prestação de serviços. | Obrigatório |
| 2 | Informar procedimentos existentes no contrato, com valores SUS e acréscimos contratuais por procedimento. | Obrigatório |
| 3 | Cadastro por períodos definidos pela gestão. | Obrigatório |
| 4 | Visualização de saldo disponível de procedimentos no prestador. | Obrigatório |
| 5 | Visualização de valor gasto do contrato e saldo disponível conforme atendimento. | Obrigatório |
| 6 | Cotas de procedimentos ou valor do contrato. | Obrigatório |
| 7 | Exigência de documentação no agendamento no prestador de serviços. | Obrigatório |
| 8 | Prestador de serviços recepcionar o paciente agendado. | Obrigatório |
| 9 | Prestador anexar resultados de exames do paciente, disponíveis no prontuário eletrônico. | Obrigatório |
| 10 | Evolução do paciente pelo prestador, com ficha específica definida pela gestão/prestador. | Obrigatório |
| 11 | Faturamento dos procedimentos confirmados nos prestadores, gerando fatura e autorização de pagamento. | Obrigatório |
| 12 | Controle de vigência do contrato. | Obrigatório |


---

## 5. Módulo de SAMU

*30 requisitos | 0 revisados | 30 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Cadastro de unidades de transporte de urgência/emergência nos moldes do CNES. | Obrigatório |
| 2 | Cadastro de tipo de plantão (tipo de escala, data início/fim, hora início/fim, dias da semana válidos). | Obrigatório |
| 3 | Cadastro de fichas de saúde. | Obrigatório |
| 4 | Cadastro dos campos para fichas de saúde. | Obrigatório |
| 5 | Cadastro de equipes de saúde (nome, tipo, INE, carga horária, profissionais). | Obrigatório |
| 6 | Cadastro de plantão de saúde (tipo de plantão, profissionais, equipes). | Obrigatório |
| 7 | Registro de atendimentos: usuário solicitante, data/hora, tipo de prestador, dados do solicitante/paciente, telefone, endereço, ponto de referência, plantão, equipe, frota, motivo, nível de urgência, tipo/local de embarque, tipo/dados do destino. | Obrigatório |
| 8 | Visualização do endereço de embarque no mapa. | Obrigatório |
| 9 | Acesso à localização via SMS com link. | Desejável |
| 10 | Registro de dados clínicos do paciente durante a viagem (fichas de saúde da gestão). | Desejável |
| 11 | Procedimentos dos atendimentos em trânsito, vinculados aos profissionais. | Obrigatório |
| 12 | Visualização das situações do atendimento. | Desejável |
| 13 | Encerramento do atendimento. | Obrigatório |
| 14 | Solicitar agendamento de transporte vinculando procedimentos à necessidade. | Obrigatório |
| 15 | Monitor de atendimentos em andamento, aguardando equipe, equipe definida, iniciado, finalizado. | Obrigatório |
| 16 | Monitor de duração de atendimentos por classificação, com edição, definição de equipe, start, cancelamento, encerramento e impressão. | Obrigatório |
| 17 | Monitor de solicitações de transporte eletivo com direcionamento. | Obrigatório |
| 18 | Mapa em tempo real dos atendimentos e trânsito, com projeção contínua em telas/painéis da Central de Regulação (viatura, status operacional, recursos configuráveis). | Desejável |
| 19 | Cadastro de pacientes validado pelas obrigações municipais de cadastro de cidadão. | Obrigatório |
| 20 | Aplicativo móvel obrigatório (tablets/smartphones) embarcado nas ambulâncias, integrado ao sistema, com funcionamento off-line e sincronização automática ao restabelecer conexão. | Desejável |
| 21 | Preenchimento da ficha de atendimento pré-hospitalar eletrônica por toda a equipe (médica, enfermagem, condutores), com perfis de acesso e rastreabilidade. | Desejável |
| 22 | Registro de tempos operacionais mínimos no app com toque simples (chamada, saída da base, chegada ao local, saída do local, chegada à unidade, retorno à base). | Desejável |
| 23 | Checklist eletrônico das ambulâncias pelo app (itens assistenciais/operacionais, responsável, data, hora, veículo). | Desejável |
| 24 | Painel em tempo real de disponibilidade/ocupação de leitos das unidades para o médico regulador. | Obrigatório |
| 25 | Decisão do médico regulador (orientação ou despacho), classificação de risco por cores, tipo/natureza do chamado, CID, tipo de veículo, via campos estruturados e checkbox, com geração automática de estatísticas. | Obrigatório |
| 26 | Reclassificação do paciente no encerramento (classificação de risco final, desfecho, destino), com geração automática de indicadores. | Obrigatório |
| 27 | Registro de todos os chamados recebidos, classificados por desfecho (interrompidos, trotes, regulados, orientações, despachos), com estatísticas consolidadas. | Obrigatório |
| 28 | Estatísticas e relatórios gerenciais (picos de atendimento, dias/horários de maior demanda, perfil de pacientes, distribuição geográfica). | Obrigatório |
| 29 | Acompanhamento em tempo real de todos os tempos operacionais obrigatórios na Central de Regulação. | Obrigatório |
| 30 | Registro eletrônico do Processo de Enfermagem pelo enfermeiro da USA (histórico, diagnóstico, planejamento, implementação, avaliação), conforme COFEN/COREN. | Desejável |

---

## 6. Módulo Laboratorial

*85 requisitos | 13 revisados (ok) | itens pendentes conforme planilha original*

> Nota: o cabeçalho original da planilha traz números de "revisados/pendentes" inconsistentes com o total do módulo (13 revisados / 272 pendentes listados sobre 85 itens) — sinalizar essa divergência para a equipe da Secretaria, não é um erro de transcrição deste documento.

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Agendar exames por grupo. | Desejável |
| 2 | Agendar exames por tipo de exame. | Desejável |
| 3 | Coleta do exame informando dados do paciente, com geração de checagem. | Obrigatório |
| 4 | Recebimento da coleta no setor de processamento da unidade. | Obrigatório |
| 5 | Lançamento de laudos dos exames. | Obrigatório |
| 6 | Integração com equipamentos (rede ou arquivos), quando disponível. | Desejável |
| 7 | Liberação de resultado de exames. | Desejável |
| 8 | Acesso aos resultados pelo portal do cidadão. | Desejável |
| 9 | Contabilizar entrega de laudo ao paciente. | Desejável |
| 10 | Monitoramento de vagas disponíveis dos exames. | Desejável |
| 11 | Encaixe de exames para pacientes com necessidades diversas, com justificativa. | Obrigatório |
| 12 | Consultar situação do exame. | Obrigatório |
| 13 | Alerta de exame pronto no prontuário do paciente. | Obrigatório |
| 14 | Gestão Laboratorial (LIS — Laboratory Information System). | Obrigatório |
| 15 | Configuração e organização do laboratório: seções técnicas, tipos de recipientes de coleta, exames por área. | Obrigatório |
| 16 | Gestão de perfis de exames (grupos/perfis para agilizar solicitação). | Obrigatório |
| 17 | Gestão do fluxo de trabalho laboratorial: pedido, coleta, triagem, etiquetagem por código de barras, distribuição às áreas técnicas. | Obrigatório |
| 18 | Rastreabilidade completa da amostra e soroteca (status em tempo real, data/hora/profissional em cada etapa). | Obrigatório |
| 19 | Interfaceamento com equipamentos de automação (uni ou bidirecional). | Obrigatório |
| 20 | Gestão de laudos: inserção/alteração manual, valores de referência por idade/sexo, alertas de valores críticos, histórico gráfico. | Obrigatório |
| 21 | Parametrização de valores de referência por localidade (altitude, população, etc.). | Obrigatório |
| 22 | Integração direta com a tela de pedido médico, com disponibilização automática dos dados do paciente e geração de número de guia. | Obrigatório |
| 23 | Integração com o prontuário eletrônico unificado (laudos liberados visíveis na rede). | Obrigatório |
| 24 | Portal de resultados para o paciente com notificação via WhatsApp quando exame disponível. | Obrigatório |
| 25 | Gestão de laboratórios de apoio/terceirizados — **ferramenta não utilizada** (fora de escopo para este município). | Desejável |
| 26 | Faturamento da produção laboratorial (BPA-C automático, vinculado à tabela de procedimentos). | Obrigatório |
| 27 | Relatórios gerenciais e epidemiológicos (produção, tempo de atendimento, pendências, BI, indicadores epidemiológicos). | Obrigatório |
| 28 | Atendimento ambulatorial (posto de coleta no novo NGA). | Obrigatório |
| 29 | Infraestrutura e tecnologia do sistema. | Obrigatório |
| 30 | Sistema desenvolvido em plataforma WEB. | Obrigatório |
| 31 | Geração de arquivos em formato PDF. | Obrigatório |
| 32 | Evolução constante conforme legislação e sugestões dos usuários. | Obrigatório |
| 33 | Vários acessos simultâneos às mesmas ou diferentes rotinas. | Obrigatório |
| 34 | Interação via totem e painel de chamada. | Obrigatório |
| 35 | Impressão de senha por totem. | Obrigatório |
| 36 | Senhas para diversos tipos de atendimento, com controle normal/prioridade. | Obrigatório |
| 37 | Rastreamento de senha. | Obrigatório |
| 38 | Recepção. | Obrigatório |
| 39 | Checagem automática das informações obrigatórias para faturamento SUS, com alerta de faltantes. | Obrigatório |
| 40 | Tabelas para consulta (CID, Tabela SUS, etc.). | Obrigatório |
| 41 | Registro de data/hora de chegada e saída do paciente do laboratório. | Obrigatório |
| 42 | Atendimento e controle de pacientes de cada recepção da unidade. | Obrigatório |
| 43 | Consulta de agenda por paciente, com todos os agendamentos. | Obrigatório |
| 44 | Correio eletrônico entre usuários. | Obrigatório |
| 45 | Relatórios de tempo de espera do paciente e atendimentos por operador. | Obrigatório |
| 46 | Verificação de similaridade de nome do paciente por busca fonética. | Obrigatório |
| 47 | Inserir/tirar foto do paciente vinculada ao cadastro. | Obrigatório |
| 48 | Cadastro de endereço por busca de CEP. | Obrigatório |
| 49 | Impressão de etiquetas diversas. | Obrigatório |
| 50 | Visualizar atendimentos anteriores do paciente. | Obrigatório |
| 51 | Inserir paciente na fila de espera. | Obrigatório |
| 52 | Anexar documentos no cadastro do paciente, com observação ao documento. | Obrigatório |
| 53 | Uso do nome social no atendimento. | Obrigatório |
| 54 | Dupla digitação de exames para conferência de laudos. | Obrigatório |
| 55 | Assinatura eletrônica no corpo do laudo. | Obrigatório |
| 56 | Uso de teclado para entrada de resultados de atributos do hemograma. | Obrigatório |
| 57 | Registro do flebotomista responsável pela coleta. | Obrigatório |
| 58 | Sinalizar e questionar duplicidades de exames no atendimento. | Obrigatório |
| 59 | Informar medicações em uso pelo paciente. | Obrigatório |
| 60 | Sinalizar locais de entrega distintos para emissão do laudo. | Obrigatório |
| 61 | Sinalização de urgência em coletas/liberação, mensurando tempo em fila de processamento. | Obrigatório |
| 62 | Notificação/direcionamento de valores críticos ou não conformidades à área responsável. | Obrigatório |
| 63 | Integração para recebimento de requisições e exportação de resultados (PDF base64, RTF), atuando como laboratório de apoio via webservice/troca de arquivos. | Obrigatório |
| 64 | Integração com sistemas terceiros de laboratório para requisitar/receber resultados, com rastreabilidade e protocolo padrão nacional. | Obrigatório |
| 65 | Pedidos de exames do prontuário compõem lista de espera tratada pelo laboratório. | Obrigatório |
| 66 | Integração de resultados de exames ao prontuário do paciente, acessível de qualquer setor. | Obrigatório |
| 67 | Pesquisa de exames cadastrados por nome, mnemônico ou tipo. | Obrigatório |
| 68 | Anexar laudos externos/documentos de análise; laboratório pode incluir exames não previamente incluídos pelo médico solicitante. | Obrigatório |
| 69 | Retirar amostra de pendência por localização, configurável por setor(es). | Obrigatório |
| 70 | Definir bancadas de trabalho por setor (nome, responsável, tipo de folha: grade ou lista). | Obrigatório |
| 71 | Configurar bancada por exames realizados e usuários habilitados. | Obrigatório |
| 72 | Definir nível de crítica do exame (resultado dentro do limite ou aceitação de qualquer resultado). | Obrigatório |
| 73 | Configurar tipo de acesso do usuário na bancada (ver, digitar, liberar, digitar/liberar, digitar/avaliar). | Obrigatório |
| 74 | Configurar folhas de trabalho por bancada e setor. | Obrigatório |
| 75 | Reimpressão da estrutura de folha de trabalho. | Obrigatório |
| 76 | Impressão de folha de trabalho por período, cópias, urgência, procedência (ambulatorial/internado), ordenação (guia, alfabética, resultado, posição na galeria). | Obrigatório |
| 77 | Na impressão da folha de trabalho: visualizar paciente, consultar outros resultados/repetições, visualizar questionários aplicados. | Obrigatório |
| 78 | Gerar resultados via folha de trabalho. | Obrigatório |
| 79 | Buscar amostras na tela de resultado via folha de trabalho, com pendência de repetição e rastreabilidade a partir da 2ª coleta. | Obrigatório |
| 80 | Acompanhar e visualizar o andamento da cultura. | Obrigatório |
| 81 | Bloquear um ou todos os resultados de um atendimento para impressão/disponibilização na plataforma de laudos. | Obrigatório |
| 82 | Configurar liberação de leucograma com contagem diferencial de 100%. | Obrigatório |
| 83 | Registrar exames terceirizados. | Obrigatório |
| 84 | Gerar gráficos. | Obrigatório |
| 85 | Gerar relatório de resultados. | Obrigatório |

---

## 7. Módulo de Farmácia

*45 requisitos | 45 revisados (ok) | 0 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Dispensar medicamentos a partir do almoxarifado da unidade. | Obrigatório |
| 2 | Identificação do paciente no ato da dispensação. | Obrigatório |
| 3 | Dispensar medicamentos a partir de receituário lançado em atendimento clínico. | Obrigatório |
| 4 | Informar CID no atendimento, se obrigatório nos parâmetros de dispensação. | Obrigatório |
| 5 | Validade de receita. | Obrigatório |
| 6 | Bloquear/desbloquear dispensação fora da validade da receita. | Obrigatório |
| 7 | Digitação de observação de dispensação. | Obrigatório |
| 8 | Identificar origem de receita. | Obrigatório |
| 9 | Identificação de notificação de receita com tipos de medicamentos dispensados. | Obrigatório |
| 10 | Identificação vinda da definição de parâmetro. | Obrigatório |
| 11 | Identificar unidade de dispensação. | Obrigatório |
| 12 | Visualização de dispensações anteriores. | Obrigatório |
| 13 | Dispensação de medicamento avulso a partir de receita impressa. | Obrigatório |
| 14 | Dispensação por código de barras. | Obrigatório |
| 15 | Definir quantidade retirada, identificando uso contínuo. | Obrigatório |
| 16 | Informar uso diário do medicamento, permitindo nova retirada. | Obrigatório |
| 17 | Cadastro de controle especial de ordem judicial (paciente + mercadoria). | Obrigatório |
| 18 | Cadastro de controle especial por determinação do estado (paciente + mercadoria). | Obrigatório |
| 19 | Cadastro de controle especial de outras instâncias (paciente + mercadoria). | Obrigatório |
| 20 | Escolha de lote de validade. | Obrigatório |
| 21 | Visualização de histórico de retiradas e prescrições. | Obrigatório |
| 22 | Relatório de dispensação por tipo de dispensação. | Obrigatório |
| 23 | Relatório de dispensação por lote e validade. | Obrigatório |
| 24 | Relatório de dispensação por tipo de medicamento. | Obrigatório |
| 25 | Relatório por programa de farmácia. | Obrigatório |
| 26 | Cadastramento de unidades de mercadorias e embalagens. | Obrigatório |
| 27 | Cadastramento de unidades de farmácia e de controle de estoque, com responsável por unidade. | Obrigatório |
| 28 | Definição de acesso dos usuários às unidades de farmácia e de controle de estoque. | Obrigatório |
| 29 | Vinculação entre unidades de farmácia/estoque (existentes e novas), com opção de subordinação. | Obrigatório |
| 30 | Cadastro de locais de entrega para requisições de medicamentos/materiais. | Desejável |
| 31 | Cadastro de medicamentos/materiais em ao menos 3 níveis (formato de unidade/embalagem e quantidade por embalagem). | Obrigatório |
| 32 | Inclusão de estoques iniciais nas unidades (quantidade e valor contábil). | Obrigatório |
| 33 | Monitoramento de requisições entre unidades (itens, requerente, data, unidades envolvidas). | Obrigatório |
| 34 | Saída de medicamentos/materiais do estoque por dispensação/uso nas unidades, vinculada ao paciente. | Obrigatório |
| 35 | Transferência de medicamentos/materiais entre unidades de farmácia/estoque. | Obrigatório |
| 36 | Saída por baixa de estoque, com justificativa. | Obrigatório |
| 37 | Relatório de unidades de farmácia/estoque cadastradas (descrição, data de criação, tipo). | Obrigatório |
| 38 | Relatório de medicamentos/materiais cadastrados. | Obrigatório |
| 39 | Relatório mensal/anual de entradas (medicamentos/materiais e quantidades). | Obrigatório |
| 40 | Relatório de entradas com seleção por código, descrição, quantidade, valor unitário/total, histórico. | Obrigatório |
| 41 | Relatório mensal/anual de saídas (quantidades). | Obrigatório |
| 42 | Relatório de saídas por baixa no estoque (intervalo de data/código; código, descrição, data da baixa, quantidade, valor unitário/total). | Obrigatório |
| 43 | Relatório de transferências entre unidades. | Obrigatório |
| 44 | Entrada de medicamentos/materiais sem número da Nota Fiscal. | Desejável |
| 45 | Central de Abastecimento Farmacêutico monitora requisições e estoques mínimos (itens, quantitativo, requerente, data, unidades), com pedidos apenas quando estoque baixo. | Obrigatório |

---

## 8. Módulo Hospitalar e Pronto Atendimento

*52 requisitos | 3 revisados | 49 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Registro de entrada de pacientes com pesquisa em única tela (nome, data de nascimento, mãe, CPF, CNS, cartão cidadão). | Obrigatório |
| 2 | Definição de serviço a ser executado na entrada do paciente. | Obrigatório |
| 3 | Classificação de risco por protocolos, com registro estruturado de sinais vitais, queixa principal, informações clínicas prévias, comorbidades/alergias (campos obrigatórios conforme perfil), e acionamento de protocolos tempo-dependentes com hora zero automática. | Obrigatório |
| 4 | Histórico completo de atendimentos (outros profissionais, medicamentos, exames/resultados, odontograma, arquivos anexados, terceirizados, histórico via RNDS). | Obrigatório |
| 5 | Preenchimento de fichas de saúde definidas pela gestão. | Obrigatório |
| 6 | A partir de um CID, direcionar preenchimento dos próximos passos para indicadores hospitalares. | Desejável |
| 7 | Lançamento de lembretes para atendimento posterior. | Desejável |
| 8 | Prescrição de medicamentos (receituário/interna), padrão do município ou digitação com alerta. | Obrigatório |
| 9 | Geração de receituários simples ou controlados. | Obrigatório |
| 10 | Geração de atestados médicos, com validação no portal da prefeitura. | Obrigatório |
| 11 | Encaminhamento por referência/contrarreferência, com ficha de saúde no padrão do município. | Obrigatório |
| 12 | Visualização de dados vitais e lançamento de novos, com histórico. | Obrigatório |
| 13 | Preenchimento de laudo médico para AIH, padrão SUS, reaproveitando dados para possível transferência. | Obrigatório |
| 14 | Lançamento de dados "a quatro mãos" do atendimento. | Desejável |
| 15 | Solicitação de exames internos, gerando demanda ao laboratório e chamada em painel. | Obrigatório |
| 16 | Acionamento pela interface quando exames/medicação/procedimentos forem checados. | Obrigatório |
| 17 | Definição de conduta e encerramento do atendimento. | Obrigatório |
| 18 | Assinatura eletrônica com validação via ICP-Brasil. | Desejável |
| 19 | Transferência do paciente a outro serviço. | Obrigatório |
| 20 | Geração de documentos do atendimento para impressão seletiva. | Obrigatório |
| 21 | Geração de lembretes conforme regras de indicadores do SUS. | Obrigatório |
| 22 | Alocação de paciente em leitos, com indicadores por setor. | Obrigatório |
| 23 | Lançamento de sessões de fisioterapia na internação. | Obrigatório |
| 24 | Checagem de prescrições (CID, paciente, medicamentos) com evolução de enfermagem. | Obrigatório |
| 25 | Alerta de alergias registradas em prontuário conforme característica do medicamento, com possibilidade de composições alternativas. | Obrigatório |
| 26 | Solicitação de procedimentos gerando demanda na central de regulação. | Obrigatório |
| 27 | Atendimentos por fichas de atendimento coletivo conforme regras do município. | Obrigatório |
| 28 | Atendimentos odontológicos com odontograma/próteses em internados, com procedimentos por dente. | Obrigatório |
| 29 | Informações de patologias odontológicas no atendimento. | Desejável |
| 30 | Geração automática de procedimentos em processos ambulatoriais/hospitalares, quando pertinente. | Obrigatório |
| 31 | Lançamento de procedimentos pós-atendimento. | Obrigatório |
| 32 | Lançar kit de procedimentos. | Obrigatório |
| 33 | Lançamento de ocupação de leitos. | Obrigatório |
| 34 | Escolha do leito na internação. | Obrigatório |
| 35 | Mudança de procedimento por identificação de necessidade médica. | Obrigatório |
| 36 | Interconsulta com profissionais disponíveis na unidade. | Obrigatório |
| 37 | Prescrição de entrega de nutrições a pacientes internados. | Obrigatório |
| 38 | Sumário de alta. | Obrigatório |
| 39 | Boletim médico diário, disponível em portal cidadão e aplicativo. | Obrigatório |
| 40 | Alta ao paciente com fechamento para faturamento hospitalar. | Obrigatório |
| 41 | Parametrização/uso de protocolos clínicos tempo-dependentes no acolhimento: Sepse, IAM, AVC (mínimo). | Desejável |
| 42 | Linha do tempo assistencial automática por protocolo iniciado (ações obrigatórias, responsáveis, tempos decorrido/limite), com alertas visuais no prontuário. | Desejável |
| 43 | Alerta obrigatório na consulta médica sobre protocolo clínico iniciado no acolhimento, exigindo manifestação (continuidade/encerramento com justificativa e CID alternativo). | Desejável |
| 44 | Gestão integrada de leitos do Pronto Atendimento em tempo real (vagos, ocupados, bloqueados), vinculada à classificação de risco e fluxo assistencial. | Obrigatório |
| 45 | Integração/visualização dos leitos do PA para apoio ao SAMU e regulação, em tempo real. | Obrigatório |
| 46 | Geração de solicitação de regulação SIRESP para média/alta complexidade, reaproveitando dados clínicos já registrados. | Obrigatório |
| 47 | Acompanhamento de tempos assistenciais no PA (espera, atendimento médico, observação, permanência total). | Obrigatório |
| 48 | Relatórios e indicadores dos protocolos tempo-dependentes (qualidade, desempenho, exigências do MS). | Desejável |
| 49 | Classificação do grau de dependência do paciente (COFEN/COREN) no leito, com reavaliação e indicadores assistenciais/gerenciais. | Obrigatório |
| 50 | Dupla checagem obrigatória para medicamentos de alta vigilância, com registro de profissionais/data/hora. | Desejável |
| 51 | Alertas automáticos no prontuário/módulos assistenciais para risco de medicação (dose, via, tempo, interação, alergia). | Desejável |
| 52 | Registro, execução e acompanhamento do Processo de Enfermagem nas UPAs (5 etapas), conforme COFEN/COREN. | Desejável |

---

## 9. Módulo de Faturamento

*7 requisitos | 5 revisados (ok) | 2 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Importação e atualização da tabela SIGTAP para lançamento de procedimentos. | Obrigatório |
| 2 | Faturar procedimentos lançados em ambulatório (lançamento posterior em caso de inoperância; BPA e APAC). | Obrigatório |
| 3 | Faturar procedimentos realizados no hospital. | Obrigatório |
| 4 | Faturar procedimentos realizados em CAPS. | Obrigatório |
| 5 | Validação de procedimentos conforme tabela SIGTAP. | Obrigatório |
| 6 | Consistência do cadastro de unidade/profissionais vinculados com base do CNES. | Desejável |
| 7 | Divisão física e financeira dos laboratórios terceirizados para atender ao TAC. | Obrigatório |


---

## 10. Módulo de Integração com o e-SUS

*20 requisitos | 9 revisados (ok) | 11 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | SIGTAP. | Obrigatório |
| 2 | CNES. | Obrigatório |
| 3 | e-SUS. | Obrigatório |
| 4 | BPA. | Obrigatório |
| 5 | RAAS. | Obrigatório |
| 6 | SISAIH01. | Obrigatório |
| 7 | RIA RNDS. | Obrigatório |
| 8 | SI-BNAFAR RNDS. | Obrigatório |
| 9 | SOA – CNES RNDS. | Obrigatório |
| 10 | RIRA RNDS. | Obrigatório |
| 11 | APAC. | Obrigatório |
| 12 | e-SUS Reg. | Obrigatório |
| 13 | SENIOR. | Obrigatório |
| 14 | EDY DATA. | Obrigatório |
| 15 | WORK LAB. | Obrigatório |
| 16 | Interfaceamento com máquinas de análises clínicas. | Obrigatório |
| 17 | Resultados de exames laboratoriais (hoje HTML). | Obrigatório |
| 18 | Resultados de ECG, EEG. | Obrigatório |
| 19 | Programas PET Saúde Digital (totem, vacina, chatbot). | Obrigatório |
| 20 | Envio diário e automático dos dados gerados às bases nacionais. | Obrigatório |

---

## 11. Módulo de PPI (Programação Pactuada Integrada)

*8 requisitos | 8 revisados (ok) | 0 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Cadastro de regiões de saúde. | Obrigatório |
| 2 | Cadastro de microrregiões de saúde. | Obrigatório |
| 3 | Definição das cotas de PPI. | Obrigatório |
| 4 | Definição de cotas extras anuais. | Obrigatório |
| 5 | Definir cotas financeiras. | Obrigatório |
| 6 | Autorização de procedimentos a partir da PPI. | Obrigatório |
| 7 | Acompanhamento das cotas de PPI pelos municípios. | Obrigatório |
| 8 | Agendamento de procedimentos por PPI. | Obrigatório |

---

## 12. Módulo de Odontologia

*20 requisitos | 4 revisados | 16 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Agendamento de atendimentos odontológicos. | Obrigatório |
| 2 | Definição de profissional para atendimento odontológico. | Obrigatório |
| 3 | Identificação do paciente para atendimento odontológico. | Obrigatório |
| 4 | Informação do início do tratamento. | Obrigatório |
| 5 | Escolha do tipo de atendimento a ser realizado. | Obrigatório |
| 6 | Definição de conduta e desfecho do atendimento. | Obrigatório |
| 7 | Finalizar tratamento com informações de vigilância em saúde bucal. | Obrigatório |
| 8 | Informação de fornecimentos ao paciente. | Obrigatório |
| 9 | Anamnese de atendimentos em odontologia. | Obrigatório |
| 10 | Roteiro de telemonitoramento. | Obrigatório |
| 11 | Visualização de odontogramas anteriores. | Obrigatório |
| 12 | Procedimentos em odontograma por dente, quadrante, sextante e boca. | Obrigatório |
| 13 | Procedimentos predefinidos no odontograma, marcáveis como concluídos. | Obrigatório |
| 14 | Informar próteses. | Obrigatório |
| 15 | Serviços protéticos. | Obrigatório |
| 16 | Informações de patologias odontológicas. | Obrigatório |
| 17 | Solicitação de exames e prescrição de medicamentos. | Obrigatório |
| 18 | Acesso ao histórico do paciente/prontuário. | Obrigatório |
| 19 | Emissão de declaração e atestados. | Obrigatório |
| 20 | Acompanhamento de atendimentos em ordem cronológica. | Obrigatório |

---

## 13. Módulo de Regulação

*23 requisitos | 20 revisados (ok) | 3 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Solicitações de procedimentos em todas as áreas de atendimento. | Obrigatório |
| 2 | Definição de procedimentos pré-regulados. | Obrigatório |
| 3 | Definição de procedimentos com exigências específicas. | Obrigatório |
| 4 | Visualização da fila em tempo real. | Obrigatório |
| 5 | Movimentação da fila por classificação. | Obrigatório |
| 6 | Classificar solicitações de procedimentos. | Obrigatório |
| 7 | Preenchimento de fichas de regulação. | Obrigatório |
| 8 | Regular paciente solicitado, definindo classificação. | Obrigatório |
| 9 | Negar atendimento/procedimento por questões clínicas. | Obrigatório |
| 10 | Edição de solicitação após devolução de ficha por falta de dados. | Obrigatório |
| 11 | Acompanhamento por motivo de devolução. | Obrigatório |
| 12 | Direcionamento de fila para agendamento posterior. | Obrigatório |
| 13 | Agendar procedimentos para prestadores contratados. | Obrigatório |
| 14 | Disponibilização de fila no portal do cidadão. | Obrigatório |
| 15 | Acompanhamento de fila em aplicativo. | Obrigatório |
| 16 | Encerramento de solicitações. | Desejável |
| 17 | Monitoramento de fila por CID. | Obrigatório |
| 18 | Monitoramento de fila por procedimento. | Obrigatório |
| 19 | Monitoramento de fila por unidade solicitante. | Obrigatório |
| 20 | Monitoramento de fila por profissional solicitante. | Obrigatório |
| 21 | Cadastro de solicitações de unidades externas (ex.: AME, APAE). | Obrigatório |
| 22 | Reimpressão de solicitações de procedimentos. | Obrigatório |
| 23 | Integração com WhatsApp para envio de mensagens automáticas. | Desejável |

---

## 14. Módulo de Vacinação

*19 requisitos | 0 revisados | 19 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Cadastro das dosagens de vacina. | Obrigatório |
| 2 | Cadastro de vacinas. | Obrigatório |
| 3 | Cadastro de equipamentos frios. | Desejável |
| 4 | Vinculação de vacinas com insumos do almoxarifado. | Obrigatório |
| 5 | Determinar número de doses no cadastro da vacina. | Obrigatório |
| 6 | Utilização de outros insumos para aplicação da vacina. | Obrigatório |
| 7 | Definição de faixa etária para aplicação. | Obrigatório |
| 8 | Bloquear vacinação fora da faixa etária permitida. | Obrigatório |
| 9 | Registro retroativo de doses de vacinas. | Desejável |
| 10 | Informar equivalências no cadastro de vacinas. | Obrigatório |
| 11 | Aplicação de vacina por paciente. | Obrigatório |
| 12 | Agendamento de vacinação com controle de vacinas atrasadas. | Obrigatório |
| 13 | Geração do cartão de vacina. | Obrigatório |
| 14 | Lançamento de vacina por lote e validade. | Obrigatório |
| 15 | Entrada de estoque de vacinas em salas criadas pela gestão. | Obrigatório |
| 16 | Controle de estoques de vacinas. | Desejável |
| 17 | Controle de equipamentos frios. | Obrigatório |
| 18 | Controle de caixa térmica. | Obrigatório |
| 19 | Controle de temperatura. | Obrigatório |

---

## 15. Módulo de Transporte

*29 requisitos | 0 revisados | 29 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Programação de tempo em TFD. | Desejável |
| 2 | Solicitação de atendimento TFD. | Obrigatório |
| 3 | Parecer de comissão médica para TFD. | Obrigatório |
| 4 | Reavaliação de solicitações negadas. | Desejável |
| 5 | Lançamento de laudo médico. | Obrigatório |
| 6 | Autorização de transporte. | Obrigatório |
| 7 | Lançamento de retorno de viagem. | Obrigatório |
| 8 | Gerar demanda no setor de frotas. | Desejável |
| 9 | Definir veículo por local de TFD. | Obrigatório |
| 10 | Informar motorista no agendamento. | Obrigatório |
| 11 | Informar data e hora do atendimento do paciente. | Desejável |
| 12 | Agendar outras viagens dentro do mesmo atendimento. | Obrigatório |
| 13 | Informar acompanhante. | Desejável |
| 14 | Escolha de assento. | Desejável |
| 15 | Lançamento de procedimentos. | Obrigatório |
| 16 | Recibo de diárias. | Desejável |
| 17 | Encerramento de TFD. | Desejável |
| 18 | Agendamento de viagens. | Obrigatório |
| 19 | Cadastro de vagas em agendamento de viagens (remoção interna). | Obrigatório |
| 20 | Relatório de pacientes agendados. | Obrigatório |
| 21 | Cadastrar condições de transporte. | Obrigatório |
| 22 | Selecionar condições de transporte. | Obrigatório |
| 23 | Cadastrar pontos de embarque. | Obrigatório |
| 24 | Selecionar pontos de embarque. | Obrigatório |
| 25 | Cadastrar procedimentos. | Obrigatório |
| 26 | Selecionar procedimentos. | Obrigatório |
| 27 | Geração e exportação de dados para BPA. | Obrigatório |
| 28 | Consulta de guias de TFD. | Obrigatório |
| 29 | Solicitação de vagas (pré-agendamento). | Obrigatório |

---

## 16. Módulo de Análises

*23 requisitos | 22 revisados (ok) | 1 pendente*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Acompanhamento de atendimentos por unidade de saúde. | Obrigatório |
| 2 | Análises por profissional. | Obrigatório |
| 3 | Análises por especialidade. | Obrigatório |
| 4 | Análises de viagens. | Desejável |
| 5 | Análises de atendimentos por bairro. | Obrigatório |
| 6 | Análises por sexo e idade. | Obrigatório |
| 7 | Relatórios de atendimentos ambulatoriais. | Obrigatório |
| 8 | Relatórios de agendamentos (consultas, exames, procedimentos). | Obrigatório |
| 9 | Relatórios de atendimentos por prestador. | Desejável |
| 10 | Relatórios de internações. | Obrigatório |
| 11 | Indicadores de internações: taxa de ocupação, tempo médio de permanência, taxa de rotatividade. | Obrigatório |
| 12 | Relatórios de regulação. | Obrigatório |
| 13 | Análises de indicadores em tempo real, incluindo indicadores da APS. | Obrigatório |
| 14 | Dashboards de atendimentos ambulatoriais. | Obrigatório |
| 15 | Dashboards de atendimentos hospitalares. | Obrigatório |
| 16 | Dashboards de atenção primária. | Obrigatório |
| 17 | Dashboards de farmácia. | Obrigatório |
| 18 | Dashboards laboratoriais. | Obrigatório |
| 19 | Dashboards de vacinas. | Obrigatório |
| 20 | Relatórios gerenciais de toda a estrutura da saúde municipal. | Obrigatório |
| 21 | Relatórios de capacidade instalada. | Obrigatório |
| 22 | Relatório de demandas reprimidas. | Obrigatório |
| 23 | Relatórios de todas as telas com filtros configuráveis e exportação para Excel. | Obrigatório |

---

## 17. Módulo de Aplicativos e Transparência

*35 requisitos | 34 revisados (ok) | 1 pendente*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Acompanhamento de consultas e exames pelo paciente. | Obrigatório |
| 2 | Cartão cidadão disponível no app. | Obrigatório |
| 3 | Cadastrar dependentes para acompanhamento de saúde. | Obrigatório |
| 4 | Visualizar resultados de exames lançados na estrutura própria do sistema. | Obrigatório |
| 5 | Baixar resultado do exame em PDF. | Obrigatório |
| 6 | Visualizar arquivos anexados no prontuário por prestador de serviços. | Obrigatório |
| 7 | Acompanhamento de vacinas aplicadas e cartão de vacina. | Obrigatório |
| 8 | Acompanhar fila de cirurgias eletivas com status. | Obrigatório |
| 9 | Visualizar boletim médico do paciente internado, via senha da internação. | Obrigatório |
| 10 | Visualizar unidades de atendimento com geração de rota no app. | Obrigatório |
| 11 | Registro de visita domiciliar do agente comunitário de saúde. | Obrigatório |
| 12 | Informar latitude/longitude na visita domiciliar. | Obrigatório |
| 13 | Cadastro do paciente pelo app, com validação posterior na unidade e possível unificação. | Obrigatório |
| 14 | Registro de cadastro individual do paciente com fichas conforme Ministério da Saúde. | Obrigatório |
| 15 | Cadastro domiciliar conforme regras do MS. | Obrigatório |
| 16 | Pesquisas determinadas pela gestão para o ACS. | Obrigatório |
| 17 | Controle do atendimento com visualização situacional da unidade (pacientes aguardando). | Obrigatório |
| 18 | Registrar vacinação conforme regras do SUS. | Obrigatório |
| 19 | ACS visualizar consultas/exames/procedimentos agendados e status via app. | Obrigatório |
| 20 | Acesso do paciente ao portal do cidadão para visualizar consultas agendadas. | Obrigatório |
| 21 | Cidadão acompanhar autorizações de solicitações médicas pelo portal. | Obrigatório |
| 22 | Acompanhamento de boletins médicos de pacientes internados na rede, pelo portal. | Obrigatório |
| 23 | Visualizar/baixar grade horária dos médicos por unidade. | Obrigatório |
| 24 | Listagem das filas de espera do município no portal. | Obrigatório |
| 25 | Visualizar filas de cirurgias eletivas. | Obrigatório |
| 26 | Visualizar filas de consultas agendadas. | Obrigatório |
| 27 | Visualizar filas de exames agendados. | Obrigatório |
| 28 | Visualizar leitos disponíveis no município. | Obrigatório |
| 29 | Visualizar listagem de medicamentos disponíveis no município pelo portal. | Obrigatório |
| 30 | Visualizar relação de médicos do município. | Obrigatório |
| 31 | Visualizar listagem de TFD do município em diferentes status. | Obrigatório |
| 32 | Acompanhar resultados de exames por paciente no portal. | Obrigatório |
| 33 | Visualizar cartão de vacinas no portal do cidadão. | Obrigatório |
| 34 | Validação da receita médica quando assinada digitalmente. | Obrigatório |
| 35 | Notificações de lembretes de consultas, exames, vacinas etc. | Obrigatório |

---

## 18. Módulo de Vigilância em Saúde

*9 requisitos | 0 revisados | 9 pendentes*

| Nº | Descrição do Requisito | Tipo |
|---|---|---|
| 1 | Emissão de receituário especial (azul) pela Vigilância Sanitária. | Obrigatório |
| 2 | Emissão de relatório de agravos de notificação compulsória. | Obrigatório |
| 3 | Alerta de doença de notificação compulsória conforme CID no atendimento médico. | Obrigatório |
| 4 | Alerta para emissão de RAAT em acidente/doença de trabalho, conforme CID. | Obrigatório |
| 5 | Emissão e preenchimento de RAAT. | Obrigatório |
| 6 | Relatório de RAAT pesquisável por nome do paciente, data, agravo e empresa. | Obrigatório |
| 7 | Campo específico no cadastro do usuário para sinalizar falecimento e data. | Obrigatório |
| 8 | Acesso à lista atualizada de doenças de notificação compulsória (protocolos do MS). | Obrigatório |
| 9 | Relatório de vacinas aplicadas por vacina, paciente, mãe, CPF, data. | Obrigatório |

---

## Resumo por módulo

| Módulo | Requisitos | Revisados (ok) | Pendentes |
|---|---|---|---|
| 1. Especificações Gerais | 50 | 0 | 50 |
| 2. Cadastros | 61 | 0 | 37 |
| 3. Ambulatorial | 73 | 60 | 2 |
| 4. Contratualizações | 12 | 12 | 0 |
| 5. SAMU | 30 | 0 | 30 |
| 6. Laboratorial | 85 | 13 | ver nota do módulo |
| 7. Farmácia | 45 | 45 | 0 |
| 8. Hospitalar e Pronto Atendimento | 52 | 3 | 49 |
| 9. Faturamento | 7 | 5 | 2 |
| 10. Integração com e-SUS | 20 | 9 | 11 |
| 11. PPI | 8 | 8 | 0 |
| 12. Odontologia | 20 | 4 | 16 |
| 13. Regulação | 23 | 20 | 3 |
| 14. Vacinação | 19 | 0 | 19 |
| 15. Transporte | 29 | 0 | 29 |
| 16. Análises | 23 | 22 | 1 |
| 17. Aplicativos e Transparência | 35 | 34 | 1 |
| 18. Vigilância em Saúde | 9 | 0 | 9 |
| **Total** | **601** | **235** | **531** |

---

## Acompanhamento (template)

Planilha/tabela sugerida por requisito:

| Módulo | Nº | Tipo | Revisão Secretaria | Status no Java atual | Ação recomendada | Notas / evidência |
|---|---|---|---|---|---|---|
| … | … | Obrigatório/Desejável | revisado / pendente | Implementado / Parcial / Não implementado | … | path/classe/tela |

Gap analysis (visão por módulo): `docs/requisitos/gap-analysis.md`.  
Planilha RF-a-RF (Sim/Parcial/Não × Fase 1/2) ainda a preencher abaixo.
