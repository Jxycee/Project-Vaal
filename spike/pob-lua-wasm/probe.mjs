// PoB2 reference probe. REFERENCE ONLY: a hint of where to read PoB's source when our engine has a gap.
// usage: node probe.mjs <fixture.json|code.txt|build.xml>... [--stats Life,Mana,...] [--pools Life,Evasion,...] [--out report.json]
import fs from "node:fs";
import path from "node:path";
import { bootPob, xmlFromPobCode } from "./engine.mjs";

const argv = process.argv.slice(2);
const inputs = [];
let stats = [], pools = [], outFile = null;
for (let i = 0; i < argv.length; i++) {
	const a = argv[i];
	if (a === "--stats") stats = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
	else if (a === "--pools") pools = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
	else if (a === "--out") outFile = argv[++i];
	else inputs.push(a);
}
if (!inputs.length) {
	console.error("usage: node probe.mjs <fixture.json|code.txt|build.xml>... [--stats A,B] [--pools A,B] [--out report.json]");
	process.exit(2);
}
const DEFAULT_STATS = ["Life", "Mana", "EnergyShield", "Armour", "Evasion", "Spirit", "Str", "Dex", "Int", "FireResist", "ColdResist", "LightningResist", "ChaosResist"];
if (!stats.length) stats = DEFAULT_STATS;
if (!pools.length) pools = ["Life", "Evasion"];

function readBuild(file) {
	const raw = fs.readFileSync(file, "utf8");
	const t = raw.trim();
	if (t.startsWith("{")) {
		const fx = JSON.parse(t);
		if (!fx.pob) throw new Error("fixture has no 'pob' field");
		return xmlFromPobCode(fx.pob);
	}
	if (t.startsWith("<")) return t;
	return xmlFromPobCode(t);
}

// PoB prints "Image ... not found" etc. through print(); keep stdout clean for the report.
const realLog = console.log;
const noise = [];
console.log = (...a) => { noise.push(a.join(" ")); };

let engine;
try {
	engine = await bootPob({ log: (m) => noise.push(m) });
} catch (e) {
	console.log = realLog;
	console.error("PoB failed to boot:", String(e.message ?? e).slice(0, 2000));
	process.exit(1);
}
const { lua } = engine;

const fmt = (n) => (typeof n === "number" ? (Number.isInteger(n) ? String(n) : (Math.abs(n) >= 100 ? n.toFixed(1) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""))) : String(n));
const kv = (o) => Object.keys(o).sort().map((k) => `${k}=${fmt(o[k])}`).join("  ");

function modLine(m) {
	const bits = [fmt(m.value), m.source];
	if (m.tags) bits.push(`[${m.tags}]`);
	if (m.flags) bits.push(`flags=${m.flags}`);
	return "      " + bits.join("  ");
}

