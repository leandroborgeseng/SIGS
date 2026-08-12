# Manual técnico — Auth e perfis

**Versão:** 0.5.0-dev  
**RF:** RF-1.2, RF-1.4, RF-1.14 (Obrigatórios)

## Login

`POST /api/v1/auth/login` (público)

```json
{ "email": "admin@sigs.local", "password": "admin123" }
```

Retorna `accessToken` (Bearer). Seed criado no boot da API.

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
