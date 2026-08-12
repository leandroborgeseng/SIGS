# Manual do usuário — UI fase 2 (shell operacional)

| Campo | Valor |
|---|---|
| id | plataforma.ui-fase2 |
| version | 1.0.0 |
| status | draft |
| atualizado | 2026-08-10 |

## Como entrar

1. Abra `http://localhost:3000/login`
2. Use `admin@sigs.local` / `admin123` (ambiente local)
3. Selecione ou crie uma UBS
4. Use a barra lateral para navegar

## Telas principais

- **Pacientes**: busca, novo cadastro (nome social, desconhece mãe/pai, óbito)
- **Agenda**: criar slot, mudar status, excluir só se Agendado
- **Fila**: entrada na fila, atender (SOAP), finalizar com desfecho
- **Vacinação**: cascata + BCG / Estratégia Especial
- **Relatórios**: filtrar e exportar CSV
- **Ajuda**: `?` no topo ou Central de Ajuda

## Ajuda contextual

Cada tela tem link “Ajuda desta tela” e o botão `?` na barra superior.
