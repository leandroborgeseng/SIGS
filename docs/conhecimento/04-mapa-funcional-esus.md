# Mapa funcional preliminar — e-SUS APS 5.5.24

**Confiança:** `STRONG_INFERENCE` sobre nomes de classes/packages/resources.  
**Não substitui** decompilação nem normas oficiais.

Relatório completo: `07-functional-map.md`, `08-domain-map.md`.

## Áreas com evidência forte (hits em nomes)

| Área | Hits (aprox.) | Status inventário |
|---|---:|---|
| integration | 6871 | forte |
| encounter | 5204 | forte |
| ledi | 4847 | forte |
| report | 2590 | forte |
| patient | 2362 | forte |
| home-care | 2001 | forte |
| vaccination | 1656 | forte |
| dental | 986 | forte |
| procedure | 916 | forte |
| collective-activity | 914 | forte |
| territory | 876 | forte |
| exam | 871 | forte |
| professional | 808 | forte |
| appointment | 790 | forte |
| security | 732 | forte |
| referral | 728 | forte |
| household | 699 | forte |
| facility | 674 | forte |
| team | 461 | forte |
| acs | 432 | forte |
| prescription | 414 | forte |
| billing | 212 | presente |
| cnes | 147 | presente |
| emergency | 59 | parcial/fraco |
| sigtap | 23 | fraco no inventário de nomes |

## Ordem de prioridade de especificação (prompt mestre)

1. citizen/patient  
2. professional/team  
3. facility  
4. territory  
5. appointment  
6. encounter  
7. procedure  
8. vaccination  
9. dental  
10. home-care  
11. ACS/ACE  
12. collective activity  
13. prescription  
14. exams  
15. referral  
16. LEDI  
17. production/billing  
18. reports  

## Observação sobre “hits”

Muitos hits de `ledi`/`integration` vêm de classes Thrift geradas. São úteis para mapeamento de fichas, mas regras de negócio estão sobretudo em `*Validator`, `*Service`, `*business*`.
