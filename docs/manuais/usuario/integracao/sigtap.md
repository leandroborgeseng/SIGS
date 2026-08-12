---
id: faturamento.sigtap
title: Catálogo SIGTAP
type: user
module: faturamento
feature: sigtap
version: 0.2.0
product_min: 0.1.0
status: published
audience: [gestor, ti, faturamento]
related_rf: [RF-10.1, RF-9.1, RF-9.5]
related_screens: [/sigtap, /producao]
updated_at: 2026-08-10
---

# Catálogo SIGTAP — usuário

1. Abra **SIGTAP** no menu Gestão.
2. Busque por código ou nome.
3. Valide listas de códigos (um por linha).
4. **Import MS:** quando o site DATASUS estiver no ar, baixe o zip, abra `TB_PROCEDIMENTO.txt` e envie na tela (perfil produção/TI). Enquanto offline, use **Sincronizar seed** (catálogo piloto local) ou o JSON stub.
5. Alternativa: import JSON stub / arquivo `data/sigtap/piloto-franca.json`.
6. Em Produção, o export BPA mostra quantos códigos são conhecidos.
