# Lacunas (gaps) — análise preliminar e-SUS APS 5.5.24

Regra: **não inventar** funcionalidade ausente. Status baseado só no inventário atual.

## O e-SUS (nesta build) cobre com evidência forte

- `integration` (6871 hits em nomes)
- `encounter` (5204 hits em nomes)
- `ledi` (4847 hits em nomes)
- `report` (2590 hits em nomes)
- `patient` (2362 hits em nomes)
- `home-care` (2001 hits em nomes)
- `vaccination` (1656 hits em nomes)
- `dental` (986 hits em nomes)
- `procedure` (916 hits em nomes)
- `collective-activity` (914 hits em nomes)
- `territory` (876 hits em nomes)
- `exam` (871 hits em nomes)
- `professional` (808 hits em nomes)
- `appointment` (790 hits em nomes)
- `security` (732 hits em nomes)
- `referral` (728 hits em nomes)
- `household` (699 hits em nomes)
- `facility` (674 hits em nomes)
- `team` (461 hits em nomes)
- `acs` (432 hits em nomes)
- `prescription` (414 hits em nomes)
- `billing` (212 hits em nomes)
- `cnes` (147 hits em nomes)
- `emergency` (59 hits em nomes)
- `sigtap` (23 hits em nomes)

## Cobertura parcial / fraca no inventário de nomes


## Não encontrado ou não confirmado ainda

### APAC generation

- status: `PARTIAL_OR_NAME_HIT`
- área: `billing`
- evidência buscada: nomes de classe/resource contendo ['apac', 'APAC']
- hits de área `billing`: 212
- next_source: especificação oficial MS / LEDI / SIA / SIGTAP conforme o caso

### BPA generation

- status: `PARTIAL_OR_NAME_HIT`
- área: `billing`
- evidência buscada: nomes de classe/resource contendo ['bpa', 'BPA']
- hits de área `billing`: 212
- next_source: especificação oficial MS / LEDI / SIA / SIGTAP conforme o caso

### RAAS

- status: `NOT_FOUND`
- área: `billing`
- evidência buscada: nomes de classe/resource contendo ['raas', 'RAAS']
- hits de área `billing`: 212
- next_source: especificação oficial MS / LEDI / SIA / SIGTAP conforme o caso

### UPA / urgência-emergência completa

- status: `PARTIAL_OR_NAME_HIT`
- área: `emergency`
- evidência buscada: nomes de classe/resource contendo ['upa', 'urgencia', 'emergencia']
- hits de área `emergency`: 59
- next_source: especificação oficial MS / LEDI / SIA / SIGTAP conforme o caso

### Ambulatório de especialidades

- status: `PARTIAL_OR_NAME_HIT`
- área: `referral`
- evidência buscada: nomes de classe/resource contendo ['ambulatorio', 'especialidade']
- hits de área `referral`: 728
- next_source: especificação oficial MS / LEDI / SIA / SIGTAP conforme o caso

### Regulação avançada

- status: `PARTIAL_OR_NAME_HIT`
- área: `referral`
- evidência buscada: nomes de classe/resource contendo ['regulacao', 'regulação']
- hits de área `referral`: 728
- next_source: especificação oficial MS / LEDI / SIA / SIGTAP conforme o caso

### FHIR RNDS completo

- status: `PARTIAL_OR_NAME_HIT`
- área: `integration`
- evidência buscada: nomes de classe/resource contendo ['fhir', 'rnds']
- hits de área `integration`: 6871
- next_source: especificação oficial MS / LEDI / SIA / SIGTAP conforme o caso

### SIGTAP embarcado completo

- status: `PARTIAL_OR_NAME_HIT`
- área: `sigtap`
- evidência buscada: nomes de classe/resource contendo ['sigtap']
- hits de área `sigtap`: 23
- next_source: especificação oficial MS / LEDI / SIA / SIGTAP conforme o caso

## Limitações desta fase

- Inventário baseado em nomes de classes/JARs/resources — não em bytecode decompilado.
- Frontend pode estar em assets minificados dentro de `esus.web` — telas ainda não mapeadas.
- SQL indexados: 750 (schema ainda não modelado conceitualmente).
- Decompilação CFR ainda não executada.
