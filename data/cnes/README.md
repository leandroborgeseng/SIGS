# README — snapshots CNES

JSON público (sem PHI) para sync offline do município.

| Arquivo | IBGE | Conteúdo |
|---|---|---|
| `franca-3516200.json` | 3516200 | Estabelecimentos (API Dados Abertos) + equipes (CnesWeb) |

Regenerar:

```bash
# via sync live (quando a rede permitir) — o loader persiste no banco;
# para renovar o arquivo, use o script de coleta ou copie a resposta normalizada.
npm run sync:cnes -- --ibge=3516200 --source=live
```

Ver `docs/manuais/tecnico/cadastros/cnes-import.md`.
