# Mapeamento preliminar: TR Franca (SGS) × cobertura e-SUS APS

**Atualizado:** 2026-08-10  
**Status:** mapa por módulo consolidado.  
Gap analysis: `docs/requisitos/gap-analysis.md`.  
**Corte esforço inicial:** M5 SAMU, M6 Laboratorial e M15 Transporte/TFD **adiados** (−144 RF → backlog ativo **457**).

## Legenda

| Símbolo | Significado |
|---|---|
| ●●● | e-SUS APS é fonte forte de comportamento |
| ●●○ | parcial / overlapping |
| ●○○ | fraco / só conceitos vizinhos |
| ○○○ | e-SUS APS não cobre — TR + outras fontes |

## Por módulo do TR

| Módulo TR | Reqitos | e-SUS como fonte | Notas |
|---|---:|:---:|---|
| 1. Especificações Gerais | 50 | ●○○ | Plataforma (auth, auditoria, chat, 2FA…) — construir no SGS |
| 2. Cadastros | 61 | ●●○ | Unidade, profissional, paciente, equipes, território, vacinas, fichas — forte no APS; leitos/AIH/APAC/plantões — parcial/fora |
| 3. Ambulatorial | 73 | ●●○ | Atendimento APS/fichas/odonto/AD/coletivo — forte; totem/painel/UPA/Glasgow/AIH — TR |
| 4. Contratualizações | 12 | ○○○ | Fora do e-SUS APS |
| 5. SAMU | 30 | ○○○ (APS) · ●●● (`Samu/`) | **Reativado no backlog** — fonte federal/municipal em `Samu/`; ver `docs/conhecimento/12-samu-fonte-federal-backlog.md` |
| 6. Laboratorial | 85 | ●○○ | **Adiado** (LIS); pedido residual no ambulatorial permanece no ativo |
| 7. Farmácia | 45 | ●○○ | Prescrição existe; dispensação/estoque CAF é TR |
| 8. Hospitalar e PA | 52 | ●○○ | Pouco no APS; módulo próprio |
| 9. Faturamento | 7 | ●○○ | Produção via LEDI/SISAB no APS; BPA/APAC/AIH/CAPS — complementar |
| 10. Integração e-SUS | 20 | ●●● | Núcleo da engenharia reversa + normas |
| 11. PPI | 8 | ○○○ | Fora do APS |
| 12. Odontologia | 20 | ●●● | Forte no e-SUS (odontograma, fichas) |
| 13. Regulação | 23 | ●○○ | Encaminhamentos/cuidado compartilhado parciais; fila/portal — TR / e-SUS Reg |
| 14. Vacinação | 19 | ●●● | Fichas + regras vacinais fortes; rede de frio/estoque — complementar TR |
| 15. Transporte / TFD | 29 | ○○○ | **Adiado** do esforço inicial (pode voltar) |
| 16. Análises | 23 | ●●○ | Relatórios/indicadores parciais; BI municipal — TR |
| 17. Apps e Transparência | 35 | ●○○ | Visitas ACS/cadastro no app — parcial; portal cidadão amplo — TR |
| 18. Vigilância | 9 | ●●○ | Agravos/fichas parciais; RAAT/receituário especial — TR |

## Implicação de trabalho

1. Usar e-SUS primeiro para: **cidadão, território, equipes, atendimento APS, vacinação, odontologia, AD, atividades coletivas, LEDI/produção APS**.
2. Lacunas municipais **ainda no ativo:** farmácia estoque, hospitalar/UPA, PPI, contratualização, portal/app amplo, plataforma geral.
3. **Adiados** (sem fonte no monorepo ainda): LIS/Laboratorial, Transporte/TFD.  
   **SAMU:** reativado no backlog com fonte `Samu/` (stream S0–S4; fora do P0–P7 APS).
4. Módulo 10 do TR (integrações) é checklist de conformidade federal — cruzar com `docs/conhecimento/05-integracoes-e-gaps.md`.

## Colunas de acompanhamento (por requisito)

Ao auditar o Java legado / implementação:

| Coluna | Valores |
|---|---|
| Status no Java atual | `Implementado` / `Parcial` / `Não implementado` |
| Ação recomendada | implementar na reescrita / oportunidade / adiar / depende de norma |
| Revisão Secretaria | `revisado` / `pendente de revisão` (pode mudar escopo) |
