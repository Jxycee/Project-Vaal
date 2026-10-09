-- Reference probe, Lua side. Runs inside PoB's own environment (after loadBuildFromXML + a calc frame).
-- Defines probeBuild(statsJson, poolsJson) -> JSON string. Read-only: nothing here changes PoB state.
--
-- APIs used (all PoB2 source, src/):
--   build.calcsTab.mainOutput          the output table the Calcs tab shows (Modules/Calc*.lua write it)
--   build.calcsTab.mainEnv             calc environment: env.player.modDB, env.enemyDB, env.enemyLevel,
--                                      env.configInput (the Config tab values PoB parsed), env.configPlaceholder
--   build.calcsTab.calcsEnv.player.breakdown (PoB's own text breakdowns, e.g. breakdown.Evasion.slots; only the
--                                      "CALCS" pass fills it, it is what the Calcs tab tooltips render)
--   modDB:Tabulate(type, cfg, name)    Classes/ModStore.lua:345, returns { {value=, mod=} } with tags evaluated
--                                      (EvalMod), the same call PoB uses internally; mod.source is the label PoB shows
--   modDB.conditions / modDB.multipliers  the conditions and multipliers set on the DB at calc time
-- Own tiny JSON encoder: PoB's bundled dkjson sets `local _ENV = nil` and breaks its key sort under Lua 5.4.
local function jsonStr(s)
	s = tostring(s):gsub('[%c"\\]', function(c)
		if c == '"' then return '\\"' elseif c == "\\" then return "\\\\" elseif c == "\n" then return "\\n" end
		return string.format("\\u%04x", string.byte(c))
	end)
	return '"' .. s .. '"'
