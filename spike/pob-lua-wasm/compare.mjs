// Compare PoB-in-wasm output with (a) the <PlayerStat> values PoB desktop wrote in the same XML,
// (b) poe.ninja defensiveStats in the fixture, (c) our own engine's result in oracle/results.json.
// usage: node compare.mjs <harness-out.json> <oracleDir>
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const [outFile, oracleDir] = process.argv.slice(2);
const out = JSON.parse(fs.readFileSync(outFile, "utf8"));
const ours = JSON.parse(fs.readFileSync(path.join(oracleDir, "results.json"), "utf8"));

const NINJA = [
	["life", "Life"], ["mana", "Mana"], ["energyShield", "EnergyShield"], ["armour", "Armour"],
	["evasionRating", "Evasion"], ["spirit", "Spirit"], ["strength", "Str"], ["dexterity", "Dex"], ["intelligence", "Int"],
	["fireResistance", "FireResist"], ["coldResistance", "ColdResist"], ["lightningResistance", "LightningResist"], ["chaosResistance", "ChaosResist"],
];
const close = (a, b, rel) => Math.abs(a - b) <= Math.max(Math.abs(b) * rel, 1e-9);

let totXml = 0, okXml = 0, totNinja = 0, okNinja = 0, totOurs = 0, okOurs = 0;
const rows = [];
const worst = {};
for (const [name, r] of Object.entries(out)) {
	const fx = JSON.parse(fs.readFileSync(path.join(oracleDir, name + ".json"), "utf8"));
	const xml = zlib.inflateSync(Buffer.from(fx.pob.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
	let tx = 0, ox = 0;
	for (const m of xml.matchAll(/<PlayerStat stat="([^"]+)" value="([^"]+)"/g)) {
		const want = Number(m[2]);
		if (!Number.isFinite(want)) continue;
		tx++;
		const got = r.stats[m[1]];
		if (got !== undefined && close(got, want, 1e-6)) ox++;
		else (worst[m[1]] ??= []).push(`${name}: want ${want} got ${got}`);
	}
	totXml += tx; okXml += ox;
	let tn = 0, on = 0; const ninjaBad = [];
	for (const [k, pk] of NINJA) {
		const want = fx.defensiveStats?.[k];
		if (typeof want !== "number") continue;
		tn++;
		const got = r.stats[pk];
		if (got !== undefined && Math.round(got) === Math.round(want)) on++; else ninjaBad.push(`${k} ${want} vs ${got === undefined ? "n/a" : Math.round(got)}`);
	}
	totNinja += tn; okNinja += on;
	const o = ours[name + ".json"];
	if (o) { totOurs += o.of; okOurs += o.matched; }
	rows.push(`${name.padEnd(28)} PlayerStat ${ox}/${tx}  ninja ${on}/${tn}  ours ${o ? o.matched + "/" + o.of : "-"}  load ${r.loadMs}ms recalc ${r.recalcMs}ms${ninjaBad.length ? "  NINJA-MISS: " + ninjaBad.join("; ") : ""}`);
}
console.log(rows.join("\n"));
console.log(`\nTOTAL PlayerStat (PoB desktop's own saved stats) ${okXml}/${totXml} (${((100 * okXml) / totXml).toFixed(1)}%)`);
console.log(`TOTAL poe.ninja defensive stats, PoB-wasm ${okNinja}/${totNinja}; our engine ${okOurs}/${totOurs}`);
const CORE = ["Life", "Mana", "EnergyShield", "Armour", "Evasion", "Spirit", "Str", "Dex", "Int", "TotalEHP", "PhysicalMaximumHitTaken", "FireMaximumHitTaken", "TotalDPS", "CombinedDPS", "Speed", "CritChance", "CritMultiplier", "HitChance", "ManaCost", "LifeRegenRecovery", "ManaRegenRecovery", "MovementSpeedMod"];
console.log("\nCore keys vs PlayerStat (builds where key present in XML): matched/total");
for (const k of CORE) {
	let t = 0, o = 0;
	for (const [name, r] of Object.entries(out)) {
		const fx = JSON.parse(fs.readFileSync(path.join(oracleDir, name + ".json"), "utf8"));
		const xml = zlib.inflateSync(Buffer.from(fx.pob.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
		const m = new RegExp(`<PlayerStat stat="${k}" value="([^"]+)"`).exec(xml);
		if (!m) continue;
		t++;
		if (r.stats[k] !== undefined && close(r.stats[k], Number(m[1]), 1e-6)) o++;
	}
	console.log(`  ${k.padEnd(26)} ${o}/${t}`);
}
const bad = Object.entries(worst).sort((a, b) => b[1].length - a[1].length).slice(0, 25);
console.log("\nMost-mismatching PlayerStat keys:");
for (const [k, v] of bad) console.log(" ", k, v.length, "e.g.", v[0]);
