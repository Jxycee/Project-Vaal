// Spike harness: run Path of Building 2 (Lua) headless inside wasmoon (Lua 5.4 in WebAssembly).
// usage: node harness.mjs <POB_CLONE_DIR> [oracleFixture.json ...]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { lowerContinue } from "./lower-continue.mjs";

const SCRATCH = process.env.POB_SCRATCH ?? path.resolve(".");
const require = createRequire(path.join(SCRATCH, "package.json"));
const { LuaFactory } = require("wasmoon");

const pobDir = process.argv[2];
const fixtures = process.argv.slice(3);
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

const SKIP = /\.(png|jpg|dds|zst|webp|md|scm)$/i;
function* walk(dir, rel = "") {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		const r = rel ? rel + "/" + e.name : e.name;
		if (e.isDirectory()) yield* walk(p, r);
		else if (!SKIP.test(e.name)) yield [p, r];
	}
}

// PoB2 source uses compound assignment (x += 1, s ..= "a"), a dialect extension stock Lua rejects.
// Rewrite `lhs op= rhs` statements to `lhs = lhs op (rhs)`.
const COMPOUND = /^([ \t]*)([\w.\[\]"']+)[ \t]*(\+|-|\*|\/|%|\.\.)=[ \t]*([^\r\n]*?)[ \t]*(--[^\r\n]*)?$/gm;
function lowerSyntax(text) {
	text = lowerContinue(text);
	// optional chaining: A?.[k] and A?.b.c  ->  (A and A[k]) / (A and A.b.c)
	text = text.replace(/([\w.]+)\?\.\[((?:[^\[\]]|\[[^\[\]]*\])*)\]/g, "($1 and $1[$2])");
	text = text.replace(/([\w.]+)\?\.([\w.]+)/g, "($1 and $1.$2)");
	// lambda: |a, b| -> expr   (up to the closing brace/paren/comma/eol)  ->  function(a, b) return expr end
	text = text.replace(/\|([\w, ]*)\|[ \t]*->[ \t]*([^\r\n]*?)(?=[ \t]*\}[ \t]*(?:\r?\n|$|,|\)))/g, "function($1) return $2 end");
	// inline form: `then depth += 1 elseif ...`
	text = text.replace(/\b([A-Za-z_][\w.]*)[ \t]*(\+|-)=[ \t]*([\w.]+)(?=[ \t]+(?:elseif|else|end)\b)/g, "$1 = $1 $2 $3");
	return text.replace(COMPOUND, (_m, ind, lhs, op, rhs, cmt) => `${ind}${lhs} = ${lhs} ${op} (${rhs}) ${cmt ?? ""}`);
}

const t0 = performance.now();
const factory = new LuaFactory();
let bytes = 0, files = 0;
// src/ mounted at "/" (so relative loadfile("Launch.lua") resolves), runtime/lua at /rt
for (const [p, r] of walk(path.join(pobDir, "src"))) {
	if (r.startsWith("Export/") || r.startsWith("Assets/")) continue;
	let buf = fs.readFileSync(p);
	// export-to-game-format module uses `continue` (another dialect extension); irrelevant to calculation, stub it
	if (r.endsWith(".lua") && buf.length < 2e6) buf = Buffer.from(lowerSyntax(buf.toString("utf8")), "utf8");
	if (process.env.DUMP === r) fs.writeFileSync(process.env.DUMP_OUT, buf);
	bytes += buf.length; files++;
	await factory.mountFile("/" + r, buf);
}
for (const [p, r] of walk(path.join(pobDir, "runtime", "lua"))) {
	const buf = fs.readFileSync(p);
	bytes += buf.length; files++;
	await factory.mountFile("/rt/" + r, buf);
}
// the wrapper reads ../manifest.xml; give it one
await factory.mountFile("/../manifest.xml", fs.readFileSync(path.join(pobDir, "manifest.xml")));
const tMount = performance.now();
console.log(`mounted ${files} files, ${(bytes / 1e6).toFixed(1)} MB in ${(tMount - t0).toFixed(0)} ms`);

const lua = await factory.createEngine();
await lua.doString(fs.readFileSync(path.join(here, "prelude.lua"), "utf8"));
if (process.env.CHECK) {
	// syntax-check every mounted Lua file (finds remaining dialect extensions in one pass)
	let bad = 0;
	for (const [, r] of walk(path.join(pobDir, "src"))) {
		if (!r.endsWith(".lua") || r.startsWith("Export/") || r.startsWith("Assets/")) continue;
		if (process.env.CHECK === "v") console.log("check", r);
		lua.global.set("__f", r);
		const err = await lua.doString("local f, e = loadfile(__f); return e");
		if (err) { bad++; console.log("SYNTAX", String(err).slice(0, 200)); }
	}
	console.log("syntax failures:", bad);
	process.exit(0);
}
let wrapper = fs.readFileSync(path.join(pobDir, "src", "HeadlessWrapper.lua"), "utf8");
wrapper = wrapper.replace(/^#.*\r?\n/, "--\n"); // "#@" first line is a LuaJIT-ism
// wrapper blocks on io.read when startup fails; make that a hard error instead
wrapper = wrapper.replace('io.read("*l")', 'error("startup failed: " .. tostring(__mainObject__.promptMsg))');
try {
	await lua.doString(wrapper);
} catch (e) {
	console.log("WRAPPER FAILED:", String(e.message ?? e).slice(0, 1500));
	process.exit(1);
}
const tInit = performance.now();
console.log(`PoB initialised in ${(tInit - tMount).toFixed(0)} ms (cold total ${(tInit - t0).toFixed(0)} ms)`);
console.log("rss MB", (process.memoryUsage().rss / 1e6).toFixed(0));

const dumpStats = `
function dumpStats()
	local out = build.calcsTab.mainOutput
	local t = {}
	for k, v in pairs(out) do
		if type(v) == "number" and v == v and v ~= math.huge and v ~= -math.huge then t[#t + 1] = string.format('"%s":%.6f', k, v) end
	end
	return "{" .. table.concat(t, ",") .. "}"
end
`;
await lua.doString(dumpStats);

function xmlFromPob(code) {
	const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
	return zlib.inflateSync(Buffer.from(b64, "base64")).toString("utf8");
}

const results = {};
for (const f of fixtures) {
	const fx = JSON.parse(fs.readFileSync(f, "utf8"));
	const name = path.basename(f, ".json");
	if (!fx.pob) { console.log(name, "has no pob code, skipped"); continue; }
	const xml = xmlFromPob(fx.pob);
	lua.global.set("__xml", xml);
	const t1 = performance.now();
	try {
		await lua.doString(`loadBuildFromXML(__xml, "spike")`);
		const t2 = performance.now();
		const json = JSON.parse(await lua.doString("return dumpStats()"));
		// second calc timing: re-run a frame after marking dirty
		await lua.doString(`build.buildFlag = true; runCallback("OnFrame")`);
		const t3 = performance.now();
		results[name] = { loadMs: Math.round(t2 - t1), recalcMs: Math.round(t3 - t2), stats: json };
		console.log(name, "load", Math.round(t2 - t1), "ms; recalc", Math.round(t3 - t2), "ms; stats", Object.keys(json).length);
	} catch (e) {
		console.log(name, "FAILED:", String(e.message ?? e).slice(0, 1500));
	}
}
console.log("peak rss MB", (process.memoryUsage().rss / 1e6).toFixed(0), "heapUsed MB", (process.memoryUsage().heapUsed / 1e6).toFixed(0));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(results));
