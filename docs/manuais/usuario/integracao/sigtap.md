---
id: faturamento.sigtap
title: Catálogo SIGTAP
type: user
module: faturamento
feature: sigtap
version: 0.5.0
product_min: 0.1.0
status: published
audience: [gestor, ti, faturamento]
related_rf: [RF-10.1, RF-9.1, RF-9.5]
related_screens: [/sigtap, /producao, /faturamento/lote/proc]
updated_at: 2026-08-17
---

# Catálogo SIGTAP — usuário

1. Abra **SIGTAP** no menu Gestão (`/sigtap`).
2. Busque por código ou nome; valide listas (um código por linha).
3. **Importar (recomendado offline):**
   - Peça ao TI o ZIP da competência (`TabelaUnificada_YYYYMM.zip`) — o site do Ministério costuma ficar fora do ar.
   - Coloque em `data/sigtap/` no servidor **ou** envie o ZIP/TXT/CSV na própria tela.
   - Alternativa: botão **Importar pasta local** (usa o que já estiver em `data/sigtap/`) ou `npm run sync:sigtap`.
4. Sem ZIP oficial: **Sincronizar seed** (catálogo piloto APS) ou a fixture de teste.
5. Em lotes de **Procedimentos (tipo 7)**, códigos `ABPG…` bloqueiam o envio.
   - O repair mostra hint com SIGTAP sugerido pelo mapa piloto (`abpg-map-piloto.json`, espelho do enum e-SUS).
   - Confirme na competência oficial antes de corrigir em massa.
6. Em Produção, o export BPA mostra quantos códigos são conhecidos no catálogo local.

Fontes alternativas do ZIP: ver `data/sigtap/README.md` (portal, FTP, espelho da TI estadual, SIGTAP Desktop).
