// Lower the `continue` statement (Pluto/Luau-style dialect extension used by PoB2) to Lua 5.4 `goto`.
// Token-aware: skips strings and comments, tracks block nesting, inserts a label before the closing `end`.
export function lowerContinue(src) {
	if (!/\bcontinue\b/.test(src)) return src;
	const edits = []; // {pos, del, text}
	const stack = [];
	let pendingLoop = false;
	let labelId = 0;
	const n = src.length;
	let i = 0;
	const isWord = (c) => /[A-Za-z0-9_]/.test(c);
	while (i < n) {
		const c = src[i];
		// comments
		if (c === "-" && src[i + 1] === "-") {
			const m = /^--\[(=*)\[/.exec(src.slice(i, i + 40));
			if (m) {
				const close = "]" + m[1] + "]";
				const j = src.indexOf(close, i + m[0].length);
				i = j < 0 ? n : j + close.length;
			} else {
				const j = src.indexOf("\n", i);
				i = j < 0 ? n : j;
			}
			continue;
		}
		// long strings
		if (c === "[") {
			const m = /^\[(=*)\[/.exec(src.slice(i, i + 40));
			if (m) {
				const close = "]" + m[1] + "]";
				const j = src.indexOf(close, i + m[0].length);
				i = j < 0 ? n : j + close.length;
				continue;
			}
		}
		// quoted strings
		if (c === '"' || c === "'") {
			let j = i + 1;
			while (j < n && src[j] !== c) {
				if (src[j] === "\\") j++;
				if (src[j] === "\n") break;
				j++;
			}
			i = j + 1;
			continue;
		}
		if (/[A-Za-z_]/.test(c) && (i === 0 || !isWord(src[i - 1]))) {
			let j = i;
			while (j < n && isWord(src[j])) j++;
			const w = src.slice(i, j);
			// ignore field access like a.end / a:continue
			const prev = src[i - 1];
			if (prev === "." || prev === ":") { i = j; continue; }
			if (w === "for" || w === "while") pendingLoop = true;
			else if (w === "do") { stack.push({ kind: pendingLoop ? "loop" : "block" }); pendingLoop = false; }
			else if (w === "function") stack.push({ kind: "func" });
			else if (w === "if") stack.push({ kind: "block" });
			else if (w === "repeat") stack.push({ kind: "loop", repeat: true });
			else if (w === "end" || w === "until") {
				const top = stack.pop();
				if (top && top.kind === "loop" && top.label) edits.push({ pos: i, del: 0, text: `::${top.label}:: ` });
			} else if (w === "continue" && !/(goto[ \t]+|::[ \t]*)$/.test(src.slice(Math.max(0, i - 12), i)) && !/^[ \t]*::/.test(src.slice(j, j + 6))) {
				let k = stack.length - 1;
				while (k >= 0 && stack[k].kind !== "loop" && stack[k].kind !== "func") k--;
				if (k >= 0 && stack[k].kind === "loop") {
					if (!stack[k].label) stack[k].label = `__cont${labelId++}`;
					edits.push({ pos: i, del: j - i, text: `goto ${stack[k].label}` });
				}
			}
			i = j;
			continue;
		}
		i++;
	}
	edits.sort((a, b) => b.pos - a.pos);
	let out = src;
	for (const e of edits) out = out.slice(0, e.pos) + e.text + out.slice(e.pos + e.del);
	return out;
}
