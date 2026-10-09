-- LuaJIT / Lua 5.1 compatibility shims so Path of Building 2 runs on stock Lua 5.4 (wasmoon).
package.path = "/rt/?.lua;/rt/?/init.lua;./?.lua;./?/init.lua;" .. package.path

arg = arg or {}
unpack = table.unpack
loadstring = load
table.getn = function(t) return #t end
table.maxn = function(t)
	local m = 0
	for k in pairs(t) do
		if type(k) == "number" and k > m then m = k end
	end
	return m
end
math.pow = function(a, b) return a ^ b end
math.mod = math.fmod
math.atan2 = function(y, x) return math.atan(y, x) end
math.cosh = function(x) return (math.exp(x) + math.exp(-x)) / 2 end
math.sinh = function(x) return (math.exp(x) - math.exp(-x)) / 2 end
math.tanh = function(x) local a, b = math.exp(x), math.exp(-x); return (a - b) / (a + b) end
math.ldexp = function(m, e) return m * 2.0 ^ e end
math.log10 = function(x) return math.log(x, 10) end

-- Lua 5.1/LuaJIT string.format("%d", 3.7) truncates; 5.4 raises "number has no integer representation".
local s_format = string.format
string.format = function(fmt, ...)
	local args = { ... }
	local n = select("#", ...)
	local idx = 0
	local i = 1
	while true do
		local p = fmt:find("%", i, true)
		if not p then break end
		local nxt = fmt:sub(p + 1, p + 1)
		if nxt == "%" then
			i = p + 2
		else
			local spec, conv = fmt:match("^%%([%-+ #0]*%d*%.?%d*)([%a])", p)
			if not conv then break end
			idx = idx + 1
			if (conv == "d" or conv == "i" or conv == "u" or conv == "c" or conv == "x" or conv == "X" or conv == "o") and idx <= n then
				local v = args[idx]
				if type(v) == "string" then v = tonumber(v) or v end
				if type(v) == "number" and not math.tointeger(v) then
					if v ~= v or v == math.huge or v == -math.huge then v = 0
					elseif v >= 0 then v = math.floor(v) else v = -math.floor(-v) end
					args[idx] = math.tointeger(v) or 0
				elseif type(v) == "number" then
					args[idx] = math.tointeger(v)
				end
			end
			i = p + 1 + #spec + 1
		end
	end
	return s_format(fmt, table.unpack(args, 1, n))
end

-- Lua 5.4 prints integral floats as "100.0"; LuaJIT as "100". Patch the functions we can (tostring, string.len);
-- implicit number->string coercion in `..` cannot be patched from Lua and stays a known divergence.
local raw_tostring = tostring
tostring = function(v)
	if math.type(v) == "float" then
		if v ~= v then return "nan" end
		if v == math.huge then return "inf" end
		if v == -math.huge then return "-inf" end
		return s_format("%.14g", v)
	end
	return raw_tostring(v)
end
local raw_len = string.len
string.len = function(s)
	if type(s) == "number" then s = tostring(s) end
	return raw_len(s)
end

-- setfenv/getfenv: only needed if PoB uses them (grep found no uses in src/), kept minimal.
setfenv = function(f, env) return f end
getfenv = function() return _G end

-- LuaJIT bit library via Lua 5.4 integer operators, 32-bit signed semantics.
local function tobit(x)
	x = math.tointeger(x) or math.tointeger(math.floor(x)) or 0
	x = x & 0xFFFFFFFF
	if x >= 0x80000000 then x = x - 0x100000000 end
	return x
end
bit = {
	tobit = tobit,
	band = function(a, b, ...)
		local r = tobit(a) & tobit(b)
		for _, v in ipairs({ ... }) do r = r & tobit(v) end
		return tobit(r)
	end,
	bor = function(a, b, ...)
		local r = tobit(a) | tobit(b)
		for _, v in ipairs({ ... }) do r = r | tobit(v) end
		return tobit(r)
	end,
	bxor = function(a, b, ...)
		local r = tobit(a) ~ tobit(b)
		for _, v in ipairs({ ... }) do r = r ~ tobit(v) end
		return tobit(r)
	end,
	bnot = function(a) return tobit(~tobit(a)) end,
	lshift = function(a, n) return tobit((tobit(a) & 0xFFFFFFFF) << (n & 31)) end,
	rshift = function(a, n) return tobit((tobit(a) & 0xFFFFFFFF) >> (n & 31)) end,
	arshift = function(a, n)
		a = tobit(a); n = n & 31
		return tobit(a >> n | (a < 0 and ~(0xFFFFFFFF >> n) or 0))
	end,
}

-- jit stub
local jitstub = { opt = { start = function() end }, off = function() end, on = function() end, status = function() return false end }
jit = jitstub
package.preload["jit"] = function() return jitstub end

-- lua-utf8 stand-in (ASCII-level; only used for number formatting and edit controls)
local u = {}
u.reverse = string.reverse
u.gsub = string.gsub
u.find = string.find
u.match = string.match
u.sub = string.sub
u.len = string.len
u.lower = string.lower
u.upper = string.upper
u.next = function(s, i, d) return (i or 1) + (d or 1) end
package.preload["lua-utf8"] = function() return u end
package.preload["luautf8"] = function() return u end
