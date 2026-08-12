# Artefato e-SUS APS 5.5.24

**Atualizado:** 2026-08-10

## Manifesto

| Campo | Valor |
|---|---|
| Arquivo | `e-SUS/eSUS-AB-PEC-5.5.24-Linux64.jar` |
| Papel | Instalador (não é a app sozinha) |
| Versão PEC | **5.5.24** |
| SHA-256 | `69e2ccd9e17f40fe260ae10ceb641b8b69be84c3e48b60e42264c086008f9b52` |
| Tamanho | 737 144 580 bytes (~703 MB) |
| Vendor | Laboratório Bridge / Ministério da Saúde |
| Build commit | `e0f81a969f97bf4e92bfbb1a2c5c7aab2681153b` |
| Build time | 2026-07-21T21:37:08Z |
| Main-Class instalador | `br.gov.saude.esus.installers.installer.Main` |

Arquivo máquina: `01-manifest.json` / `data/esus/5.5.24/reports/01-manifest.json`.

## Estrutura do instalador

```text
eSUS-AB-PEC-5.5.24-Linux64.jar
├── br/gov/saude/esus/installers/...   # instalador
├── container/
│   ├── webserver/
│   │   ├── pec-bundle.jar             # ★ aplicação principal (~458 MB)
│   │   ├── certmgr.jar
│   │   └── application.properties
│   ├── database/
│   │   ├── migrador.jar               # ★ Liquibase runner (~91 MB)
│   │   └── postgresql-9.6...run       # instalador PG (ruído para specs)
│   └── jre/17.0.13-linux_x64.zip      # JRE Linux (não usar no macOS)
└── gui/, standalone/...
```

**Regra:** nunca alterar o JAR original. Extrair cópias em `cache/esus/<sha256>/`.

## pec-bundle.jar (aplicação)

| Campo | Valor |
|---|---|
| Tipo | Spring Boot fat JAR |
| Spring Boot | 2.7.18 |
| Start-Class | `br.ufsc.bridge.pec.standalone.SpringBootServerStarter` |
| Implementation-Title | PEC - App bundle |
| Implementation-Version | 5.5.24 |
| Libs internas | `BOOT-INF/lib/*.jar` (~466 JARs) |

## migrador.jar

| Campo | Valor |
|---|---|
| Start-Class | `br.gov.saude.esus.MigratorRunner` |
| JAR crítico | `database-5.5.24.jar` (~66 MB) |
| Conteúdo DB | Liquibase YAML + **~728 SQL** (Oracle/Postgres) + CSVs |

## Cache e versão

```text
cache/esus/69e2ccd9e17f40fe260ae10ceb641b8b69be84c3e48b60e42264c086008f9b52/
  extracted/pec-bundle.jar
  extracted/migrador.jar
  extracted/libs/          # JARs aninhados extraídos sob demanda

data/esus/5.5.24/
  inventory/
  analysis/
  reports/
  decompiled/raw/
  decompiled/normalized/
  spec/
```

Idempotência: mesmo SHA-256 não refaz trabalho pesado desnecessariamente.
