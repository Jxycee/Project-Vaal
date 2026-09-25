# PoB2 fixtures

`sample-pob2-code.txt` is a real Path of Building 2 share code, fetched from
`https://pobb.in/pob/TUsV2f6hi8cg` on 2026-09-23 — a public, player-authored
level-94 Artillery Ballista Witchhunter with Spanish notes and 8 named tree
checkpoints.

It is vendored so the decode path can be tested without network access, and so
every number in `docs/superpowers/specs/2026-09-23-pob2-decode-findings.md` can
be re-derived rather than trusted.

Verbatim as served: 11,140 characters of URL-safe base64, which inflate to
36,691 bytes of XML. It is a player's build, not our content.
