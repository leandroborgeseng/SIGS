# Validar ficha odonto (XML LEDI)

1. Abra **Odontologia**.
2. Em **Validar XML LEDI FAO**, escolha o arquivo `.xml` ou cole o conteúdo.
3. Clique **Validar conformidade**.
4. Leia a tabela: `BLOCKER` e `MONEY_RISK` impedem envio confiável ao Siaps/RNDS.
5. Corrija no sistema de origem (CBO odonto, CPF/CNS, vigilância, problemas CIAP/CID, etc.) e revalide.

**Atenção:** Bundle FHIR/RIA não é o formato deste fluxo — use a Ficha de Atendimento Odontológico Individual (LEDI).

---

# Lote de XMLs (corrigir e baixar)

1. Abra o lote do tipo certo (menu **Faturamento & Validação**):
   - **Hub:** `/faturamento`
   - **FAO (odonto):** `/faturamento/lote/fao` (alias `/odonto/lote`)
   - **FAI (individual):** `/faturamento/lote/fai` (alias `/aps/lote`)
   - **Procedimentos:** `/faturamento/lote/proc` (alias `/procedimentos/lote`)
   - **Fila odonto:** `/faturamento/odonto` (deep-link `encounterId` / `batchId`)
2. Envie vários `.xml` / um `.zip` e aguarde a validação.
3. Veja o resumo (blockers, Siaps-ready, barras de erro).
4. **Opcional:** clique **Dry-run** para simular a auto-correção sem gravar (mostra quantos alertas somem).
5. Clique numa barra de erro → **guia** → corrigir em lote ou abrir ficha a ficha.
6. Baixe o **ZIP** (atuais ou só conformes) e o **Relatório fechamento (.md)** para arquivar.
7. Depois do tratamento, **Relatório do que falta**: tabela (arquivo, UUID, CPF/CNS mascarados, data, profissional, códigos LEDI) + CSV/Markdown/**PDF (secretaria)**. Só o que ainda impede faturar a contento.
8. Não envie CNS reais para repositório Git.
