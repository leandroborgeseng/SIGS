# Adendo Claude Design — alinhamento pós-specs e-SUS

**Quando usar:** depois que a geração atual terminar (ou como mensagem complementar, **não** substituindo o prompt mestre).

Copie o bloco abaixo.

---

```text
Adendo de alinhamento (SGS MVP) — aplicar nas telas já desenhadas, sem mudar o design system.

1) Fila de atendimento (D2) — usar estes status (rótulo PT-BR + código interno):
- Aguardando atendimento (WAITING)
- Em escuta inicial (INITIAL_LISTENING)
- Em atendimento (IN_PROGRESS)
- Atendimento realizado (COMPLETED)
- Não aguardou atendimento (LEFT_WITHOUT_CARE)
- Aguardando observação (WAITING_OBSERVATION)
- Em observação (IN_OBSERVATION)
- Evadiu (LEFT_OBSERVATION)

Badges com texto + cor (não só cor).

2) Agenda (C4) — situações:
- Agendado (SCHEDULED) — única que permite excluir
- Cidadão presente na unidade (PRESENT)
- Não compareceu (NO_SHOW)
- Não aguardou (LEFT)
- Cancelado (CANCELLED)
- Atendimento realizado (COMPLETED)
- Excluído (DELETED)

3) Paciente (B5) — garantir campos:
- Nome completo, nome social
- CPF e/ou CNS
- Data nascimento, sexo, raça/cor
- Nome da mãe (+ checkbox “desconhece”)
- Nome do pai (+ checkbox “desconhece”) opcional
- Óbito (flag + data condicional)
- Endereço, telefones, e-mail

4) Vacinação (E1) — fluxo de linha de dose:
Imunobiológico → Estratégia → Dose → Grupo de atendimento → Lote → Fabricante → Via → Local de aplicação.
Se Estratégia = Especial → exigir CBO do prescritor + CID de indicação.
Se imunobiológico BCG → exigir “comunicante de hanseníase”.
Se pesquisa clínica → campos ANVISA (protocolo, versão, registro).

5) Ajuda: manter Central de Ajuda + “?” contextual (já no prompt).

Não adicionar módulos fora do MVP.
```
