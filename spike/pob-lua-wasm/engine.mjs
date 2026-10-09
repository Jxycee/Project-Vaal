// Shared engine bootstrap for the probe: locate the scratch dir, mount PoB2's Lua (dialect-lowered) into
// wasmoon's in-memory FS, run the prelude + PoB's HeadlessWrapper. harness.mjs keeps its own copy (spike
// artefact, left untouched); this module carries the same logic for probe.mjs.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { lowerContinue } from "./lower-continue.mjs";

export const DEFAULT_SCRATCH = "C:/Users/jayce/AppData/Local/Temp/claude/C--Dev-project-vaal/1a790016-19e4-4a1a-ba66-68045d354a26/scratchpad/pobwasm";
export const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));

export function resolveDirs() {
	const scratch = process.env.POBWASM_DIR ?? DEFAULT_SCRATCH;
	let pobDir = path.join(scratch, "PathOfBuilding-PoE2");
	if (!fs.existsSync(pobDir)) {
		const legacy = path.join(scratch, "pob"); // directory name used by the original spike
		if (fs.existsSync(legacy)) pobDir = legacy;
	}
	if (!fs.existsSync(path.join(pobDir, "src", "HeadlessWrapper.lua"))) {
		throw new Error(`PoB2 checkout not found at ${pobDir} (set POBWASM_DIR; see README.md)`);
	}
	if (!fs.existsSync(path.join(scratch, "node_modules", "wasmoon"))) {
		throw new Error(`wasmoon not installed in ${scratch} (npm init -y && npm i wasmoon there; see README.md)`);
	}
	return { scratch, pobDir };
}

const SKIP = /\.(png|jpg|dds|zst|webp|md|scm)$/i;
function* walk(dir, rel = "") {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		const r = rel ? rel + "/" + e.name : e.name;
		if (e.isDirectory()) yield* walk(p, r);
		else if (!SKIP.test(e.name)) yield [p, r];
	}
}

// Dialect rewrite (same rules as harness.mjs lowerSyntax). Regex based, see README caveats.
const COMPOUND = /^([ \t]*)([\w.\[\]"']+)[ \t]*(\+|-|\*|\/|%|\.\.)=[ \t]*([^\r\n]*?)[ \t]*(--[^\r\n]*)?$/gm;
export function lowerSyntax(text) {
	text = lowerContinue(text);
	text = text.replace(/([\w.]+)\?\.\[((?:[^\[\]]|\[[^\[\]]*\])*)\]/g, "($1 and $1[$2])");
	text = text.replace(/([\w.]+)\?\.([\w.]+)/g, "($1 and $1.$2)");
	text = text.replace(/\|([\w, ]*)\|[ \t]*->[ \t]*([^\r\n]*?)(?=[ \t]*\}[ \t]*(?:\r?\n|$|,|\)))/g, "function($1) return $2 end");
	text = text.replace(/\b([A-Za-z_][\w.]*)[ \t]*(\+|-)=[ \t]*([\w.]+)(?=[ \t]+(?:elseif|else|end)\b)/g, "$1 = $1 $2 $3");
	return text.replace(COMPOUND, (_m, ind, lhs, op, rhs, cmt) => `${ind}${lhs} = ${lhs} ${op} (${rhs}) ${cmt ?? ""}`);
}

export function xmlFromPobCode(code) {
	const b64 = code.trim().replace(/-/g, "+").replace(/_/g, "/");
	return zlib.inflateSync(Buffer.from(b64, "base64")).toString("utf8");
}

/** Boot PoB headless. Returns { lua, bootMs }. Throws with the Lua error if startup fails. */
export async function bootPob({ log = () => {} } = {}) {
	const { scratch, pobDir } = resolveDirs();
	const require = createRequire(path.join(scratch, "package.json"));
	const { LuaFactory } = require("wasmoon");
	const t0 = performance.now();
	const factory = new LuaFactory();
	for (const [p, r] of walk(path.join(pobDir, "src"))) {
		if (r.startsWith("Export/") || r.startsWith("Assets/")) continue;
		let buf = fs.readFileSync(p);
		if (r.endsWith(".lua") && buf.length < 2e6) buf = Buffer.from(lowerSyntax(buf.toString("utf8")), "utf8");
		await factory.mountFile("/" + r, buf);
	}
	for (const [p, r] of walk(path.join(pobDir, "runtime", "lua"))) {
		await factory.mountFile("/rt/" + r, fs.readFileSync(p));
	}
	await factory.mountFile("/../manifest.xml", fs.readFileSync(path.join(pobDir, "manifest.xml")));
	const lua = await factory.createEngine();
	await lua.doString(fs.readFileSync(path.join(here, "prelude.lua"), "utf8"));
	let wrapper = fs.readFileSync(path.join(pobDir, "src", "HeadlessWrapper.lua"), "utf8");
	wrapper = wrapper.replace(/^#.*\r?\n/, "--\n");
	wrapper = wrapper.replace('io.read("*l")', 'error("startup failed: " .. tostring(__mainObject__.promptMsg))');
	await lua.doString(wrapper);
	await lua.doString(fs.readFileSync(path.join(here, "probe.lua"), "utf8"));
	log(`PoB booted in ${(performance.now() - t0).toFixed(0)} ms (checkout ${pobDir})`);
	return { lua, bootMs: performance.now() - t0, pobDir };
}
