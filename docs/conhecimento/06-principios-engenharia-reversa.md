# Princípios da engenharia reversa controlada

Resumo operacional do prompt mestre. Manter alinhado em toda análise.

## Objetivo

Compreender comportamento do e-SUS → produzir **base de especificações** para outro agente implementar o sistema municipal.  
**Não** copiar o e-SUS.

## O que conservar

Regras de negócio, domínio, entidades, serviços, validações, workflows, controllers relevantes, DTOs/mappers, LEDI, SIGTAP/CNES quando presentes, produção SUS, segurança com efeito funcional, migrations/schema de domínio, enums, estados, exceções funcionais.

## O que descartar

Spring/Hibernate internals, codecs, logging, drivers, Apache genérico, UI framework genérico, dependências Maven irrelevantes, bibliotecas sem regra e-SUS.

## Não decompilar cegamente

1. Inventário completo  
2. Classificação de JARs (`ESUS_*` vs `THIRD_PARTY_*`)  
3. Filtro semântico  
4. Decompilação **seletiva** (CFR)  
5. Normalização  
6. Specs estruturadas em `spec/<modulo>/`

## Proveniência obrigatória

Toda regra deve apontar para:

```yaml
source:
  type: esus-decompiled
  version: 5.5.24
  jar: ...
  class: ...
  method: ...
```

## Níveis de confiança

| Nível | Uso |
|---|---|
| OFFICIAL_STRUCTURED | artefato oficial estruturado |
| OFFICIAL_DOCUMENTATION | docs oficiais MS |
| DIRECT_SOURCE | código/recurso do artefato |
| STRONG_INFERENCE | interpretação bem sustentada |
| WEAK_INFERENCE | hipótese frágil |
| UNKNOWN | não determinado |

Código decompilado ≈ `DIRECT_SOURCE`. Interpretação do agente ≈ `STRONG_INFERENCE` ou `WEAK_INFERENCE`.

## Nunca confundir com norma

> “Esta versão do e-SUS implementa este comportamento”  
> ≠  
> “Esta é a norma legal atual do SUS”

Confirmar depois com LEDI, SIGTAP, SIA, CNES, RNDS, documentação oficial.

## Specs tecnologicamente neutras

Ruim: `Executar VaccinationService.save()`.  
Bom: ao registrar vacinação válida, persistir, vincular cidadão/profissional e produzir dados para integração.

## Context packs

```bash
# futuro
sus build-context --module vaccination --mode reconstruction
```

Entregar 10–100 KB de spec + trechos mínimos de origem — **não** o JAR de 700+ MB.

## Diff de versões (preparar desde já)

```bash
sus diff esus 5.5.24 5.5.25
```

Estrutural + comportamental + impacto funcional (`REQUIRES_AI_REVIEW` quando automático falhar).

## Segurança

Sem dados reais de pacientes. Fixtures sintéticas. Se houver PII em artefato: parar ingestão e sinalizar.

## Critério de sucesso desta esteira

Não precisar entregar o JAR enorme ao agente de implementação; entregar specs + proveniência + trechos mínimos.
