# Validar ficha odonto (XML LEDI)

1. Abra **Odontologia**.
2. Em **Validar XML LEDI FAO**, escolha o arquivo `.xml` ou cole o conteúdo.
3. Clique **Validar conformidade**.
4. Leia a tabela: `BLOCKER` e `MONEY_RISK` impedem envio confiável ao Siaps/RNDS.
5. Corrija no sistema de origem (CBO odonto, CPF/CNS, vigilância, problemas CIAP/CID, etc.) e revalide.

**Atenção:** Bundle FHIR/RIA não é o formato deste fluxo — use a Ficha de Atendimento Odontológico Individual (LEDI).

---

# Lote de XMLs (corrigir e baixar)

1. Abra **Odontologia → Lote LEDI FAO** (ou o botão **Lote XML / correção**).
2. Selecione vários arquivos `.xml` / `.esus.xml` e aguarde a validação.
3. Veja o resumo (quantas fichas com blocker e os códigos mais frequentes).
4. Em **Correções automáticas**, confirme o que o sistema pode aplicar sozinho:
   - `stNaoPossuiCpf` (quando há CNS/CPF → `false`)
   - INE padrão (opcional)
   - CIAP/CID padrão em lote (só se for clinicamente adequado para o conjunto)
5. Para o restante, clique na ficha na lista, informe CIAP/CID ou tipo de consulta e salve — o XML é regenerado e revalidado.
6. Baixe o **ZIP** com os XMLs corrigidos.

Os arquivos ficam no servidor do SIGS para este trabalho; não envie CNS reais para repositório Git.
