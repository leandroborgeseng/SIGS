#!/usr/bin/env python3
"""Atualiza resumo markdown a partir de cobertura-rf.csv."""
from __future__ import annotations

import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "docs/rastreabilidade/cobertura-rf.csv"
MD_PATH = ROOT / "docs/rastreabilidade/cobertura-rf.md"


def main() -> None:
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))
    prio = [r for r in rows if r["onda"] == "P0-P6"]
    adi = [r for r in rows if r["status"] == "adiado"]
    impl = [r for r in rows if r["status"] == "implementado"]
    partial = [r for r in rows if r["status"] == "parcial"]

    agg = defaultdict(lambda: {"t": 0, "o": 0, "d": 0, "nome": "", "impl": 0})
    for r in prio:
        a = agg[r["modulo"]]
        a["t"] += 1
        a["nome"] = r["modulo_nome"]
        if r["tipo"] == "Obrigatório":
            a["o"] += 1
        else:
            a["d"] += 1
        if r["status"] in ("implementado", "parcial"):
            a["impl"] += 1

    lines = [
        "# Cobertura RF — rastreabilidade",
        "",
        "**CSV completo:** [cobertura-rf.csv](cobertura-rf.csv)",
        f"**Total linhas:** {len(rows)} · **implementados:** {len(impl)} · **parciais:** {len(partial)} · **adiados:** {len(adi)}",
        "",
        "Estratégia: [estrategia-reescrita-fase1.md](../planejamento/estrategia-reescrita-fase1.md)",
        "",
        "## Onda P0–P6 por módulo",
        "",
        "| Módulo | RF | Obrig. | Desej. | Tocados |",
        "|---|---:|---:|---:|---:|",
    ]
    for m in sorted(agg, key=int):
        a = agg[m]
        lines.append(f"| {m}. {a['nome'][:40]} | {a['t']} | {a['o']} | {a['d']} | {a['impl']} |")

    lines += [
        "",
        "## Implementados / parciais (amostra)",
        "",
        "| ID | Tipo | Status | Fat. | Código |",
        "|---|---|---|---|---|",
    ]
    for r in rows:
        if r["status"] in ("implementado", "parcial"):
            lines.append(
                f"| {r['id']} | {r['tipo'][:3]} | {r['status']} | {r['teste_faturamento']} | `{r['codigo']}` |"
            )

    MD_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"updated {MD_PATH}")


if __name__ == "__main__":
    main()
