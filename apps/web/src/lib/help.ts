export type HelpArticle = {
  id: string;
  title: string;
  module: string;
  version: string;
  updatedAt: string;
  summary: string;
  body: string;
};

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'plataforma.login',
    title: 'Entrar no SIGS',
    module: 'Plataforma',
    version: '1.0.0',
    updatedAt: '2026-08-10',
    summary: 'Como autenticar e selecionar a unidade de trabalho.',
    body: `Use e-mail e senha corporativos. Após o login, escolha a UBS se você atende em mais de uma unidade. A sessão usa token Bearer; ao sair, o token é removido do navegador.`,
  },
  {
    id: 'plataforma.painel',
    title: 'Painel inicial',
    module: 'Plataforma',
    version: '0.1.0',
    updatedAt: '2026-08-10',
    summary: 'Resumo da unidade: fila, pacientes e lotes.',
    body: `O painel mostra contagens da unidade atual, a fila resumida e atalhos. Use Ctrl K (ou o campo de busca no topo) para ir à busca de pacientes. “Garantir dados demo” (perfil TI) cria a UBS Centro Demonstração sem dados reais.`,
  },
  {
    id: 'cadastros.pacientes',
    title: 'Cadastro de pacientes',
    module: 'Cadastros',
    version: '1.2.0',
    updatedAt: '2026-08-16',
    summary: 'Siaps (CPF/CNS/DN) + CDS RF-2.30 Previne na ficha; nome social e óbito condicional.',
    body: `Em /pacientes/novo e /pacientes/[id]: badge vermelho Siaps em nome civil, DN, sexo, mãe (ou Desconhece), CPF/CNS e óbito. Na ficha, bloco CDS (nacionalidade/IBGE, raça/cor, etnia, deficiência, NIS) usa laranja Previne/Indicador — qualidade de denominador, sem inventar BLOCKER LEDI. Manual: docs/manuais/usuario/cadastros/pacientes-territorio.md · convenção docs/manuais/campos-siaps-previne.md. Vínculos e domicílio CDS: atalho Território.`,
  },
  {
    id: 'cadastros.unidades',
    title: 'Unidades e IBGE',
    module: 'Cadastros',
    version: '0.1.0',
    updatedAt: '2026-08-11',
    summary: 'CNES e código IBGE do município para produção LEDI.',
    body: `Em Unidades, default = Rede Prefeitura (mantenedora) — natureza jurídica 1244 / CNPJ 47970769000104 (~59 ativas). Toggle «Todos IBGE» mostra a cidade (~545 ativas). Botão «Sincronizar rede municipal» importa só a Prefeitura (POST /v1/cnes/sync?gestao=municipal). API GET /v1/facilities?gestao=municipal&ibge=3516200. Auditoria: /cadastros/cnes-auditoria.`,
  },
  {
    id: 'cadastros.cnes-auditoria',
    title: 'Auditoria cadastro CNES',
    module: 'Cadastros',
    version: '0.4.0',
    updatedAt: '2026-08-16',
    summary: 'Checks Facility/Team vs snapshot CNES — glossário, deep-links e seed demo.',
    body: `Em /cadastros/cnes-auditoria: glossário de colunas/códigos/severidades; clique em CNES → /unidades?cnes=; INE → /equipes/[id] ou ?ine=; assignment → /lotacoes?assignmentId=. Badge «demo» em CNES 9999999 / INE 0000000001. Sync: «Sincronizar rede municipal» + «Importar profissionais lotados». Critério: natureza 1244. Export CSV. Sem PHI. Membros: /equipes.`,
  },
  {
    id: 'cadastros.equipes',
    title: 'Equipes e membros CNES',
    module: 'Cadastros',
    version: '0.1.0',
    updatedAt: '2026-08-16',
    summary: 'Lista equipes municipais, membros e profissionais em mais de uma equipe.',
    body: `Em /equipes: clique na equipe para ver membros (nome, CNS, CBO/função). Painel «Em mais de uma equipe» cruza lotações ativas. Tipos CNES com label (76 = EAP — Equipe de Atenção Primária). APIs: GET /v1/cnes/teams, /v1/cnes/teams/:id, /v1/cnes/multi-team, /v1/cnes/team-types. Pré-requisito: sync unidades/equipes + sync-professionals.`,
  },
  {
    id: 'cadastros.lotacao',
    title: 'Lotação de profissionais',
    module: 'Cadastros',
    version: '0.2.0',
    updatedAt: '2026-08-10',
    summary: 'Vínculo profissional × unidade × CBO (obrigatório para produção).',
    body: `Em Lotações, vincule um profissional à unidade atual com CBO (4–6 dígitos) e função. Equipe é opcional e deve pertencer à mesma unidade. Sem lotação ativa, finalizar consulta ou registrar vacina é bloqueado (produção LEDI exige CNS+CBO+CNES+INE). Para ver composição das equipes CNES: /equipes.`,
  },
  {
    id: 'agenda.slots',
    title: 'Agenda e exclusão de slot',
    module: 'Agenda',
    version: '1.2.0',
    updatedAt: '2026-08-13',
    summary: 'Agenda da unidade · clínicas em /odonto/agenda e /aps/agenda · só excluir se Agendado.',
    body: `A lista e a criação de slots em /agenda ficam no escopo da unidade. Para grade do dia e abertura de ficha, use Agenda odonto ou Agenda APS (consulta agendada tipo 2 vs encaixe tipo 5). Status: Agendado, Presente na unidade, Não compareceu, Não aguardou, Cancelado, Realizado, Excluído. A exclusão só é permitida quando o status atual é Agendado.`,
  },
  {
    id: 'aps.atendimento',
    title: 'Atendimento APS — ficha FAI',
    module: 'Atendimento',
    version: '0.3.0',
    updatedAt: '2026-08-16',
    summary:
      'FAI tipo 4: campos Siaps (vermelho) vs Previne (laranja), SOAP, antropometria, preview Siaps-ready e fila /faturamento/aps.',
    body: `Em /aps escolha paciente, profissional e lotação (INE obrigatório por padrão, como no odonto) — ou abra a partir de /aps/agenda (slot do dia: consulta agendada tipo 2 ou encaixe tipo 5). A ficha /aps/[id] é paralela ao /odonto — não mistura odontograma. Campos com badge vermelho Siaps (tipo/local, CIAP/CID, condutas, stNaoPossuiCpf) são obrigatórios para finalizar; laranja Previne/Indicador (turno, gestante, antropometria) orienta indicadores e não bloqueia se Siaps ok. Manual: docs/manuais/usuario/ambulatorial/atendimento-aps-fai-onda1.md · convenção docs/manuais/campos-siaps-previne.md. Finalizar e faturar exige zero BLOCKER e grava ProductionBatch individual_encounter. Pós-fechamento: fila /faturamento/aps e lote XML /faturamento/lote/fai.`,
  },
  {
    id: 'atendimento.fila',
    title: 'Fila de atendimento',
    module: 'Atendimento',
    version: '1.2.0',
    updatedAt: '2026-08-10',
    summary: 'Oito status da fila D2 e atendimento clínico SOAP.',
    body: `Status: Aguardando, Escuta inicial, Em atendimento, Aguardando observação, Em observação, Realizado, Não aguardou, Evadiu. Se o cidadão já estiver na fila do dia, “Entrar na fila” continua o mesmo atendimento (não cria duplicata). No atendimento clínico, registre SOAP, CIAP/CID e finalize com desfecho (Alta, Retorno…). O profissional precisa de lotação ativa na unidade para gerar o lote de produção.`,
  },
  {
    id: 'atendimento.prescricao',
    title: 'Prescrição e receitas',
    module: 'Atendimento',
    version: '0.1.0',
    updatedAt: '2026-08-10',
    summary: 'Catálogo municipal, fora do padrão com alerta e emissão.',
    body: `No atendimento clínico, escolha um medicamento do catálogo ou digite fora do padrão (gera alerta). Dose, frequência, duração e via são obrigatórios no rascunho. Emita a receita em /prescricoes/:id — itens fora do padrão pedem confirmação (forceOffCatalog). Tipos: comum, especial e controle.`,
  },
  {
    id: 'regulacao.fila',
    title: 'Central de regulação',
    module: 'Regulação',
    version: '0.1.0',
    updatedAt: '2026-08-10',
    summary: 'Solicitar procedimento, fila e decisão do regulador.',
    body: `No atendimento clínico, envie um procedimento pré-regulado (ou fora do protocolo com alerta). Em /regulacao o regulador vê a fila, classifica (verde/amarelo/vermelho/azul), autoriza, devolve por falta de dados ou nega com motivo. Alguns procedimentos exigem CID.`,
  },
  {
    id: 'coletivo.stub',
    title: 'Atividade coletiva',
    module: 'Ambulatorial',
    version: '0.4.0',
    updatedAt: '2026-08-16',
    summary: 'Ficha coletiva APS com destaque Siaps/Previne e produção LEDI v2.',
    body: `Registre educação em saúde ou reunião. Badge vermelho Siaps: tipo, tema, público e nº de participantes (≥1, COLLECTIVE_QTY). Laranja Previne: turno e procedimento SIGTAP (ex. escovação 0101050011 → B4). Manual: docs/manuais/usuario/ambulatorial/atividade-coletiva.md. Finalizar exige lotação do profissional. Gera lote collective_activity — quantidade no BPA = participantes.`,
  },
  {
    id: 'vacinacao.aplicacao',
    title: 'Aplicação de vacina',
    module: 'Vacinação',
    version: '1.3.0',
    updatedAt: '2026-08-16',
    summary: 'Cascata imuno→estratégia→dose com campos Siaps (vermelho); estoque/frio MVP.',
    body: `Em /vacinacao aba Aplicar: paciente, imunobiológico, estratégia, dose, lote, fabricante, via e local têm badge Siaps (vermelho) — VAC_IMUNO_MISSING / VAC_LOT_MISSING no pré-envio. Estratégia Especial exige CBO e CID. Manual: docs/manuais/usuario/vacinacao/aplicacao.md. A aplicação gera lote vaccination; estoque do mesmo lote baixa qty; anulação devolve. Lista do dia respeita a unidade.`,
  },
  {
    id: 'relatorios.minimos',
    title: 'Relatórios mínimos',
    module: 'Relatórios',
    version: '1.1.0',
    updatedAt: '2026-08-10',
    summary: 'Atendimentos e vacinas por período.',
    body: `O período padrão é o mês corrente na unidade selecionada. Filtre e exporte CSV para conferência operacional.`,
  },
  {
    id: 'cadastros.territorio',
    title: 'Território APS',
    module: 'Cadastros',
    version: '1.3.0',
    updatedAt: '2026-08-16',
    summary: 'Vínculos Previne + domicílio/visita ACS com FieldHint Siaps.',
    body: `Em /territorio: vínculos paciente↔equipe com badge Previne (denominador). Domicílio CDS: Siaps em equipe, tipo de imóvel, logradouro e responsável. Visita ACS: Siaps em paciente/domicílio, desfecho e motivos; turno e lat/long em Previne (RF-17.12 → link OSM). Manual: docs/manuais/usuario/cadastros/pacientes-territorio.md. Sem mapa embutido e sem lote XML nesta fase.`,
  },
  {
    id: 'odonto.atendimento',
    title: 'Atendimento odontológico',
    module: 'Odontologia',
    version: '1.8.0',
    updatedAt: '2026-08-16',
    summary:
      'FAO com campos Siaps (vermelho) × Previne (laranja), odontograma, ciclo tratamento e fila /faturamento/odonto.',
    body: `Em /odonto escolha paciente, profissional e lotação — ou abra a partir de /odonto/agenda. Na ficha /odonto/[id]: legenda Siaps (vermelho) vs Previne (laranja). Obrigatórios Siaps: stNaoPossuiCpf, tipo/local, CIAP/CID, vigilância, condutas. Previne: turno, SIGTAP B1–B6, conduta 15 (B2), vigilância só 99 (aviso). Concluir consulta exige zero BLOCKER Siaps. Manual: docs/manuais/usuario/odonto/atendimento-onda1.md · convenção docs/manuais/campos-siaps-previne.md.`,
  },
  {
    id: 'odonto.agenda',
    title: 'Agenda odontológica',
    module: 'Odontologia',
    version: '0.2.0',
    updatedAt: '2026-08-13',
    summary: 'Grade do dia, consulta agendada vs encaixe, abrir ficha odonto a partir do slot (RF-12.1).',
    body: `Em /odonto/agenda filtre o dia da unidade. A vista padrão é a grade (horários × profissional, faixa 07:00–19:00). Crie Consulta agendada (LEDI tipoAtendimento=2) ou Encaixe / consulta no dia (tipo 5). Abrir cria o DentalEncounter vinculado ao slot, marca Presente e leva a /odonto/[id]. Falta marca NO_SHOW. Slots da linha APS não abrem aqui — use /aps/agenda. Não cobre cadastro livre de tipos de item, salas, grade municipal compartilhada nem SAMU.`,
  },
  {
    id: 'aps.agenda',
    title: 'Agenda APS',
    module: 'Atendimento',
    version: '0.1.0',
    updatedAt: '2026-08-13',
    summary: 'Mesmo modelo de slot da odonto: grade do dia e abertura da ficha FAI (RF-3.5).',
    body: `Em /aps/agenda a grade e os tipos de item são os mesmos da agenda odonto (consulta agendada = tipo 2, encaixe = tipo 5). Abrir cria Encounter origem FAI vinculado ao slot e navega para /aps/[id]. Abertura espontânea sem agenda continua em /aps. Slots marcados como odonto não abrem FAI. Sem SAMU, sem cadastro TR completo de tipos de item.`,
  },
  {
    id: 'odonto.stub',
    title: 'Odontologia',
    module: 'Odontologia',
    version: '0.5.0',
    updatedAt: '2026-08-12',
    summary: 'Alias — ver odonto.atendimento / odonto.agenda.',
    body: `Fluxo: /odonto/agenda (agendado) ou /odonto (espontâneo) → /odonto/[id] → /faturamento/odonto. Ajuda: odonto.atendimento · odonto.agenda.`,
  },
  {
    id: 'faturamento.hub',
    title: 'Faturamento & Validação',
    module: 'Faturamento',
    version: '0.8.0',
    updatedAt: '2026-08-16',
    summary: 'Hub: filas, lotes LEDI 2–8/10, auditoria e regras internas do funil.',
    body: `Em /faturamento: (1) Filas odonto/APS; (2) Lotes LEDI live — tipos 2,3,4,5,6,7,8,10 no mesmo wizard (upload→gate→críticas→autofix→2 ZIPs). Vacina 14 = stub. (3) Auditoria; (4) Produção/BPA.

Regras internas (todos os usuários) — abra na Central de Ajuda:
• Funil pré-envio — faturamento.funil-pre-envio
• O que é checado por tipo — faturamento.regras-por-tipo
• Cruzamentos produção×cadastro×CNES — faturamento.cruzamentos
• Siaps (envio) × Previne (financiamento) — faturamento.siaps-vs-previne

No hub há atalhos para esses artigos. API: GET /v1/faturamento/ledi-cds-lotes.`,
  },
  {
    id: 'faturamento.funil-pre-envio',
    title: 'Funil pré-envio — passo a passo',
    module: 'Faturamento',
    version: '1.0.0',
    updatedAt: '2026-08-16',
    summary: 'Upload → gate de tipo → crítica → autofix → aptos/pendentes → governo.',
    body: `O SIGS não envia sozinho ao Ministério. Ele abre o ZIP, critica, corrige o que for seguro e separa o que já pode ir.

Passo a passo:
1. Upload — escolha o lote do tipo certo em /faturamento e solte o ZIP.
2. Gate de tipo — ZIP de outro tipo é recusado e a análise não roda. Abra a tela correta.
3. Análise — quantidade, já podem enviar (Pronto Siaps), erros, correção em lote vs individual.
4. Problema a problema — do mais grave ao menos; corrija em lote quando o botão permitir.
5. Fechamento — gráfico antes×depois. Pronto Siaps = pode enviar; Pronto Previne = qualidade/indicador; 100% OK = os dois.
6. Dois ZIPs — aptos para envio e ainda precisam correção.
7. Ficha a ficha — o que restou de correção manual.

Pré-requisito: sincronizar rede municipal em Cadastros → Auditoria CNES.

Relacionados: faturamento.regras-por-tipo · faturamento.cruzamentos · faturamento.siaps-vs-previne.`,
  },
  {
    id: 'faturamento.regras-por-tipo',
    title: 'O que é checado por tipo de ficha',
    module: 'Faturamento',
    version: '1.0.0',
    updatedAt: '2026-08-16',
    summary: 'Tipos 2,3,4,5,6,7,8,10,14 — Siaps vs qualidade/Previne.',
    body: `Em toda ficha o sistema olha o cabeçalho: CNES, equipe (INE), CNS e CBO do profissional, município, UUID.

Tipo 2 Cadastro Individual — nome, DN, sexo, mãe, CPF/CNS (Siaps); nacionalidade/raça/NIS e vínculo com equipe (Previne). Lote: /faturamento/lote/cadastro-individual.

Tipo 3 Domiciliar — imóvel, responsável, equipe (Siaps); microárea e família para visitas (Previne). Lote: /domicilio.

Tipo 4 FAI — stNaoPossuiCpf, CIAP/CID, condutas (Siaps); INE, turno, gestante, antropometria (Previne). Lote: /lote/fai.

Tipo 5 FAO — stNaoPossuiCpf e CIAP/CID (Siaps); INE eSB, procedimentos e conclusão (Previne B1–B6). A FAO pode ser aceita no Siaps sem ficha tipo 2 no ZIP; Previne precisa da pessoa vinculada. Lote: /lote/fao.

Tipo 6 Coletivo — participantes e quantidade (Siaps); escovação B4 fora da FAO (Previne). Lote: /coletivo.

Tipo 7 Procedimentos — identidade e CNES (Siaps); código SIGTAP (não ABPG). Lote: /lote/proc.

Tipo 8 Visita ACS — paciente/domicílio, desfecho, motivos (Siaps); janelas de visita (Previne). Lote: /visita-acs.

Tipo 10 AD — cidadãos, modalidade, procedimento (Siaps); continuidade e CIAP (qualidade). Lote: /ad.

Tipo 14 Vacina — campos Siaps na tela /vacinacao; lote ZIP ainda não nesta onda.

Relacionados: faturamento.funil-pre-envio · faturamento.cruzamentos · faturamento.siaps-vs-previne.`,
  },
  {
    id: 'faturamento.cruzamentos',
    title: 'Cruzamentos entre fichas e CNES',
    module: 'Faturamento',
    version: '1.0.0',
    updatedAt: '2026-08-16',
    summary: 'Produção × cadastro individual × domicílio × CNES/equipe.',
    body: `O Siaps olha cada ficha quase sozinha. O Previne e a qualidade municipal pedem o grafo: pessoa ↔ equipe ↔ domicílio ↔ produção.

O que o SIGS cruza:
• Produção × rede — CNES ativo na Prefeitura; CNS lotado + CBO; INE da equipe no CNES; profissional multi-equipe sem INE claro.
• Produção × Cadastro Individual (tipo 2) — cidadão existe (CNS/CPF); vínculo com a equipe do cabeçalho; sexo/DN coerentes.
• Tipo 2 × Domicílio (tipo 3) — pessoa membro/responsável; domicílio com responsável válido.
• Visita ACS × domicílio × pessoa — visita aponta para cadastros existentes.
• Coletivo × B4 e PROC × SIGTAP — escovação no coletivo; ABPG deve virar SIGTAP.

Onde agir: /cadastros/cnes-auditoria · /equipes · /pacientes · /territorio · /faturamento/auditoria · wizard do lote.

Mensagem: corrigir só stNaoPossuiCpf + CIAP abre a porta do envio; sem cadastro/vínculo/procedimento certo o indicador continua baixo.

Relacionados: faturamento.funil-pre-envio · faturamento.regras-por-tipo · faturamento.siaps-vs-previne.`,
  },
  {
    id: 'faturamento.siaps-vs-previne',
    title: 'Siaps (envio) × Previne (financiamento)',
    module: 'Faturamento',
    version: '1.0.0',
    updatedAt: '2026-08-16',
    summary: 'Vermelho = envio legal; laranja = indicador. Pronto Siaps ≠ Pronto Previne.',
    body: `Dois eixos:
• Siaps / envio LEDI — ficha aceita no Siaps/SISAB. Se falhar: rejeição, produção não conta.
• Previne Brasil — scores sobre produção já aceita + cadastro e vínculo. Se falhar: indicador baixo e impacto no repasse.

Na tela: badge vermelho Siaps = obrigatório para enviar; laranja Previne = qualidade (não bloqueia se Siaps ok). No lote: Pronto Siaps · Pronto Previne · 100% OK.

Cadastro individual — mínimo Siaps: nome, DN, sexo, mãe (ou Desconhece), CPF ou CNS. Completude Previne: nacionalidade, raça, NIS, vínculo equipe/INE, domicílio, condições clínicas, sem duplicata.

Exemplos: FAO sem CIAP bloqueia Siaps; FAO ok sem cadastro/vínculo passa Siaps mas prejudica Previne; escovação B4 é no coletivo (tipo 6), não na FAO.

Relacionados: faturamento.funil-pre-envio · faturamento.regras-por-tipo · faturamento.cruzamentos · cadastros.pacientes.`,
  },
  {
    id: 'faturamento.lote-cds',
    title: 'Lote LEDI CDS (2/3/6/8/10)',
    module: 'Faturamento',
    version: '0.3.0',
    updatedAt: '2026-08-16',
    summary: 'Wizard ZIP CDS com críticas Siaps/header e cruzamento municipal.',
    body: `Rotas /faturamento/lote/{cadastro-individual,domicilio,coletivo,visita-acs,ad}. Mesmo shell dos lotes 4/5/7. Sem amostra XML real no dump Franca — regras por cabeçalho/identidade + mínimas por tipo. Autofix seguro (stNaoPossuiCpf, CNES/IBGE…). Cruzamento CNS×CNES×INE com cadastro mestre sincronizado.

Regras: faturamento.funil-pre-envio · faturamento.regras-por-tipo · faturamento.cruzamentos · faturamento.siaps-vs-previne. Vacina 14 fora desta onda.`,
  },
  {
    id: 'faturamento.lote-cds-stub',
    title: 'Lote CDS (legado stub)',
    module: 'Faturamento',
    version: '0.2.0',
    updatedAt: '2026-08-16',
    summary: 'Substituído pelo wizard live — ver faturamento.lote-cds.',
    body: `Tipos 2/3/6/8/10 usam o wizard live (help faturamento.lote-cds). Vacina 14 permanece fora desta onda. Regras: faturamento.funil-pre-envio.`,
  },
  {
    id: 'faturamento.auditoria',
    title: 'Auditoria de faturamento',
    module: 'Faturamento',
    version: '0.2.0',
    updatedAt: '2026-08-16',
    summary: 'Cruzamento produção × rede municipal CNES/INE/CNS/CBO/SIGTAP por competência.',
    body: `Em /faturamento/auditoria escolha a competência (YYYY-MM). Escopo default = rede municipal (Prefeitura; natureza jurídica 1244). Severidade blocker bloqueia envio; quality é qualidade/Previne. Checks: CNES ativo, INE, CNS/CBO vs lotação, SIGTAP, CIAP, conduta. Export CSV. Sem PHI. Não altera o wizard LEDI.

Ver também: faturamento.cruzamentos · faturamento.siaps-vs-previne.`,
  },
  {
    id: 'faturamento.fila-aps',
    title: 'Fila de faturamento APS',
    module: 'Faturamento',
    version: '0.1.0',
    updatedAt: '2026-08-13',
    summary: 'Produção do mês da ficha FAI tipo 4: competência, buckets LEDI, deep-link e lote FAI.',
    body: `Em /faturamento/aps veja os atendimentos APS da competência (unidade atual). Cores iguais ao lote FAI: bloqueia envio, qualidade incompleta, indicadores, em preenchimento, pronto. Atualizar revalida pendências; Revalidar pendências faz sync em lote. Deep-link: ?encounterId= e ?batchId= (Tela C em /aps/[id] após finalizar). XML importado / ZIP: /faturamento/lote/fai. Alias: /aps/faturamento.`,
  },
  {
    id: 'odonto.lote-ledi',
    title: 'Lote LEDI FAO — validar e corrigir XMLs',
    module: 'Odontologia',
    version: '1.3.0',
    updatedAt: '2026-08-16',
    summary: 'Upload de XMLs odonto, inconsistências, auto-correção e download ZIP.',
    body: `Em Faturamento → Lote FAO (/faturamento/lote/fao): wizard único (upload → gate → análise → problema a problema → fechamento → dois ZIPs → ficha a ficha). Pronto Siaps ≠ Pronto Previne ≠ 100% OK. ZIP do tipo errado é recusado.

Regras do funil: faturamento.funil-pre-envio · faturamento.regras-por-tipo · faturamento.cruzamentos · faturamento.siaps-vs-previne. Alias: /odonto/lote.`,
  },
  {
    id: 'faturamento.lote-fai',
    title: 'Lote LEDI FAI — atendimento individual',
    module: 'Faturamento',
    version: '0.3.0',
    updatedAt: '2026-08-16',
    summary: 'Upload/validação de XMLs FAI (tipo 4), correção e export ZIP.',
    body: `Em /faturamento/lote/fai: wizard FAI tipo 4. Upload → gate → análise → problema a problema → fechamento → dois ZIPs → ficha a ficha. Pronto Siaps ≠ Pronto Previne ≠ 100% OK. ZIP FAO/PROC nesta tela é recusado.

Regras: faturamento.funil-pre-envio · faturamento.regras-por-tipo · faturamento.cruzamentos · faturamento.siaps-vs-previne. Fila nativa: /faturamento/aps. Alias: /aps/lote.`,
  },
  {
    id: 'faturamento.lote-proc',
    title: 'Lote LEDI Procedimentos',
    module: 'Faturamento',
    version: '0.2.0',
    updatedAt: '2026-08-16',
    summary: 'Upload/validação de XMLs de Procedimentos (tipo 7) e export ZIP.',
    body: `Em /faturamento/lote/proc: mesmo wizard FAI/FAO (gate tipo 7 → análise → dois ZIPs). Priorize CPF/CNS, turno e CNES; ABPG/SIGTAP na ficha.

Regras: faturamento.funil-pre-envio · faturamento.regras-por-tipo · faturamento.cruzamentos · faturamento.siaps-vs-previne. Alias: /procedimentos/lote.`,
  },
  {
    id: 'ad.stub',
    title: 'Atenção domiciliar',
    module: 'Ambulatorial',
    version: '0.4.0',
    updatedAt: '2026-08-16',
    summary: 'Visita AD1/AD2/AD3 com campos Siaps/Previne e produção LEDI v2.',
    body: `Em /ad: cidadãos (≥1), modalidade AD e procedimento têm badge Siaps (vermelho). Turno, tipo, desfecho e CIAP/CID são Indicador (laranja — QUALITY_WARN no preflight). Use Preflight antes de Finalizar — lote home_care com N atendimentosDomiciliares. Manual: docs/manuais/usuario/ambulatorial/atencao-domiciliar.md.`,
  },  {
    id: 'producao.ledi',
    title: 'Produção e lotes LEDI',
    module: 'Produção',
    version: '1.7.0',
    updatedAt: '2026-08-11',
    summary: 'Pré-envio, lifecycle (erro/reprocessar) e BPA stub.',
    body: `Status: rascunho, pronto, enviado, erro. Avalie antes de enviar. Lotes com erro: corrija e use Reprocessar. Enviados podem ser Reabertos localmente. Finalize atendimento/vacina com lotação — o lote sai com CBO+CNS+CNES+INE+IBGE.`,
  },
  {
    id: 'sigtap.catalogo',
    title: 'Catálogo SIGTAP',
    module: 'Faturamento',
    version: '0.3.0',
    updatedAt: '2026-08-11',
    summary: 'Seed piloto local, JSON stub e import MS quando disponível.',
    body: `O catálogo local traz dezenas de códigos APS (consulta, vacina, odonto, AD, coletivo, regulação). Use “Sincronizar seed” se faltar código após atualização. Import MS (TB_PROCEDIMENTO) quando o DATASUS estiver no ar; senão use JSON stub.`,
  },
  {
    id: 'admin.usuarios',
    title: 'Usuários',
    module: 'Administração',
    version: '0.1.0',
    updatedAt: '2026-08-10',
    summary: 'Criar contas e vincular perfis.',
    body: `Requer permissão de gestão de usuários. Informe nome, e-mail, senha e perfil (TI, gestor, profissional…).`,
  },
  {
    id: 'admin.grupos',
    title: 'Grupos e perfis',
    module: 'Administração',
    version: '0.1.0',
    updatedAt: '2026-08-10',
    summary: 'Matriz de permissões por perfil.',
    body: `Tela de leitura dos perfis e permissões efetivas (ex.: production.manage, *). Edição avançada fica para iterações seguintes.`,
  },
  {
    id: 'admin.auditoria',
    title: 'Auditoria',
    module: 'Administração',
    version: '0.1.0',
    updatedAt: '2026-08-10',
    summary: 'Log de ações com RF.',
    body: `Lista as últimas ações (login, finish encounter, export_bpa, import_ms…). Filtre por texto livre.`,
  },
  {
    id: 'fila.totem',
    title: 'Totem de senhas',
    module: 'Ambulatorial',
    version: '0.1.0',
    updatedAt: '2026-08-10',
    summary: 'Emitir senha por tipo de serviço.',
    body: `Escolha o tipo (comum, prioritário, vacina, odonto). Opcionalmente vincule um paciente. A senha aparece no painel TV da unidade.`,
  },
  {
    id: 'fila.guiche',
    title: 'Guichê / chamada',
    module: 'Ambulatorial',
    version: '0.1.0',
    updatedAt: '2026-08-10',
    summary: 'Chamar próxima senha no painel.',
    body: `Informe o guichê/consultório e chame a próxima (prioritário primeiro). Se a senha tiver paciente, pode abrir atendimento na fila APS.`,
  },
];