end
local function jsonEncode(v)
	local t = type(v)
	if t == "nil" then return "null"
	elseif t == "boolean" then return tostring(v)
	elseif t == "number" then
		if v ~= v or v == math.huge or v == -math.huge then return "null" end
		return string.format("%.10g", v)
	elseif t == "string" then return jsonStr(v)
	elseif t == "table" then
		if #v > 0 or next(v) == nil then
			local a = {}
			for i = 1, #v do a[i] = jsonEncode(v[i]) end
			return "[" .. table.concat(a, ",") .. "]"
		end
		local keys = {}
		for k in pairs(v) do keys[#keys + 1] = tostring(k) end
		table.sort(keys)
		local a = {}
		for _, k in ipairs(keys) do
			local val = v[k]
			if val == nil then val = v[tonumber(k)] end
			a[#a + 1] = jsonStr(k) .. ":" .. jsonEncode(val)
		end
		return "{" .. table.concat(a, ",") .. "}"
	end
	return "null"
end
local function split(s)
	local r = {}
	for part in tostring(s):gmatch("[^|]+") do r[#r + 1] = part end
	return r
end

local function clean(s)
	s = tostring(s)
	s = s:gsub("%^x%x%x%x%x%x%x", ""):gsub("%^%d", "")
	return s
end

local function num(v)
	if type(v) ~= "number" or v ~= v or v == math.huge or v == -math.huge then return nil end
	return v
end

local function lower(s) return string.lower(s) end

local function tagSummary(mod)
	local t = {}
	for _, tag in ipairs(mod) do
		local d = tag.type
		if tag.var then d = d .. ":" .. tostring(tag.var) end
		if tag.varList then d = d .. ":" .. table.concat(tag.varList, "/") end
		if tag.stat then d = d .. ":" .. tostring(tag.stat) end
		if tag.neg then d = d .. "(not)" end
		if tag.limit then d = d .. "<=" .. tostring(tag.limit) end
		t[#t + 1] = d
	end
	return table.concat(t, ",")
end

-- "Tree:12345" -> "Tree:12345 <passive node name>" via PoB's loaded passive tree
local function sourceLabel(src)
	src = clean(src or "?")
	local id = src:match("^Tree:(%d+)")
	if id then
		local ok, node = pcall(function() return build.spec.nodes[tonumber(id)] or build.spec.tree.nodes[tonumber(id)] end)
		if ok and node and node.dn then return src .. " " .. clean(node.dn) end
	end
	return src
end

local function listMods(db, modType, name)
	local out = {}
	local ok, res = pcall(function() return db:Tabulate(modType, nil, name) end)
	if not ok then return out end
	for _, e in ipairs(res) do
		local m = e.mod
		out[#out + 1] = {
			value = num(e.value) or tostring(e.value),
			source = sourceLabel(m.source),
			type = m.type,
			tags = tagSummary(m),
			flags = (m.flags and m.flags ~= 0) and m.flags or nil,
			keywordFlags = (m.keywordFlags and m.keywordFlags ~= 0) and m.keywordFlags or nil,
		}
	end
	return out
end

local function poolBreakdown(db, name)
	local base = listMods(db, "BASE", name)
	local inc = listMods(db, "INC", name)
	local more = listMods(db, "MORE", name)
	local override = listMods(db, "OVERRIDE", name)
	local flag = listMods(db, "FLAG", name)
	local sumBase, sumInc, prodMore = 0, 0, 1
	for _, m in ipairs(base) do if type(m.value) == "number" then sumBase = sumBase + m.value end end
	for _, m in ipairs(inc) do if type(m.value) == "number" then sumInc = sumInc + m.value end end
	for _, m in ipairs(more) do if type(m.value) == "number" then prodMore = prodMore * (1 + m.value / 100) end end
	local r = {
		baseSum = sumBase, incSum = sumInc, morePct = (prodMore - 1) * 100, moreProduct = prodMore,
		base = base, inc = inc, more = more,
	}
	if #override > 0 then r.override = override end
	if #flag > 0 then r.flag = flag end
	-- PoB's own calcLib.val (base * (1+inc) * more, with overrides applied)
	local ok, v = pcall(function() return calcLib.val(db, name) end)
	if ok then r.calcLibVal = num(v) end
	return r
end

local function summarizeValue(v)
	local t = type(v)
	if t == "number" then return num(v) or tostring(v) end
	if t == "string" then
		v = v:gsub("%s+", " ")
		return #v > 90 and (v:sub(1, 90) .. "...") or v
	end
	if t == "boolean" then return v end
	return nil
end

local function flatBreakdownText(bd, depth)
	-- PoB breakdown entries: strings, or tables ({label=, rowList=, ...}); keep strings and simple row tables
	local lines = {}
	if type(bd) ~= "table" then return lines end
	for _, e in ipairs(bd) do
		if type(e) == "string" then
			lines[#lines + 1] = clean(e)
		end
	end
	if bd.rowList then
		for _, row in ipairs(bd.rowList) do
			local cells = {}
			for k, v in pairs(row) do
				local sv = summarizeValue(v)
				if sv ~= nil then cells[#cells + 1] = k .. "=" .. clean(sv) end
			end
			table.sort(cells)
			lines[#lines + 1] = "row: " .. table.concat(cells, " ")
		end
	end
	-- per-slot gear base (breakdown.slot in CalcDefence.lua): item base defence x increased x more
	if bd.slots then
		for _, s in ipairs(bd.slots) do
			local itemName = s.item and (s.item.title or s.item.name) or s.sourceName
			lines[#lines + 1] = string.format("slot %s%s: base %s%s%s = %s", tostring(s.source), itemName and (" (" .. clean(itemName) .. ")") or "",
				tostring(num(s.base) and string.format("%.4g", s.base) or s.base), s.inc or "", s.more or "", tostring(s.total))
		end
	end
	if bd.label then lines[#lines + 1] = "label: " .. clean(bd.label) end
	return lines
end

local ENEMY_DAMAGE_TYPES = { "Physical", "Lightning", "Cold", "Fire", "Chaos" }

function probeBuild(statsJson, poolsJson) -- both are "|"-joined name lists
	local patterns = split(statsJson)
	local pools = split(poolsJson)
	local env = build.calcsTab.mainEnv
	local out = build.calcsTab.mainOutput
	local modDB = env.player.modDB
	local enemyDB = env.enemyDB
	local R = {}

	-- 1. output values --------------------------------------------------------------
	local numeric = {}
	for k, v in pairs(out) do
		local n = (type(v) == "number") and num(v)
		if n then numeric[k] = n end
	end
	-- the derived / intermediate stats our engine lacks or misses (always included when PoB computed them)
	local derivedExact = {
		"TotalEHP", "TotalNumberOfHits", "totalEnemyDamageIn", "SecondMinimalMaximumHitTaken",
		"PhysicalMaximumHitTaken", "FireMaximumHitTaken", "ColdMaximumHitTaken", "LightningMaximumHitTaken", "ChaosMaximumHitTaken",
		"EnemyCritChance", "EnemyCritEffect", "ConfiguredEvadeChance", "EvadeChance", "MeleeEvadeChance", "ProjectileEvadeChance",
		"SpellEvadeChance", "SpellProjectileEvadeChance", "DeflectChance", "ConfiguredDeflectChance", "Ward",
		"LifeRegen", "LifeRegenRecovery", "ManaRegen", "ManaRegenRecovery", "EnergyShieldRecharge", "EnergyShieldRechargeDelay",
		"EnergyShieldRegen", "MovementSpeedMod", "EffectiveMovementSpeedMod",
		"PhysicalDamageReduction", "BlockChance", "SpellBlockChance", "SpellSuppressionChance",
		"FireResist", "ColdResist", "LightningResist", "ChaosResist", "FireResistOverCap", "ColdResistOverCap",
		"LightningResistOverCap", "ChaosResistOverCap", "FireResistTotal", "ColdResistTotal", "LightningResistTotal", "ChaosResistTotal",
		"LifeUnreserved", "ManaUnreserved", "SpiritUnreserved", "Spirit", "TotalSpirit",
	}
	local derived = {}
	for _, k in ipairs(derivedExact) do
		if numeric[k] ~= nil then derived[k] = numeric[k] end
	end
	for k, v in pairs(numeric) do
		if k:match("EnemyDamage$") or k:match("EnemyDamageMult$") or k:match("MaximumHitTaken$") or k:match("^Enemy") then
			derived[k] = v
		end
	end
	R.derived = derived

	local requested = {}
	local requestedMissing = {}
	for _, pat in ipairs(patterns) do
		-- exact (case-insensitive) match, or a glob when the pattern contains "*" (e.g. "*MaximumHitTaken")
		local lp = lower(pat)
		local luaPat = "^" .. lp:gsub("[%^%$%(%)%%%.%[%]%+%-%?]", "%%%0"):gsub("%*", ".*") .. "$"
		local exact, partial = nil, {}
		for k, v in pairs(numeric) do
			local lk = lower(k)
			if lk == lp then exact = k elseif lp:find("*", 1, true) and lk:match(luaPat) then partial[#partial + 1] = k end
		end
		table.sort(partial)
		local hits = {}
		if exact then hits[#hits + 1] = exact end
		for _, k in ipairs(partial) do hits[#hits + 1] = k end
		if #hits == 0 then requestedMissing[#requestedMissing + 1] = pat end
		for _, k in ipairs(hits) do requested[k] = numeric[k] end
	end
	R.requested = requested
	R.requestedMissing = requestedMissing

	-- 1b. enemy assumptions PoB used --------------------------------------------------
	local E = {}
	E.level = env.enemyLevel
	local okA, acc = pcall(function() return round(calcLib.val(enemyDB, "Accuracy")) end)
	E.accuracy = okA and num(acc) or nil
	E.accuracyPenaltyFlag = modDB:Flag(nil, "EnemyAccuracyDistancePenalty") or nil
	E.accuracyModsBase = listMods(enemyDB, "BASE", "Accuracy")
	E.accuracyModsInc = listMods(enemyDB, "INC", "Accuracy")
	E.accuracyModsMore = listMods(enemyDB, "MORE", "Accuracy")
	E.monsterAccuracyAtLevel = data.monsterAccuracyTable and data.monsterAccuracyTable[env.enemyLevel] or nil
	E.monsterDamageAtLevel = data.monsterDamageTable and data.monsterDamageTable[env.enemyLevel] or nil
	E.monsterEvasionAtLevel = data.monsterEvasionTable and data.monsterEvasionTable[env.enemyLevel] or nil
	E.misc = {
		normalEnemyDPSMult = data.misc.normalEnemyDPSMult, stdBossDPSMult = data.misc.stdBossDPSMult,
		pinnacleBossDPSMult = data.misc.pinnacleBossDPSMult, uberBossDPSMult = data.misc.uberBossDPSMult,
		MaxEnemyLevel = data.misc.MaxEnemyLevel,
	}
	E.enemyIsBoss = env.configInput.enemyIsBoss
	E.damageTypeConfig = env.configInput.enemyDamageType or "Average"
	E.perType = {}
	for _, t in ipairs(ENEMY_DAMAGE_TYPES) do
		E.perType[t] = {
			configuredDamage = tonumber(env.configInput["enemy" .. t .. "Damage"]),
			placeholderDamage = tonumber(env.configPlaceholder["enemy" .. t .. "Damage"]),
			damageAfterConversionAndCrit = num(out[t .. "EnemyDamage"]),
			damageMult = num(out[t .. "EnemyDamageMult"]),
			maxHitTaken = num(out[t .. "MaximumHitTaken"]),
		}
	end
	-- PoB fills output.breakdown only in "CALCS" mode (what the Calcs tab renders); mainOutput is "MAIN" mode.
	local bdAll = build.calcsTab.calcsEnv and build.calcsTab.calcsEnv.player and build.calcsTab.calcsEnv.player.breakdown
	local bdE = bdAll
	if bdE then
		for _, k in ipairs({ "EvadeChance", "TotalEHP", "PhysicalMaximumHitTaken", "FireMaximumHitTaken", "ColdMaximumHitTaken", "LightningMaximumHitTaken", "ChaosMaximumHitTaken", "DeflectChance" }) do
			if bdE[k] then
				R.breakdownText = R.breakdownText or {}
				R.breakdownText[k] = flatBreakdownText(bdE[k])
			end
		end
	end
	R.enemy = E

	-- 2. per-pool modifier breakdown ---------------------------------------------------
	R.pools = {}
	for _, name in ipairs(pools) do
		local pb = poolBreakdown(modDB, name)
		pb.output = numeric[name]
		local bd = bdAll and bdAll[name]
		if bd then
			pb.pobBreakdownText = flatBreakdownText(bd)
		end
		R.pools[name] = pb
	end

	-- 3. config + conditions ------------------------------------------------------------
	local cfg, ph = {}, {}
	for k, v in pairs(env.configInput) do
		local sv = summarizeValue(v)
		if sv ~= nil then cfg[k] = sv end
	end
	for k, v in pairs(env.configPlaceholder) do
		local sv = summarizeValue(v)
		if sv ~= nil then ph[k] = sv end
	end
	R.configInput = cfg
	R.configPlaceholder = ph
	local conds, mults = {}, {}
	for k, v in pairs(modDB.conditions or {}) do if v then conds[#conds + 1] = k end end
	table.sort(conds)
	for k, v in pairs(modDB.multipliers or {}) do
		local n = num(v)
		if n and n ~= 0 then mults[k] = n end
	end
	R.conditions = conds
	R.multipliers = mults
	local econds = {}
	for k, v in pairs(enemyDB.conditions or {}) do if v then econds[#econds + 1] = k end end
	table.sort(econds)
	R.enemyConditions = econds
	R.build = {
		level = build.characterLevel, class = build.spec and build.spec.curClassName, ascendancy = build.spec and build.spec.curAscendClassName,
		mainSkill = env.player.mainSkill and env.player.mainSkill.activeEffect and env.player.mainSkill.activeEffect.grantedEffect and env.player.mainSkill.activeEffect.grantedEffect.name or nil,
		pobVersion = launch and launch.versionNumber or nil,
	}
	return jsonEncode(R)
end
