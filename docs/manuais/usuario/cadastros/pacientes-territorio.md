# Manual do usuário — Pacientes e território

| Campo | Valor |
|---|---|
| id | cadastros.pacientes-territorio |
| version | 1.4.0 |
| status | draft |
| atualizado | 2026-08-16 |

## Pacientes (RF-2.27 / RF-2.30)

Cadastre/edite com nome social sempre visível; “Desconhece” para mãe/pai; óbito revela data e certidão.

Campos CDS essenciais (cadastro individual APS): nacionalidade (+ IBGE nascimento se brasileira), raça/cor, etnia, deficiência, e-mail, NIS, escolaridade. A ficha mostra vínculos ativos com equipe/microárea e o domicílio/família CDS, se houver.

## Território (RF-2.29 · RF-17.11 / RF-17.12)

1. Menu **Território**
2. Aba **Equipes / Microáreas**: criar equipe na unidade atual e microáreas
3. Aba **Vínculos paciente**: ligar paciente ↔ equipe (+ microárea opcional); **Desativar** vínculo antigo
4. Aba **Domicílios / Famílias**: cadastrar imóvel (tipo LEDI), endereço, responsável familiar e membro opcional; filtrar por paciente; desativar domicílio
5. Aba **Visitas ACS**: registrar visita com paciente e/ou domicílio, motivo(s) e desfecho LEDI; lat/long opcional — se preenchidos, a lista mostra link **OSM** (mapa externo)
6. Na ficha do paciente, veja o resumo e use **Território** / **Abrir Território**

O seed demo já traz `eSF Demonstração 01`, microárea `01`, vínculos de Maria/João Exemplo e um domicílio CDS na Rua das Flores.

**Não nesta fase:** mapa embutido no sistema · lote XML de visita ACS · app móvel do agente.
