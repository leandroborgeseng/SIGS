# Manual técnico — Auth e perfis

**Versão:** 0.5.0-dev  
**RF:** RF-1.2, RF-1.4, RF-1.14 (Obrigatórios)

## Login

`POST /api/v1/auth/login` (público)

```json
{ "email": "admin@sigs.local", "password": "admin123" }
```

Retorna `accessToken` (Bearer). Seed no boot da API:

| Ambiente | Comportamento |
|---|---|
| development | Cria admin com `SEED_ADMIN_*` ou default `admin@sigs.local` / `admin123`. UI pré-preenche e mostra hint. |
| production | Só cria admin se `SEED_ADMIN_PASSWORD` ≥12. Senão WARN e não cria. UI **não** pré-preenche nem exibe senha seed. |

Flag opcional na Web: `NEXT_PUBLIC_HIDE_SEED_CREDENTIALS=1` oculta hint/pré-preenchimento mesmo fora de production.

## Perfis (roles)

| code | Nome | Destaque |
|---|---|---|
| TI | TI municipal | `*` |
| GESTOR_UBS | Gestor UBS | relatórios + org |
| CLINICO | Enfermagem / Médico | atendimento + vacina |
| RECEPCAO | Recepção | pacientes/agenda/fila |

## Endpoints

| Path | Permissão |
|---|---|
| `GET /api/v1/auth/me` | autenticado |
| `GET/POST /api/v1/users` | `users.manage` |
| `GET /api/v1/roles` | `users.manage` |
| `GET /api/v1/audit` | `audit.read` |

Demais rotas exigem JWT (exceto `/api/health` e login).