function render(name, r) {
	const L = [];
	L.push(`==== ${name}  (${r.build.class ?? "?"}/${r.build.ascendancy ?? "?"} L${r.build.level ?? "?"}, main skill ${r.build.mainSkill ?? "?"})`);
	L.push("-- requested stats (PoB output table; exact name, case-insensitive; "*" is a glob; NaN/inf are omitted)");
	L.push("  " + (Object.keys(r.requested).length ? kv(r.requested) : "(none)"));
	if (r.requestedMissing.length) L.push("  no output key matched: " + r.requestedMissing.join(", "));
	L.push("-- derived / intermediate (EHP, max hits, evade, regen, resists)");
	L.push("  " + kv(r.derived));
	const e = r.enemy;
	L.push("-- enemy assumptions PoB used");
	L.push(`  level=${e.level} accuracy=${e.accuracy} (monsterAccuracyTable[level]=${e.monsterAccuracyAtLevel}) monsterDamageTable[level]=${e.monsterDamageAtLevel} monsterEvasionTable[level]=${e.monsterEvasionAtLevel}`);
	L.push(`  enemyIsBoss=${e.enemyIsBoss ?? "(default)"} damageTypeConfig=${e.damageTypeConfig} accuracyDistancePenalty=${e.accuracyPenaltyFlag ?? false}`);
	L.push(`  dps mult: normal=${e.misc.normalEnemyDPSMult} stdBoss=${e.misc.stdBossDPSMult} pinnacle=${e.misc.pinnacleBossDPSMult} uber=${e.misc.uberBossDPSMult}`);
	for (const [t, v] of Object.entries(e.perType)) {
		L.push(`  ${t.padEnd(9)} configured=${v.configuredDamage ?? "-"} placeholder=${v.placeholderDamage ?? "-"} afterConvCrit=${v.damageAfterConversionAndCrit != null ? fmt(v.damageAfterConversionAndCrit) : "-"} dmgMult=${v.damageMult != null ? fmt(v.damageMult) : "-"} maxHit=${v.maxHitTaken != null ? fmt(v.maxHitTaken) : "-"}`);
	}
	for (const [lab, arr] of [["enemy Accuracy BASE", e.accuracyModsBase], ["enemy Accuracy INC", e.accuracyModsInc], ["enemy Accuracy MORE", e.accuracyModsMore]]) {
		if (arr.length) { L.push(`  ${lab}:`); arr.forEach((m) => L.push(modLine(m))); }
	}
	if (r.breakdownText) {
		L.push("-- PoB's own breakdown text (Calcs tab) for derived stats");
		for (const [k, lines] of Object.entries(r.breakdownText)) {
			if (!lines.length) continue;
			L.push(`  ${k}:`);
			lines.slice(0, 40).forEach((s) => L.push("    " + s));
		}
	}
	for (const [p, b] of Object.entries(r.pools)) {
		L.push(`-- pool ${p}: output=${b.output != null ? fmt(b.output) : "(no output key)"}  base=${fmt(b.baseSum)}  inc=${fmt(b.incSum)}%  more=${fmt(b.morePct)}% (x${fmt(b.moreProduct)})  calcLib.val=${b.calcLibVal != null ? fmt(b.calcLibVal) : "-"}`);
		for (const [lab, arr] of [["BASE", b.base], ["INC", b.inc], ["MORE", b.more], ["OVERRIDE", b.override ?? []], ["FLAG", b.flag ?? []]]) {
			if (!arr.length) continue;
			L.push(`    ${lab}:`);
			arr.forEach((m) => L.push(modLine(m)));
		}
		if (b.pobBreakdownText?.length) {
			L.push("    PoB breakdown text:");
			b.pobBreakdownText.slice(0, 40).forEach((s) => L.push("      " + s));
		}
	}
	L.push("-- Config inputs PoB parsed (XML <Config>)");
	L.push("  " + (Object.keys(r.configInput).length ? kv(r.configInput) : "(none set)"));
	L.push("-- conditions on player modDB: " + (r.conditions.join(", ") || "(none)"));
	L.push("-- multipliers (non-zero): " + (Object.keys(r.multipliers).length ? kv(r.multipliers) : "(none)"));
	L.push("-- conditions on enemy: " + (r.enemyConditions.join(", ") || "(none)"));
	L.push("   (REFERENCE ONLY: a hint of where to read PoB's source, not an answer)");
	return L.join("\n");
}

const report = { pobCheckout: engine.pobDir, builds: {} };
let failures = 0;
lua.global.set("__stats", stats.join("|"));
lua.global.set("__pools", pools.join("|"));
for (const f of inputs) {
	const name = path.basename(f).replace(/\.(json|txt|xml)$/i, "");
	const t1 = performance.now();
	try {
		const xml = readBuild(f);
		lua.global.set("__xml", xml);
		await lua.doString(`loadBuildFromXML(__xml, "probe")`);
		await lua.doString(`build.buildFlag = true; runCallback("OnFrame")`); // same extra frame the harness forces
		const json = JSON.parse(await lua.doString("return probeBuild(__stats, __pools)"));
		json.ms = Math.round(performance.now() - t1);
		report.builds[name] = json;
		realLog(render(name, json) + `\n   (${json.ms} ms)\n`);
	} catch (e) {
		failures++;
		report.builds[name] = { error: String(e.message ?? e).slice(0, 2000) };
		realLog(`==== ${name}\nFAILED to load/probe: ${String(e.message ?? e).slice(0, 1500)}\n`);
	}
}
console.log = realLog;
if (outFile) fs.writeFileSync(outFile, JSON.stringify(report, null, 1));
process.exit(failures && failures === inputs.length ? 1 : 0);
