/* ===== MAIN GAME STATE MACHINE (v3 floor + staff) ===== */
/* States: TITLE | SETUP | STORY | SHOP | BREW | DAY_END | UPGRADE | WIN */

const Game = {
  stateName: "TITLE",
  state: null,
  brewSession: null,
  storyBeat: null,
  storyLine: 0,
  storyPhase: "morning",
  raf: null,
  lastTs: 0,
  muted: false,
  audioCtx: null,
  dayStats: null,
  staffTimers: { take: 0, serve: 0, clean: 0, brew: 0 },
  staffBrewJobs: [],
  cleanJob: null, // { tableId, t, dur, by: 'player'|'staff' }
  moveTableCustId: null, // when set, player is picking a target table for Đổi bàn
  _hangToastAt: 0,

  boot() {
    UI.init();
    this.bindMuteGlobal();
    this.migrateSaveIfNeeded();
    this.goTitle();
    this.loop(0);
  },

  bindMuteGlobal() {
    document.addEventListener("click", (e) => {
      if (e.target && e.target.id && String(e.target.id).includes("mute")) {
        this.toggleMute();
        e.target.textContent = this.muted ? "🔇" : "🔊";
      }
    });
  },

  ensureAudio() {
    if (!this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {}
    }
  },

  beep(freq = 660, dur = 0.08, type = "sine", vol = 0.08) {
    if (this.muted) return;
    this.ensureAudio();
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur);
  },

  sfxClick() {
    this.beep(520, 0.05, "triangle", 0.06);
  },
  sfxOk() {
    this.beep(660, 0.07);
    setTimeout(() => this.beep(880, 0.1), 70);
  },
  sfxBad() {
    this.beep(220, 0.15, "sawtooth", 0.05);
  },
  sfxCoin() {
    this.beep(880, 0.06);
    setTimeout(() => this.beep(1175, 0.08), 60);
  },

  toggleMute() {
    this.muted = !this.muted;
    UI.toast(this.muted ? "Đã tắt tiếng" : "Đã bật tiếng", "info");
  },

  effects() {
    const base = getEffects(this.state ? this.state.upgrades : {});
    if (this.state && this.state.staffActive) {
      const nBar = countRole(this.state.staff, "barista");
      if (nBar > 0) {
        const boost = 1 + Math.min(0.2, nBar * 0.06);
        base.brewTimeBonus = (base.brewTimeBonus || 0) + 2 * nBar;
        base.shakeSpeed = (base.shakeSpeed || 1) * boost;
        base.blendSpeed = (base.blendSpeed || 1) * boost;
        base.snackSpeed = (base.snackSpeed || 1) * (1 + Math.min(0.15, nBar * 0.05));
      }
    }
    return base;
  },

  /* ---------- SAVE / LOAD / MIGRATE ---------- */
  emptyUpgrades() {
    const u = {};
    DEVICES.forEach((d) => {
      u[d.id] = 0;
    });
    return u;
  },

  emptyStaff() {
    return [];
  },

  newEmployee(roleId) {
    const role = staffRoleById(roleId);
    if (!role) return null;
    const list = normalizeStaffList(this.state ? this.state.staff : []);
    return {
      id: "e_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6),
      role: role.id,
      name: pickStaffName(list),
    };
  },

  freshState(shopName) {
    const inventory = {};
    Object.keys(INGREDIENTS).forEach((k) => {
      inventory[k] = INGREDIENTS[k].stock;
    });
    return {
      shopName: shopName || GAME_CONFIG.shopNameDefault,
      day: 1,
      money: GAME_CONFIG.startingMoney,
      rep: GAME_CONFIG.startingRep,
      inventory,
      upgrades: this.emptyUpgrades(),
      staff: this.emptyStaff(),
      staffActive: true,
      staffPriority: "balanced",
      flags: {},
      dayRevenue: 0,
      queue: [],
      departing: [],
      tables: [],
      readyTray: [],
      currentCustomer: null,
      customersLeft: 0,
      spawnTimer: 0,
      shopOpen: false,
      lifetime: {
        starSum: 0,
        starCount: 0,
        totalRevenue: 0,
        served: 0,
        daysPlayed: 0,
        peakStaff: 0,
      },
      saveVersion: 4,
    };
  },

  migrateSaveIfNeeded() {
    try {
      const v4 = localStorage.getItem(GAME_CONFIG.saveKey);
      if (v4) return;

      let raw = localStorage.getItem(GAME_CONFIG.saveKeyLegacyV3);
      let from = 3;
      if (!raw) {
        raw = localStorage.getItem(GAME_CONFIG.saveKeyLegacyV2);
        from = 2;
      }
      if (!raw) {
        raw = localStorage.getItem(GAME_CONFIG.saveKeyLegacy);
        from = 1;
      }
      if (!raw) return;
      const old = JSON.parse(raw);
      if (!old) return;

      if (old.won3day || old.won || (old.flags && old.flags.mvp_win)) {
        try {
          localStorage.removeItem(GAME_CONFIG.saveKeyLegacyV3);
          localStorage.removeItem(GAME_CONFIG.saveKeyLegacyV2);
          localStorage.removeItem(GAME_CONFIG.saveKeyLegacy);
        } catch (_) {}
        return;
      }

      const migrated = this.freshState(old.shopName);
      migrated.day = Math.min(GAME_CONFIG.totalDays, Math.max(1, old.day || 1));
      migrated.money = old.money != null ? old.money : migrated.money;
      migrated.rep = old.rep != null ? old.rep : migrated.rep;
      migrated.flags = old.flags || {};
      delete migrated.flags.mvp_win;
      delete migrated.flags.won;

      if (old.inventory) {
        Object.keys(INGREDIENTS).forEach((k) => {
          if (old.inventory[k] != null) migrated.inventory[k] = old.inventory[k];
        });
      }

      const ups = this.emptyUpgrades();
      if (old.upgrades) {
        Object.keys(old.upgrades).forEach((k) => {
          if (!old.upgrades[k] && old.upgrades[k] !== 0) return;
          if (typeof old.upgrades[k] === "number") {
            if (ups[k] !== undefined) ups[k] = Math.min(4, old.upgrades[k]);
          } else if (LEGACY_UPGRADE_MAP[k]) {
            const m = LEGACY_UPGRADE_MAP[k];
            ups[m.id] = Math.max(ups[m.id], m.level);
          }
        });
      }
      migrated.upgrades = ups;
      migrated.lifetime = old.lifetime || migrated.lifetime;
      migrated.muted = !!old.muted;
      migrated.staff = normalizeStaffList(old.staff);
      migrated.staffPriority = old.staffPriority || "balanced";
      migrated.saveVersion = 4;

      localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(this.serialize(migrated, false)));
      try {
        localStorage.removeItem(GAME_CONFIG.saveKeyLegacyV3);
        localStorage.removeItem(GAME_CONFIG.saveKeyLegacyV2);
        localStorage.removeItem(GAME_CONFIG.saveKeyLegacy);
      } catch (_) {}
    } catch (_) {}
  },

  serialize(state, midDay) {
    return {
      saveVersion: 4,
      shopName: state.shopName,
      day: state.day,
      money: state.money,
      rep: state.rep,
      inventory: state.inventory,
      upgrades: state.upgrades,
      staff: normalizeStaffList(state.staff),
      staffPriority: state.staffPriority || "balanced",
      flags: state.flags,
      muted: this.muted,
      midDay: !!midDay,
      dayRevenue: state.dayRevenue,
      lifetime: state.lifetime,
    };
  },

  save() {
    if (!this.state) return;
    try {
      localStorage.setItem(
        GAME_CONFIG.saveKey,
        JSON.stringify(
          this.serialize(this.state, this.stateName === "SHOP" || this.stateName === "BREW")
        )
      );
    } catch (_) {}
  },

  load() {
    try {
      let raw = localStorage.getItem(GAME_CONFIG.saveKey);
      if (!raw) raw = localStorage.getItem(GAME_CONFIG.saveKeyLegacyV3);
      if (!raw) raw = localStorage.getItem(GAME_CONFIG.saveKeyLegacyV2);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data) return null;
      if (data.day > GAME_CONFIG.totalDays) {
        data.day = GAME_CONFIG.totalDays;
        data.needsNewGameHint = true;
      }
      if (data.won3day || (data.flags && data.flags.mvp_win)) {
        try {
          localStorage.removeItem(GAME_CONFIG.saveKey);
        } catch (_) {}
        return null;
      }
      return data;
    } catch (_) {
      return null;
    }
  },

  hasSave() {
    return !!this.load();
  },

  applyLoaded(data) {
    this.state = this.freshState(data.shopName);
    const ups = this.emptyUpgrades();
    if (data.upgrades) {
      Object.keys(data.upgrades).forEach((k) => {
        if (ups[k] !== undefined) {
          ups[k] = Math.max(0, Math.min(4, data.upgrades[k] | 0));
        } else if (LEGACY_UPGRADE_MAP[k] && data.upgrades[k]) {
          const m = LEGACY_UPGRADE_MAP[k];
          ups[m.id] = Math.max(ups[m.id], m.level);
        }
      });
    }
    const staff = normalizeStaffList(data.staff);
    const staffPriority = data.staffPriority || "balanced";
    Object.assign(this.state, {
      day: Math.max(1, Math.min(GAME_CONFIG.totalDays, data.day || 1)),
      money: data.money,
      rep: data.rep,
      inventory: { ...this.state.inventory, ...(data.inventory || {}) },
      upgrades: ups,
      staff,
      staffPriority,
      flags: data.flags || {},
      lifetime: data.lifetime || this.state.lifetime,
      saveVersion: 4,
    });
    Object.keys(INGREDIENTS).forEach((k) => {
      if (this.state.inventory[k] == null) this.state.inventory[k] = INGREDIENTS[k].stock;
    });
    this.muted = !!data.muted;
  },

  /* ---------- NAV ---------- */
  goTitle() {
    this.stateName = "TITLE";
    this.state = null;
    this.stopShopLoop();
    UI.renderTitle(
      () => {
        this.sfxClick();
        this.goSetup();
      },
      () => {
        this.sfxClick();
        this.continueGame();
      },
      this.hasSave(),
      this.load()?.shopName
    );
  },

  goSetup() {
    this.stateName = "SETUP";
    UI.renderNameSetup(
      (name) => {
        this.sfxClick();
        this.state = this.freshState(name);
        this.save();
        this.startDayMorning();
      },
      () => {
        this.sfxClick();
        this.goTitle();
      }
    );
  },

  continueGame() {
    const data = this.load();
    if (!data) {
      UI.toast("Không có bản lưu", "bad");
      return;
    }
    if (data.needsNewGameHint || (data.day >= GAME_CONFIG.totalDays && data.finished)) {
      UI.toast("Bản lưu đã hoàn thành — hãy chơi ván mới", "info");
      try {
        localStorage.removeItem(GAME_CONFIG.saveKey);
      } catch (_) {}
      this.goSetup();
      return;
    }
    this.applyLoaded(data);
    this.startDayMorning();
  },

  /* ---------- DAY FLOW ---------- */
  startDayMorning() {
    this.storyPhase = "morning";
    this.storyBeat = Story.getMorning(this.state.day, this.state.flags);
    this.storyLine = 0;
    if (!this.storyBeat) {
      this.openShop();
      return;
    }
    this.stateName = "STORY";
    this.showStory();
  },

  showStory() {
    UI.renderStory(
      this.storyBeat,
      this.storyLine,
      this.storyPhase,
      () => {
        this.sfxClick();
        if (this.storyLine < this.storyBeat.lines.length - 1) {
          this.storyLine++;
          this.showStory();
        } else {
          this.afterStory();
        }
      },
      (opt) => {
        this.sfxClick();
        this.applyChoice(opt);
        this.afterStory();
      }
    );
  },

  applyChoice(opt) {
    const e = opt.effect || {};
    if (e.flag) this.state.flags[e.flag] = true;
    if (e.repBonus) {
      this.state.rep = Math.min(GAME_CONFIG.maxRep, this.state.rep + e.repBonus);
    }
    if (e.bonusCustomers) {
      this.state.flags._bonusCustomers =
        (this.state.flags._bonusCustomers || 0) + e.bonusCustomers;
    }
    if (e.bonusMoney) {
      this.state.money += e.bonusMoney;
    }
    if (e.tipBonusFlag) this.state.flags._tipBoostDay = true;
    if (e.patienceFlag) this.state.flags._patienceBoost = true;
    this.save();
  },

  afterStory() {
    if (this.storyPhase === "morning") {
      this.openShop();
    } else if (this.state.day >= GAME_CONFIG.totalDays) {
      this.goWin();
    } else {
      this.goUpgrade();
    }
  },

  buildTables() {
    const n = tableCount(this.state.day, this.state.upgrades);
    const tables = [];
    for (let i = 0; i < n; i++) {
      tables.push({
        id: "t" + (i + 1),
        index: i,
        status: "empty", // empty | occupied | dirty | cleaning
        customerId: null,
        cleanT: 0,
      });
    }
    return tables;
  },

  payStaffWages() {
    let staff = normalizeStaffList(this.state.staff);
    this.state.staff = staff;
    if (!staff.length) {
      this.state.staffActive = true;
      this.staffBrewJobs = [];
      return;
    }
    let total = totalStaffWages(staff, this.state.day);
    const fired = [];
    while (staff.length && this.state.money < total) {
      const ordered = sortEmployeesForFire(staff);
      const victim = ordered[0];
      staff = staff.filter((e) => e.id !== victim.id);
      fired.push(victim);
      total = totalStaffWages(staff, this.state.day);
    }
    this.state.staff = staff;
    if (fired.length) {
      const names = fired
        .map((e) => {
          const r = staffRoleById(e.role);
          return (r ? r.emoji : "?") + " " + e.name;
        })
        .join(", ");
      UI.toast("Không đủ tiền trả lương — cho nghỉ: " + names, "bad");
      this.sfxBad();
    }
    if (!staff.length) {
      this.state.staffActive = false;
      this.staffBrewJobs = [];
      return;
    }
    this.state.money -= total;
    this.state.staffActive = true;
    if (this.dayStats) this.dayStats.wages = total;
    UI.toast("Lương NV (" + staff.length + "): " + UI.money(total), "info");
    const cnt = staffCount(staff);
    if (this.state.lifetime) {
      this.state.lifetime.peakStaff = Math.max(this.state.lifetime.peakStaff || 0, cnt);
    }
  },

  openShop() {
    this.stateName = "SHOP";
    this.state.dayRevenue = 0;
    this.state.queue = [];
    this.state.departing = [];
    this.state.readyTray = [];
    this.state.currentCustomer = null;
    this.state.shopOpen = true;
    this.state.tables = this.buildTables();
    this.cleanJob = null;
    this.moveTableCustId = null;
    this.staffTimers = { take: 1.5, serve: 2, clean: 2.5, brew: 0.8 };
    this.staffBrewJobs = [];

    this.payStaffWages();

    const tipSlots = maxStaffSlots(this.state.day, this.state.upgrades);
    const tip = managerTip(this.state.day, this.state.staff, this.state.money, tipSlots);
    if (tip) setTimeout(() => UI.toast(tip, "info"), 600);

    const fx = this.effects();
    let count = baseCustomers(this.state.day) + fx.extraCustomers;
    if (this.state.flags._bonusCustomers) {
      count += this.state.flags._bonusCustomers;
      this.state.flags._bonusCustomers = 0;
    }

    this.state.customersLeft = count;
    this.state.spawnTimer = 1.5;

    this.dayStats = {
      served: 0,
      perfect: 0,
      wrong: 0,
      left: 0,
      tips: 0,
      revenue: 0,
      repStart: this.state.rep,
      starSum: 0,
      starCount: 0,
      snacks: 0,
      combos: 0,
      dineIn: 0,
      takeaway: 0,
      cleaned: 0,
      wages: 0,
    };

    this.renderShop();
    this.save();
  },

  renderShop() {
    UI.renderShop(this.state, {
      takeOrder: (id) => this.takeOrder(id),
      startBrew: () => this.startBrew(),
      cancelOrder: () => this.cancelOrder(),
      serveReady: (trayId) => this.serveReady(trayId),
      deliverToTable: (tableId) => this.deliverToTable(tableId),
      cleanTable: (tableId) => this.cleanTable(tableId),
      seatWaiting: (custId) => this.trySeatCustomer(custId),
      moveTable: (custId) => this.beginMoveTable(custId),
      pickMoveTable: (tableId) => this.completeMoveTable(tableId),
      cancelMoveTable: () => this.cancelMoveTable(),
      unstickCustomer: (custId) => this.unstickCustomer(custId),
      forceEndDay: () => {
        this.forceClearFloorForEnd();
        this.endDay();
      },
      openRecipes: () => {
        this.sfxClick();
        UI.renderRecipesModal(this.state, () => UI.closeModal());
      },
      openInventory: () => {
        this.sfxClick();
        UI.renderInventoryModal(this.state, () => UI.closeModal());
      },
      openStaff: () => {
        this.sfxClick();
        this.renderStaffModal();
      },
      toggleMute: () => this.toggleMute(),
      endDay: () => this.endDay(),
    });
  },

  floorCount() {
    let n = this.state.queue.length + this.state.departing.length;
    if (
      this.state.currentCustomer &&
      !this.state.queue.find((c) => c.id === this.state.currentCustomer.id)
    ) {
      n += 1;
    }
    return n;
  },

  waitingCustomers() {
    return this.state.queue.filter(
      (c) => c.phase === "waiting" || c.phase === "seated_ready"
    );
  },

  takeawayWaiting() {
    return this.state.queue.filter(
      (c) => c.phase === "waiting" && c.service === "takeaway"
    );
  },

  dineInNeedingOrder() {
    return this.state.queue.filter((c) => c.phase === "seated_ready");
  },

  /* ---------- ORDER PICKING (randomized each spawn) ---------- */
  pickOrderType() {
    const w = orderTypeWeights(this.state.day);
    const r = Math.random();
    if (r < w.drink) return "drink";
    if (r < w.drink + w.snack) return "snack";
    return "combo";
  },

  buildOrder() {
    const day = this.state.day;
    let type = this.pickOrderType();
    const unlockedDrinks = RECIPES.filter((r) => r.unlockDay <= day);
    const unlockedSnacks = SNACKS.filter((s) => s.unlockDay <= day);

    if (type !== "drink" && !unlockedSnacks.length) type = "drink";
    if (type === "combo" && (!unlockedDrinks.length || !unlockedSnacks.length)) {
      type = unlockedSnacks.length ? "snack" : "drink";
    }

    // Always pick fresh random recipes from unlocked menu
    const recipe =
      type !== "snack" && unlockedDrinks.length
        ? { ...unlockedDrinks[Math.floor(Math.random() * unlockedDrinks.length)] }
        : null;
    const snack =
      type !== "drink" && unlockedSnacks.length
        ? { ...unlockedSnacks[Math.floor(Math.random() * unlockedSnacks.length)] }
        : null;

    if (!recipe && !snack) {
      const fallback = unlockedDrinks[0] || RECIPES[0];
      return { type: "drink", recipe: { ...fallback }, snack: null };
    }
    if (!recipe && snack) return { type: "snack", recipe: null, snack };
    if (recipe && !snack) return { type: "drink", recipe, snack: null };
    return { type, recipe, snack };
  },

  orderPrice(order) {
    let p = 0;
    if (order.recipe) p += order.recipe.price;
    if (order.snack) p += order.snack.price;
    if (order.type === "combo") p = Math.round(p * 0.95);
    return p;
  },

  orderLabel(order) {
    if (order.type === "drink") return `${order.recipe.emoji} ${order.recipe.name}`;
    if (order.type === "snack") return `${order.snack.emoji} ${order.snack.name}`;
    return `${order.recipe.emoji}+${order.snack.emoji} Combo`;
  },

  orderTicketText(order) {
    const parts = [];
    if (order.recipe) parts.push(`${order.recipe.emoji} ${order.recipe.name}`);
    if (order.snack) parts.push(`${order.snack.emoji} ${order.snack.name}`);
    return parts.join(" + ");
  },

  /* ---------- CUSTOMERS ---------- */
  pickServiceMode() {
    return Math.random() < dineInWeight(this.state.day) ? "dinein" : "takeaway";
  },

  freeTable() {
    return this.state.tables.find((t) => t.status === "empty") || null;
  },

  dirtyTableCount() {
    return this.state.tables.filter((t) => t.status === "dirty" || t.status === "cleaning").length;
  },

  spawnCustomer() {
    const order = this.buildOrder();
    let service = this.pickServiceMode();
    // If all tables dirty/full and dine-in rolled, still allow but they'll wait
    // Day 1 first customers gentle: more takeaway if only 2 tables
    if (this.state.day <= 2 && Math.random() < 0.25) service = "takeaway";

    let name = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    let emoji = CUSTOMER_EMOJIS[Math.floor(Math.random() * CUSTOMER_EMOJIS.length)];
    let isNPC = false;
    let npcRole = "";
    const arrivedOrServing =
      this.dayStats.served +
      this.dayStats.left +
      this.state.queue.length +
      this.state.departing.length +
      (this.state.currentCustomer ? 1 : 0);

    if (this.state.day === 1 && arrivedOrServing === 1) {
      name = NPCS.mai.name;
      emoji = NPCS.mai.emoji;
      isNPC = true;
      npcRole = NPCS.mai.role;
      service = "takeaway";
    } else if (this.state.day === 2 && arrivedOrServing === 0) {
      name = NPCS.linh.name;
      emoji = NPCS.linh.emoji;
      isNPC = true;
      npcRole = NPCS.linh.role;
      const matcha = RECIPES.find((r) => r.id === "matcha_latte");
      if (matcha) {
        order.type = "drink";
        order.recipe = { ...matcha };
        order.snack = null;
      }
      service = "dinein";
    } else if (this.state.day >= 2 && arrivedOrServing === 2 && this.state.day <= 7) {
      name = NPCS.anh.name;
      emoji = NPCS.anh.emoji;
      isNPC = true;
      npcRole = NPCS.anh.role;
    }

    const fx = this.effects();
    let maxP =
      GAME_CONFIG.customerPatienceBase +
      (this.state.rep - 2.5) * 4 +
      fx.patienceBonus;
    if (this.state.flags._patienceBoost) maxP += 8;
    // Dirty tables hurt dine-in patience slightly for everyone waiting
    if (service === "dinein" && this.dirtyTableCount() > 0) {
      maxP -= this.dirtyTableCount() * 3;
    }

    const walkDur =
      WALK_CONFIG.inMin + Math.random() * (WALK_CONFIG.inMax - WALK_CONFIG.inMin);
    const lineSlot = this.state.queue.filter((c) => c.phase !== "walking_out").length;

    const customer = {
      id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name,
      emoji,
      isNPC,
      npcRole,
      patience: maxP,
      maxPatience: maxP,
      order,
      service, // takeaway | dinein
      tableId: null,
      phase: "walking_in",
      walkT: 0,
      walkDur,
      lineSlot,
      pos: 0,
      targetPos: service === "takeaway" ? this.slotPos(lineSlot) : 0.35,
      mood: "walk",
      bag: false,
      eatT: 0,
      pendingResult: null,
    };
    this.state.queue.push(customer);
    this.state.customersLeft--;
    if (service === "dinein") this.dayStats.dineIn++;
    else this.dayStats.takeaway++;
  },

  slotPos(slot) {
    return Math.max(0.42, 0.78 - slot * 0.09);
  },

  tablePos(index, total) {
    // tables along lower-mid floor, leftish area
    const start = 0.22;
    const span = 0.4;
    if (total <= 1) return start + span / 2;
    return start + (index / (total - 1)) * span;
  },

  reindexLineSlots() {
    let i = 0;
    this.state.queue.forEach((c) => {
      if (c.phase === "waiting" && c.service === "takeaway") {
        c.lineSlot = i;
        c.targetPos = this.slotPos(i);
        i++;
      }
    });
  },

  trySeatCustomer(custId) {
    const c = this.state.queue.find((x) => x.id === custId);
    if (!c || c.service !== "dinein") return false;
    if (c.phase !== "waiting_table" && c.phase !== "walking_in") return false;
    const table = this.freeTable();
    if (!table) return false;
    this.seatAtTable(c, table);
    this.renderShop();
    return true;
  },

  seatAtTable(customer, table) {
    table.status = "occupied";
    table.customerId = customer.id;
    customer.tableId = table.id;
    customer.phase = "seated_ready";
    customer.mood = "sit";
    customer.pos = this.tablePos(table.index, this.state.tables.length);
    customer.targetPos = customer.pos;
    this.sfxClick();
  },

  takeOrder(idOrIndex) {
    if (this.state.currentCustomer) return;
    // Prefer explicit id: seated dine-in or takeaway waiting
    let customer = null;
    if (typeof idOrIndex === "string") {
      customer =
        this.state.queue.find((c) => c.id === idOrIndex) ||
        null;
      if (!customer) return;
      if (customer.phase === "seated_ready") {
        // ok
      } else if (customer.phase === "waiting" && customer.service === "takeaway") {
        const waiting = this.takeawayWaiting();
        if (!waiting.length || waiting[0].id !== customer.id) return;
      } else {
        return;
      }
    } else {
      // default: first takeaway, else first seated
      const tw = this.takeawayWaiting();
      const di = this.dineInNeedingOrder();
      customer = tw[0] || di[0] || null;
    }
    if (!customer) return;

    this.sfxClick();
    // Keep dine-in in queue visually at table; remove from "counter queue" sense
    if (customer.service === "takeaway") {
      this.state.queue = this.state.queue.filter((c) => c.id !== customer.id);
      customer.phase = "serving";
      customer.mood = "order";
      customer.pos = 0.88;
      customer.targetPos = 0.88;
    } else {
      customer.phase = "serving";
      customer.mood = "order";
      // stay at table position
    }
    this.state.currentCustomer = customer;
    this.reindexLineSlots();
    this.renderShop();
  },

  findCustomerById(id) {
    if (!id || !this.state) return null;
    if (this.state.currentCustomer && this.state.currentCustomer.id === id) {
      return this.state.currentCustomer;
    }
    return (this.state.queue || []).find((c) => c.id === id) || null;
  },

  canMoveTable(customer) {
    if (!customer || customer.service !== "dinein") return false;
    return [
      "seated_ready",
      "serving",
      "waiting_food",
      "waiting_brew",
      "eating",
    ].includes(customer.phase);
  },

  beginMoveTable(custId) {
    const c = this.findCustomerById(custId);
    if (!c || !this.canMoveTable(c)) {
      UI.toast("Không thể đổi bàn khách này", "bad");
      return;
    }
    const empties = (this.state.tables || []).filter((t) => t.status === "empty");
    if (!empties.length) {
      UI.toast("Không còn bàn trống sạch", "bad");
      this.sfxBad();
      return;
    }
    this.sfxClick();
    this.moveTableCustId = c.id;
    UI.renderMoveTableModal(this.state, c, {
      pick: (tableId) => this.completeMoveTable(tableId),
      cancel: () => this.cancelMoveTable(),
    });
  },

  cancelMoveTable() {
    this.moveTableCustId = null;
    UI.closeModal();
    this.renderShop();
  },

  completeMoveTable(targetTableId) {
    const custId = this.moveTableCustId;
    this.moveTableCustId = null;
    UI.closeModal();
    const customer = this.findCustomerById(custId);
    if (!customer || !this.canMoveTable(customer)) {
      UI.toast("Khách không còn ngồi để đổi bàn", "bad");
      this.renderShop();
      return;
    }
    const target = (this.state.tables || []).find((t) => t.id === targetTableId);
    if (!target || target.status !== "empty") {
      UI.toast("Bàn đích không trống sạch", "bad");
      this.sfxBad();
      this.renderShop();
      return;
    }
    const oldId = customer.tableId;
    const old = oldId
      ? (this.state.tables || []).find((t) => t.id === oldId)
      : null;

    // Free old table: dirty if food already at table / eating; else empty
    if (old) {
      const hadFood =
        customer.phase === "eating" ||
        customer.phase === "waiting_food" ||
        !!(this.state.readyTray || []).find(
          (t) => t.customerId === customer.id && t.service === "dinein"
        );
      if (old.customerId === customer.id || old.status === "occupied") {
        old.status = hadFood ? "dirty" : "empty";
        old.customerId = null;
        old.cleanT = 0;
      }
    }

    target.status = "occupied";
    target.customerId = customer.id;
    customer.tableId = target.id;
    customer.pos = this.tablePos(target.index, this.state.tables.length);
    customer.targetPos = customer.pos;

    // Keep ready tray linked by customerId; refresh tableId
    (this.state.readyTray || []).forEach((tray) => {
      if (tray.customerId === customer.id) tray.tableId = target.id;
    });
    this.staffBrewJobs.forEach((job) => {
      if (job.customerId === customer.id) job.tableId = target.id;
    });

    this.sfxOk();
    UI.toast(
      `Đã đổi ${customer.name} sang bàn ${target.id.replace("t", "B")}`,
      "good"
    );
    this.renderShop();
    this.save();
  },

  /**
   * Last-resort: force-resolve a stuck customer so the day can finish.
   */
  unstickCustomer(custId) {
    const c = this.findCustomerById(custId);
    if (!c) {
      this.syncFloorIntegrity(true);
      this.renderShop();
      return;
    }
    this.sfxClick();
    if (this.state.currentCustomer && this.state.currentCustomer.id === c.id) {
      this.state.currentCustomer = null;
      this.brewSession = null;
      if (this.stateName === "BREW") this.stateName = "SHOP";
    }
    this.staffBrewJobs = (this.staffBrewJobs || []).filter(
      (j) => j.customerId !== c.id
    );

    if (c.phase === "eating") {
      this.forceFinishEating(c);
      return;
    }
    if (c.phase === "waiting_food") {
      const tray = (this.state.readyTray || []).find((t) => t.customerId === c.id);
      if (tray) {
        this.deliverToTable(c.tableId, tray.id);
        return;
      }
    }
    if (c.phase === "waiting_pickup") {
      const tray = (this.state.readyTray || []).find((t) => t.customerId === c.id);
      if (tray) {
        this.completeTakeaway(tray);
        return;
      }
    }

    this.state.readyTray = (this.state.readyTray || []).filter(
      (t) => t.customerId !== c.id
    );
    this.state.queue = this.state.queue.filter((x) => x.id !== c.id);
    if (this.dayStats) this.dayStats.left++;
    const stars = 1;
    this.applyStarRep(stars);
    this.recordStars(stars);
    this.beginDepart(c, "left");
    UI.toast("Đã xử lý khách treo: " + c.name, "info");
    this.renderShop();
    this.save();
  },

  forceFinishEating(customer) {
    if (!customer || customer.phase !== "eating") return false;
    let result = customer.pendingResult;
    if (!result) {
      result = { quality: "ok", elapsed: 0, fast: true, softLimit: GAME_CONFIG.brewTimeLimit };
    }
    this.state.queue = this.state.queue.filter((x) => x.id !== customer.id);
    try {
      this.applyPaymentAndRate(customer, result, "dinein");
    } catch (err) {
      // Ensure customer leaves even if payment UI fails
      this.markTableDirty(customer);
      this.beginDepart(customer, "served");
      UI.toast("Khách dùng xong (khôi phục treo)", "info");
    }
    return true;
  },

  /**
   * Reconcile tables / trays / stuck phases so the last customer cannot soft-lock the day.
   */
  syncFloorIntegrity(forceToast) {
    if (!this.state || !this.state.shopOpen) return false;
    let changed = false;
    const queue = this.state.queue || [];
    const alive = new Set(queue.map((c) => c.id));
    if (this.state.currentCustomer) alive.add(this.state.currentCustomer.id);

    // Orphan ready trays (customer left or wrong phase)
    const keepTrays = [];
    (this.state.readyTray || []).forEach((tray) => {
      const c = this.findCustomerById(tray.customerId);
      if (!c) {
        changed = true;
        return;
      }
      const okPhase =
        (tray.service === "takeaway" && c.phase === "waiting_pickup") ||
        (tray.service === "dinein" && c.phase === "waiting_food");
      if (!okPhase) {
        // If dine-in still waiting brew/serving, keep briefly; else discard
        if (
          tray.service === "dinein" &&
          (c.phase === "waiting_brew" || c.phase === "serving")
        ) {
          tray.tableId = c.tableId || tray.tableId;
          keepTrays.push(tray);
          return;
        }
        changed = true;
        return;
      }
      // Keep tray linked to customer id; refresh tableId
      if (c.tableId) tray.tableId = c.tableId;
      keepTrays.push(tray);
    });
    if (keepTrays.length !== (this.state.readyTray || []).length) {
      this.state.readyTray = keepTrays;
      changed = true;
    }

    // Ghost / desynced tables
    (this.state.tables || []).forEach((t) => {
      if (t.status === "occupied") {
        const c = t.customerId ? this.findCustomerById(t.customerId) : null;
        if (!c) {
          // Occupied with no living customer → free
          t.status = "empty";
          t.customerId = null;
          t.cleanT = 0;
          changed = true;
        } else if (c.tableId && c.tableId !== t.id) {
          // Table points at customer who moved elsewhere
          t.status = "empty";
          t.customerId = null;
          changed = true;
        } else if (!c.tableId && c.service === "dinein") {
          c.tableId = t.id;
          changed = true;
        }
      } else if (t.status === "cleaning" && !this.cleanJob) {
        // Cleaning flag without job → finish as empty
        t.status = "empty";
        t.customerId = null;
        t.cleanT = 0;
        changed = true;
      }
    });

    // Dine-in customers missing table link while seated — preserve phase
    queue.forEach((c) => {
      if (c.service !== "dinein") return;
      if (
        !["seated_ready", "serving", "waiting_food", "waiting_brew", "eating"].includes(
          c.phase
        )
      ) {
        return;
      }
      const keepPhase = c.phase;
      const keepMood = c.mood;
      if (c.tableId) {
        const t = this.state.tables.find((x) => x.id === c.tableId);
        if (!t) {
          c.tableId = null;
          changed = true;
        } else if (t.status === "dirty" || t.status === "cleaning") {
          // Table wrongly marked — reclaim if this customer still owns it
          if (t.customerId === c.id || !t.customerId) {
            t.status = "occupied";
            t.customerId = c.id;
            changed = true;
          } else {
            c.tableId = null;
            changed = true;
          }
        } else if (t.status === "empty") {
          t.status = "occupied";
          t.customerId = c.id;
          changed = true;
        } else if (t.customerId !== c.id) {
          t.customerId = c.id;
          changed = true;
        }
      }
      if (!c.tableId) {
        const free = this.freeTable();
        if (free) {
          free.status = "occupied";
          free.customerId = c.id;
          c.tableId = free.id;
          c.pos = this.tablePos(free.index, this.state.tables.length);
          c.targetPos = c.pos;
          c.phase = keepPhase;
          c.mood = keepMood;
          changed = true;
        }
      }
    });

    // Orphan staff brew jobs without customer → drop
    const jobs = [];
    (this.staffBrewJobs || []).forEach((job) => {
      const c = this.findCustomerById(job.customerId);
      if (!c) {
        changed = true;
        return;
      }
      jobs.push(job);
    });
    this.staffBrewJobs = jobs;

    // Force-finish overlong eating (fail-safe if normal tick missed)
    if (!UI.hasModal()) {
      const eatMax = (GAME_CONFIG.eatDuration || 4.5) * 1.35;
      (this.state.queue || [])
        .filter((c) => c.phase === "eating")
        .forEach((c) => {
          if (c.eatT == null) c.eatT = 0;
          if (
            c.eatT >= eatMax ||
            (c.eatT >= (GAME_CONFIG.eatDuration || 4.5) && !c.pendingResult)
          ) {
            this.forceFinishEating(c);
            changed = true;
          }
        });
    }

    // Long waiting_food with tray → auto force-serve; without tray → leave
    if (!UI.hasModal()) {
      const waitingFood = (this.state.queue || []).filter((c) => c.phase === "waiting_food");
      waitingFood.forEach((c) => {
        const waited = (c.maxPatience || 0) - (c.patience || 0);
        const tray = (this.state.readyTray || []).find((t) => t.customerId === c.id);
        if (tray && c.patience <= Math.max(3, (c.maxPatience || 30) * 0.12)) {
          this.deliverToTable(c.tableId, tray.id);
          changed = true;
        } else if (!tray && waited > 28) {
          this.state.queue = this.state.queue.filter((x) => x.id !== c.id);
          if (this.dayStats) this.dayStats.left++;
          this.applyStarRep(1);
          this.recordStars(1);
          this.beginDepart(c, "left");
          UI.toast(c.name + " chờ món quá lâu — đã bỏ đi", "bad");
          changed = true;
        }
      });
    }

    // waiting_brew with no matching job → return to serving / orderable
    queue
      .filter((c) => c.phase === "waiting_brew")
      .forEach((c) => {
        const job = (this.staffBrewJobs || []).find((j) => j.customerId === c.id);
        if (!job) {
          if (!this.state.currentCustomer) {
            this.state.currentCustomer = c;
            c.phase = "serving";
            c.mood = "order";
            this.state.queue = this.state.queue.filter((x) => x.id !== c.id);
            changed = true;
            if (forceToast) UI.toast("Đơn pha chế treo — trả về quầy", "info");
          }
        }
      });

    return changed;
  },

  isDayFloorClear() {
    if (!this.state) return false;
    const activePhases = new Set([
      "waiting",
      "waiting_table",
      "seated_ready",
      "waiting_food",
      "waiting_pickup",
      "waiting_brew",
      "eating",
      "serving",
      "walking_in",
    ]);
    const active = (this.state.queue || []).filter((c) => activePhases.has(c.phase)).length;
    if (active > 0) return false;
    if ((this.state.departing || []).length > 0) return false;
    if (this.state.currentCustomer) return false;
    if ((this.state.readyTray || []).length > 0) return false;
    if (this.state.customersLeft > 0) return false;
    if ((this.staffBrewJobs || []).length > 0) return false;
    if ((this.state.tables || []).some((t) => t.status === "occupied" || t.status === "cleaning")) {
      return false;
    }
    return true;
  },

  hasStuckLastCustomers() {
    if (!this.state || this.state.customersLeft > 0) return false;
    if (this.state.currentCustomer) return true;
    if ((this.staffBrewJobs || []).length > 0) return true;
    return (this.state.queue || []).some((c) =>
      ["waiting_food", "waiting_brew", "waiting_pickup", "eating", "serving", "waiting_table"].includes(
        c.phase
      )
    );
  },

  beginDepart(customer, reason) {
    if (!customer) return;
    // free table if still marked occupied without dirty transition
    if (customer.tableId) {
      const t = this.state.tables.find((x) => x.id === customer.tableId);
      if (t && (t.customerId === customer.id || t.status === "occupied")) {
        if (t.customerId === customer.id || !this.findCustomerById(t.customerId)) {
          // angry/left → empty; served should already be dirty via markTableDirty
          if (reason === "angry" || reason === "left") {
            t.status = "empty";
            t.customerId = null;
          } else if (t.status === "occupied") {
            // Safety: never leave a ghost occupied table behind
            t.status = "empty";
            t.customerId = null;
          }
        }
      }
      // after eating we already set dirty
    }
    this.state.queue = this.state.queue.filter((c) => c.id !== customer.id);
    customer.phase = "walking_out";
    customer.mood = reason === "angry" || reason === "left" ? "angry" : "happy";
    customer.walkT = 0;
    customer.walkDur =
      WALK_CONFIG.outMin + Math.random() * (WALK_CONFIG.outMax - WALK_CONFIG.outMin);
    customer.targetPos = 0;
    customer.exitReason = reason;
    customer._outStart = null;
    this.state.departing.push(customer);
  },

  markTableDirty(customer) {
    if (!customer.tableId) return;
    const t = this.state.tables.find((x) => x.id === customer.tableId);
    if (!t) return;
    t.status = "dirty";
    t.customerId = null;
    customer.tableId = null;
  },

  cancelOrder() {
    if (!this.state.currentCustomer) return;
    this.sfxBad();
    const c = this.state.currentCustomer;
    this.state.currentCustomer = null;
    // remove from queue if still there
    this.state.queue = this.state.queue.filter((x) => x.id !== c.id);
    const stars = 1;
    const repDelta = this.applyStarRep(stars);
    this.dayStats.wrong++;
    this.recordStars(stars);
    this.beginDepart(c, "angry");
    UI.toast("Đã huỷ đơn (−uy tín)", "bad");
    this.renderShop();
    this.save();
    UI.renderServeResult(
      {
        quality: "wrong",
        payText: "Huỷ đơn",
        stars,
        repDelta,
        flavor: this.starFlavor(stars),
        starDisplay: this.starString(stars),
      },
      () => {
        UI.closeModal();
        this.renderShop();
      }
    );
  },

  /* ---------- STARS ---------- */
  calcStars(result, customer) {
    if (!result || result.quality === "left") return 1;
    const patienceRatio = customer
      ? Math.max(0, customer.patience / customer.maxPatience)
      : 0.5;
    const limit = result.softLimit || GAME_CONFIG.brewTimeLimit;
    const slow = result.elapsed > limit || !result.fast;
    const fx = this.effects();
    let bonus = 0;
    if (
      (result.type === "snack" || result.type === "combo") &&
      result.snackPerfect
    ) {
      bonus += fx.snackStarBonus || 0;
    }

    let stars = 1;
    if (result.quality === "perfect") {
      if (result.fast && patienceRatio > 0.35) stars = 5;
      else if (result.fast || patienceRatio > 0.5) stars = 4;
      else stars = 4;
    } else if (result.quality === "ok") {
      if (!slow && patienceRatio > 0.4) stars = 4;
      else stars = 3;
    } else {
      stars = patienceRatio > 0.5 ? 2 : 1;
    }
    stars = Math.min(5, stars + bonus);
    return stars;
  },

  applyStarRep(stars) {
    const map = { 5: 0.2, 4: 0.12, 3: 0.05, 2: -0.1, 1: -0.25 };
    let delta = map[stars] != null ? map[stars] : 0;
    const fx = this.effects();
    if (stars >= 4 && fx.displayRepNudge) delta += fx.displayRepNudge;
    const before = this.state.rep;
    this.state.rep = Math.max(0.5, Math.min(GAME_CONFIG.maxRep, this.state.rep + delta));
    return this.state.rep - before;
  },

  recordStars(stars) {
    if (!this.dayStats) return;
    this.dayStats.starSum += stars;
    this.dayStats.starCount += 1;
    if (this.state.lifetime) {
      this.state.lifetime.starSum += stars;
      this.state.lifetime.starCount += 1;
    }
  },

  starFlavor(stars) {
    const list = STAR_FLAVOR[stars] || STAR_FLAVOR[3];
    return list[Math.floor(Math.random() * list.length)];
  },

  starString(n) {
    return "★".repeat(n) + "☆".repeat(Math.max(0, 5 - n));
  },

  /* ---------- BREW ---------- */
  startBrew() {
    if (!this.state.currentCustomer) return;
    this.sfxClick();
    this.stateName = "BREW";
    this.brewSession = Brew.createSession(
      this.state.currentCustomer.order,
      this.state.upgrades
    );
    // apply cashier speed nudge into session
    const fx = this.effects();
    this.brewSession.shakeSpeed = fx.shakeSpeed;
    this.brewSession.blendSpeed = fx.blendSpeed;
    this.brewSession.snackSpeed = fx.snackSpeed;
    this.renderBrew();
  },

  renderBrew() {
    UI.renderBrew(this.state, this.brewSession, {
      selectBrew: (field, id) => {
        this.sfxClick();
        Brew.select(this.brewSession, field, id);
        this.renderBrew();
      },
      brewBack: () => {
        this.sfxClick();
        Brew.goBack(this.brewSession);
        this.renderBrew();
      },
      brewNext: () => {
        this.sfxClick();
        const step = Brew.currentStep(this.brewSession);
        if (
          !this.brewSession.selections[step] &&
          step !== "method" &&
          step !== "snack_method"
        ) {
          UI.toast("Hãy chọn một mục trước", "bad");
          return;
        }
        Brew.goNext(this.brewSession);
        this.renderBrew();
      },
      startMethod: () => {
        this.sfxClick();
        Brew.startMethod(this.brewSession);
        this.renderBrew();
      },
      shakeClick: () => {
        this.beep(400 + this.brewSession.methodProgress * 4, 0.03, "square", 0.04);
        const done = Brew.clickShake(this.brewSession);
        UI.updateMethodBar(this.brewSession);
        if (!done && !this.brewSession.methodActive && !this.brewSession.done) {
          this.renderBrew();
          return;
        }
        if (done) this.finishBrew();
      },
      openRecipes: () => {
        this.sfxClick();
        UI.renderRecipesModal(this.state, () => UI.closeModal());
      },
    });
  },

  finishBrew() {
    const session = this.brewSession;
    Brew.consumeStock(this.state.inventory, session);
    const result = session.result;
    this.resolveServe(result);
  },

  /**
   * After brewing: takeaway → readyTray (pickup);
   * dine-in → readyTray (needs bưng món to table).
   * Payment+stars happen on delivery / pickup / after eat.
   */
  resolveServe(result) {
    const customer = this.state.currentCustomer;
    if (!customer) return;
    const order = customer.order;

    // prep pay preview stored with tray
    const tray = {
      id: "tray_" + Date.now() + "_" + Math.random().toString(36).slice(2, 5),
      customerId: customer.id,
      tableId: customer.tableId,
      service: customer.service,
      order,
      result,
      createdAt: Date.now(),
    };

    // put customer into waiting-for-food state
    if (customer.service === "takeaway") {
      // back to queue near counter waiting pickup
      customer.phase = "waiting_pickup";
      customer.mood = "wait";
      customer.pos = 0.82;
      customer.targetPos = 0.82;
      customer.pendingResult = result;
      if (!this.state.queue.find((c) => c.id === customer.id)) {
        this.state.queue.push(customer);
      }
    } else {
      customer.phase = "waiting_food";
      customer.mood = "wait";
      customer.pendingResult = result;
      // ensure still in queue at table
      if (!this.state.queue.find((c) => c.id === customer.id)) {
        this.state.queue.push(customer);
      }
    }

    this.state.readyTray.push(tray);
    this.state.currentCustomer = null;
    this.brewSession = null;
    this.stateName = "SHOP";

    const label =
      customer.service === "takeaway"
        ? "Mang đi sẵn sàng — giao túi / khách lấy"
        : "Món sẵn sàng — Bưng món tới bàn!";
    UI.toast(label, "good");
    this.sfxOk();
    this.renderShop();
    this.save();
  },

  serveReady(trayId) {
    const tray = this.state.readyTray.find((t) => t.id === trayId);
    if (!tray) return;
    if (tray.service === "takeaway") {
      this.completeTakeaway(tray);
    } else {
      this.deliverToTable(tray.tableId, tray.id);
    }
  },

  completeTakeaway(tray) {
    const customer =
      this.state.queue.find((c) => c.id === tray.customerId) ||
      (this.state.currentCustomer && this.state.currentCustomer.id === tray.customerId
        ? this.state.currentCustomer
        : null);
    if (!customer) {
      this.state.readyTray = this.state.readyTray.filter((t) => t.id !== tray.id);
      return;
    }
    this.sfxClick();
    this.state.readyTray = this.state.readyTray.filter((t) => t.id !== tray.id);
    this.state.queue = this.state.queue.filter((c) => c.id !== customer.id);
    customer.bag = true;
    this.applyPaymentAndRate(customer, tray.result, "takeaway");
  },

  deliverToTable(tableId, trayId) {
    let tray = null;
    if (trayId) tray = this.state.readyTray.find((t) => t.id === trayId);
    if (!tray) {
      tray = this.state.readyTray.find(
        (t) => t.service === "dinein" && t.tableId === tableId
      );
    }
    if (!tray && tableId) {
      const table = this.state.tables.find((t) => t.id === tableId);
      if (table && table.customerId) {
        tray = this.state.readyTray.find((t) => t.customerId === table.customerId);
      }
    }
    // also allow delivering first dine-in tray
    if (!tray) {
      tray = this.state.readyTray.find((t) => t.service === "dinein");
    }
    if (!tray || tray.service !== "dinein") return;

    const customer = this.state.queue.find((c) => c.id === tray.customerId);
    if (!customer || customer.phase !== "waiting_food") {
      // Orphan / desynced tray — discard so it cannot soft-lock end of day
      this.state.readyTray = this.state.readyTray.filter((t) => t.id !== tray.id);
      UI.toast("Món không khớp khách — đã bỏ khay", "info");
      this.renderShop();
      return;
    }

    this.sfxClick();
    this.state.readyTray = this.state.readyTray.filter((t) => t.id !== tray.id);
    customer.phase = "eating";
    customer.mood = "eat";
    customer.eatT = 0;
    customer.pendingResult = tray.result;
    UI.toast(`Đã bưng món tới bàn ${customer.tableId || ""}`.trim(), "good");
    this.renderShop();
  },

  cleanTable(tableId) {
    const table = this.state.tables.find((t) => t.id === tableId);
    if (!table || table.status !== "dirty") return;
    if (this.cleanJob) {
      UI.toast("Đang dọn một bàn rồi", "info");
      return;
    }
    this.sfxClick();
    table.status = "cleaning";
    this.cleanJob = {
      tableId: table.id,
      t: 0,
      dur: GAME_CONFIG.cleanDuration,
      by: "player",
    };
    this.renderShop();
  },

  finishClean(tableId) {
    const table = this.state.tables.find((t) => t.id === tableId);
    if (!table) return;
    table.status = "empty";
    table.customerId = null;
    table.cleanT = 0;
    if (this.dayStats) this.dayStats.cleaned++;
    if (this.cleanJob && this.cleanJob.tableId === tableId) this.cleanJob = null;
    UI.toast("Bàn sạch rồi ✓", "good");
  },

  applyPaymentAndRate(customer, result, mode) {
    const order = customer.order;
    const price = this.orderPrice(order);
    let pay = 0;
    let tip = 0;
    let quality = result.quality;
    let payText = "";
    const fx = this.effects();
    const stars = this.calcStars(result, customer);

    let tipChance = GAME_CONFIG.tipChance + fx.tipChanceBonus;
    if (this.state.flags._tipBoostDay) tipChance += 0.15;
    if (result.fast) tipChance += 0.15;

    if (quality === "perfect") {
      pay = price;
      if (Math.random() < tipChance || result.extraToppingBonus) {
        tip = Math.round(price * GAME_CONFIG.tipRate);
      }
      if (result.extraToppingBonus) tip += 3000 + (fx.toppingTipBonus || 0);
      if (order.type === "combo") tip += fx.displayComboTip || 0;
      this.dayStats.perfect++;
      this.sfxOk();
      this.sfxCoin();
      payText = `+${UI.money(pay)}${tip ? " + tip " + UI.money(tip) : ""}`;
    } else if (quality === "ok") {
      pay = Math.round(price * 0.7);
      this.sfxOk();
      payText = `+${UI.money(pay)} (giảm vì gần đúng)`;
    } else {
      pay = 0;
      this.dayStats.wrong++;
      this.sfxBad();
      payText = "Hoàn tiền · −uy tín";
    }

    if (order.type === "snack") this.dayStats.snacks++;
    if (order.type === "combo") this.dayStats.combos++;

    const repDelta = this.applyStarRep(stars);
    this.recordStars(stars);

    if (quality !== "wrong") {
      this.dayStats.served++;
      if (this.state.lifetime) this.state.lifetime.served++;
    }
    this.state.money += pay + tip;
    this.state.dayRevenue += pay + tip;
    this.dayStats.tips += tip;
    this.dayStats.revenue += pay + tip;
    if (this.state.lifetime) this.state.lifetime.totalRevenue += pay + tip;

    if (mode === "dinein") {
      this.markTableDirty(customer);
    }

    this.beginDepart(customer, quality === "wrong" ? "angry" : "served");
    this.renderShop();
    UI.renderServeResult(
      {
        quality,
        payText,
        stars,
        repDelta,
        flavor: this.starFlavor(stars),
        starDisplay: this.starString(stars),
        serviceTag: mode === "dinein" ? "Tại chỗ" : "Mang đi",
      },
      () => {
        UI.closeModal();
        this.renderShop();
        this.save();
      }
    );
  },

  /* ---------- STAFF AI ---------- */
  tickStaff(dt) {
    if (!this.state.staffActive) return false;
    const staff = normalizeStaffList(this.state.staff);
    this.state.staff = staff;
    if (!staff.length) return false;
    let changed = false;
    const priority = this.state.staffPriority || "balanced";
    const nCashier = countRole(staff, "cashier");
    const nServer = countRole(staff, "server");
    const nCleaner = countRole(staff, "cleaner");
    const nBarista = countRole(staff, "barista");
    const interval = (base, n, min) => Math.max(min, base / Math.sqrt(Math.max(1, n)));

    // Cashier: accept orders (takeaway handoff moved to server)
    if (nCashier > 0) {
      this.staffTimers.take -= dt;
      if (this.staffTimers.take <= 0) {
        this.staffTimers.take = interval(2.6, nCashier, 1.1) + Math.random() * 0.8;
        if (!this.state.currentCustomer && this.stateName === "SHOP") {
          const tw = this.takeawayWaiting();
          if (tw.length) {
            this.takeOrder(tw[0].id);
            UI.toast("🧾 Thu ngân nhận đơn mang đi", "info");
            changed = true;
          } else {
            const di = this.dineInNeedingOrder();
            if (di.length) {
              this.takeOrder(di[0].id);
              UI.toast("🧾 Thu ngân nhận đơn bàn", "info");
              changed = true;
            }
          }
        }
      }
    }

    // Barista: auto-brew in parallel (slots = barista count)
    if (!this.staffBrewJobs) this.staffBrewJobs = [];
    if (nBarista > 0 && this.stateName === "SHOP") {
      while (this.staffBrewJobs.length < nBarista) {
        const cust = this.state.currentCustomer;
        if (!cust || this.brewSession) break;
        const order = cust.order;
        const dur = baristaBrewDuration(order, this.state.upgrades, nBarista);
        const adj = priority === "brew" ? 0.85 : priority === "clean" ? 1.1 : 1;
        const busy = new Set(this.staffBrewJobs.map((j) => j.empId));
        const emp =
          employeesOfRole(staff, "barista").find((e) => !busy.has(e.id)) ||
          employeesOfRole(staff, "barista")[0];
        this.staffBrewJobs.push({
          empId: emp.id,
          empName: emp.name,
          customerId: cust.id,
          t: 0,
          dur: dur * adj,
          order,
          service: cust.service,
          tableId: cust.tableId,
        });
        cust.phase = "waiting_brew";
        cust.mood = "wait";
        if (!this.state.queue.find((c) => c.id === cust.id)) this.state.queue.push(cust);
        if (cust.service === "takeaway") {
          cust.pos = 0.82;
          cust.targetPos = 0.82;
        }
        this.state.currentCustomer = null;
        UI.toast("🧋 " + emp.name + " đang pha chế…", "info");
        changed = true;
      }
    }
    // Brew job ticking moved to tickShop (always runs; avoids orphan hangs)

    // Server: deliver, takeaway handoff, seat, soft-clean if no cleaner
    if (nServer > 0) {
      this.staffTimers.serve -= dt;
      if (this.staffTimers.serve <= 0) {
        this.staffTimers.serve = interval(3.0, nServer, 1.2) + Math.random() * 1.2;
        const readyDi = this.state.readyTray.find((x) => x.service === "dinein");
        const readyTw = this.state.readyTray.find((x) => x.service === "takeaway");
        if (readyDi) {
          this.deliverToTable(readyDi.tableId, readyDi.id);
          UI.toast("🍽️ Phục vụ bưng món", "info");
          changed = true;
        } else if (readyTw) {
          const c = this.state.queue.find(
            (x) => x.id === readyTw.customerId && x.phase === "waiting_pickup"
          );
          if (c) {
            this.completeTakeaway(readyTw);
            UI.toast("🍽️ Phục vụ giao túi mang đi", "info");
            changed = true;
          }
        } else if (nCleaner === 0 && priority !== "brew") {
          const dirty = this.state.tables.find((x) => x.status === "dirty");
          if (dirty && !this.cleanJob) {
            dirty.status = "cleaning";
            this.cleanJob = {
              tableId: dirty.id,
              t: 0,
              dur: GAME_CONFIG.cleanDuration * 1.55,
              by: "staff",
            };
            UI.toast("🍽️ Phục vụ dọn bàn", "info");
            changed = true;
          }
        } else {
          const waiter = this.state.queue.find((c) => c.phase === "waiting_table");
          if (waiter) {
            const table = this.freeTable();
            if (table) {
              this.seatAtTable(waiter, table);
              UI.toast("🍽️ Phục vụ xếp bàn", "info");
              changed = true;
            }
          }
        }
      }
    }

    // Cleaner
    if (nCleaner > 0) {
      this.staffTimers.clean -= dt;
      const cleanBoost = priority === "clean" ? 0.75 : priority === "brew" ? 1.15 : 1;
      if (this.staffTimers.clean <= 0) {
        this.staffTimers.clean =
          interval(2.2, nCleaner, 0.9) * cleanBoost + Math.random() * 0.6;
        if (!this.cleanJob) {
          const dirty = this.state.tables.find((x) => x.status === "dirty");
          if (dirty) {
            dirty.status = "cleaning";
            this.cleanJob = {
              tableId: dirty.id,
              t: 0,
              dur: GAME_CONFIG.cleanDuration * 0.8 * cleanBoost,
              by: "staff",
            };
            UI.toast("🧹 Tạp vụ dọn bàn", "info");
            changed = true;
          }
        }
      }
    }
    return changed;
  },

  finishStaffBrew(job) {
    const customer =
      this.state.queue.find((c) => c.id === job.customerId) ||
      (this.state.currentCustomer && this.state.currentCustomer.id === job.customerId
        ? this.state.currentCustomer
        : null);
    if (!customer) {
      // Customer already left — drop job silently (caller removes from list)
      return;
    }
    let session;
    try {
      session = Brew.autoPerfect(job.order, this.state.upgrades, job.dur);
    } catch (e) {
      session = null;
    }
    if (!session || !session.result) {
      UI.toast("🧋 Pha chế lỗi — cần bạn hỗ trợ", "bad");
      if (!this.state.currentCustomer) {
        this.state.currentCustomer = customer;
        customer.phase = "serving";
        this.state.queue = this.state.queue.filter((c) => c.id !== customer.id);
      }
      return;
    }
    Brew.consumeStock(this.state.inventory, session);
    const result = session.result;
    // Temporarily set currentCustomer so resolveServe can run, then clear brewSession
    const prev = this.state.currentCustomer;
    const prevBrew = this.brewSession;
    this.state.currentCustomer = customer;
    this.brewSession = null;
    this.state.queue = this.state.queue.filter((c) => c.id !== customer.id);
    this.resolveServe(result);
    if (prev && prev.id !== customer.id) {
      // shouldn't happen; leave as resolveServe cleared current
    }
    UI.toast("🧋 " + (job.empName || "Pha chế") + " xong món!", "good");
  },


  /* ---------- DAY END ---------- */
  forceClearFloorForEnd() {
    // Silent clear so Kết thúc ngày is never soft-locked by ghost entities
    this.staffBrewJobs = [];
    this.brewSession = null;
    this.moveTableCustId = null;
    UI.closeModal();
    if (this.state.currentCustomer) {
      const c = this.state.currentCustomer;
      this.state.currentCustomer = null;
      if (!(this.state.queue || []).find((x) => x.id === c.id)) {
        this.state.queue.push(c);
      }
    }
    this.state.readyTray = [];
    const left = [...(this.state.queue || [])];
    this.state.queue = [];
    left.forEach((c) => {
      if (c.phase === "eating" && c.pendingResult) {
        // Quiet settle: pay without modal
        const result = c.pendingResult;
        const price = this.orderPrice(c.order);
        let pay = result.quality === "perfect" ? price : result.quality === "ok" ? Math.round(price * 0.7) : 0;
        if (pay > 0) {
          this.state.money += pay;
          this.state.dayRevenue += pay;
          if (this.dayStats) {
            this.dayStats.revenue += pay;
            this.dayStats.served++;
          }
        } else if (this.dayStats) this.dayStats.wrong++;
        const stars = this.calcStars(result, c);
        this.applyStarRep(stars);
        this.recordStars(stars);
        this.markTableDirty(c);
        // Skip beginDepart animation — day is ending
      } else {
        if (this.dayStats) this.dayStats.left++;
        this.applyStarRep(1);
        this.recordStars(1);
        if (c.tableId) {
          const t = this.state.tables.find((x) => x.id === c.tableId);
          if (t) {
            t.status = "empty";
            t.customerId = null;
          }
          c.tableId = null;
        }
      }
    });
    this.state.departing = [];
    (this.state.tables || []).forEach((t) => {
      if (t.status === "occupied" || t.status === "cleaning") {
        t.status = "empty";
        t.customerId = null;
        t.cleanT = 0;
      }
    });
    this.cleanJob = null;
  },

  endDay() {
    this.state.shopOpen = false;
    this.stateName = "DAY_END";
    this.state.flags._tipBoostDay = false;
    this.cleanJob = null;

    const goal = dayGoal(this.state.day);
    const repDelta = this.state.rep - this.dayStats.repStart;
    if (this.state.dayRevenue >= goal) {
      this.state.rep = Math.min(GAME_CONFIG.maxRep, this.state.rep + 0.2);
      this.state.money += GAME_CONFIG.goalBonus;
      UI.toast("Đạt mục tiêu! +" + UI.money(GAME_CONFIG.goalBonus) + " thưởng", "good");
    }

    const avgStars =
      this.dayStats.starCount > 0
        ? this.dayStats.starSum / this.dayStats.starCount
        : 0;

    if (this.state.lifetime) this.state.lifetime.daysPlayed = this.state.day;

    this.save();
    UI.renderDayEnd(
      {
        day: this.state.day,
        totalDays: GAME_CONFIG.totalDays,
        revenue: this.state.dayRevenue,
        goal,
        served: this.dayStats.served,
        perfect: this.dayStats.perfect,
        wrong: this.dayStats.wrong,
        left: this.dayStats.left,
        tips: this.dayStats.tips,
        snacks: this.dayStats.snacks,
        combos: this.dayStats.combos,
        dineIn: this.dayStats.dineIn,
        takeaway: this.dayStats.takeaway,
        cleaned: this.dayStats.cleaned,
        staff: staffCount(this.state.staff),
        rep: this.state.rep,
        repDelta,
        money: this.state.money,
        avgStars,
        starCount: this.dayStats.starCount,
      },
      () => {
        this.sfxClick();
        this.storyPhase = "evening";
        this.storyBeat = Story.getEvening(this.state.day);
        this.storyLine = 0;
        if (this.storyBeat) {
          this.stateName = "STORY";
          this.showStory();
        } else if (this.state.day >= GAME_CONFIG.totalDays) {
          this.goWin();
        } else {
          this.goUpgrade();
        }
      }
    );
  },

  goUpgrade() {
    this.stateName = "UPGRADE";
    this.renderUpgrade();
  },

  renderUpgrade() {
    UI.renderUpgrade(this.state, {
      buyUpgrade: (id) => this.buyUpgrade(id),
      buyStock: (id, qty) => this.buyStock(id, qty),
      hireStaff: (roleId) => this.hireStaff(roleId),
      fireStaff: (id) => this.fireStaff(id),
      setPriority: (id) => this.setStaffPriority(id),
      nextDay: () => this.advanceDay(),
    });
  },

  renderStaffModal() {
    UI.renderStaffModal(this.state, {
      hireStaff: (roleId) => {
        this.hireStaff(roleId);
        UI.closeModal();
        this.renderStaffModal();
      },
      fireStaff: (id) => {
        this.fireStaff(id);
        UI.closeModal();
        this.renderStaffModal();
      },
      setPriority: (id) => {
        this.setStaffPriority(id);
        UI.closeModal();
        this.renderStaffModal();
      },
      close: () => UI.closeModal(),
    });
  },

  hireStaff(roleId) {
    const role = staffRoleById(roleId);
    if (!role) return;
    if (this.state.day < role.unlockDay) {
      UI.toast("Mở từ ngày " + role.unlockDay, "bad");
      this.sfxBad();
      return;
    }
    const staff = normalizeStaffList(this.state.staff);
    const slots = maxStaffSlots(this.state.day, this.state.upgrades);
    if (staff.length >= slots) {
      UI.toast("Tối đa " + slots + " nhân viên ở giai đoạn này", "bad");
      this.sfxBad();
      return;
    }
    const fee = Math.round(staffWage(role, this.state.day) * 0.5);
    if (this.state.money < fee) {
      UI.toast("Không đủ tiền đặt cọc thuê", "bad");
      this.sfxBad();
      return;
    }
    const emp = this.newEmployee(role.id);
    if (!emp) return;
    this.state.money -= fee;
    staff.push(emp);
    this.state.staff = staff;
    this.state.staffActive = true;
    this.sfxCoin();
    UI.toast(
      "Thuê " + role.emoji + " " + emp.name + " (" + role.name + ") −" + UI.money(fee),
      "good"
    );
    if (this.state.lifetime) {
      this.state.lifetime.peakStaff = Math.max(
        this.state.lifetime.peakStaff || 0,
        staff.length
      );
    }
    this.save();
    if (this.stateName === "UPGRADE") this.renderUpgrade();
  },

  fireStaff(empIdOrRole) {
    let staff = normalizeStaffList(this.state.staff);
    let emp = staff.find((e) => e.id === empIdOrRole);
    if (!emp) {
      const role = STAFF_ROLE_ALIAS[empIdOrRole] || empIdOrRole;
      emp = staff.find((e) => e.role === role);
    }
    if (!emp) return;
    const role = staffRoleById(emp.role);
    staff = staff.filter((e) => e.id !== emp.id);
    this.state.staff = staff;
    this.sfxClick();
    UI.toast("Cho nghỉ " + (role ? role.emoji + " " : "") + emp.name, "info");
    this.save();
    if (this.stateName === "UPGRADE") this.renderUpgrade();
  },

  setStaffPriority(id) {
    if (!STAFF_PRIORITY_OPTIONS.find((p) => p.id === id)) return;
    this.state.staffPriority = id;
    UI.toast(
      "Ưu tiên: " + STAFF_PRIORITY_OPTIONS.find((p) => p.id === id).label,
      "info"
    );
    this.save();
    if (this.stateName === "UPGRADE") this.renderUpgrade();
  },


  buyUpgrade(id) {
    const device = DEVICES.find((x) => x.id === id);
    if (!device) return;
    const cur = this.state.upgrades[id] | 0;
    if (cur >= device.maxLevel) return;
    const cost = deviceUpgradeCost(device, cur);
    if (cost == null) return;
    if (this.state.money < cost) {
      UI.toast("Không đủ tiền", "bad");
      this.sfxBad();
      return;
    }
    this.state.money -= cost;
    this.state.upgrades[id] = cur + 1;
    this.sfxCoin();
    UI.toast(`${device.emoji} ${device.name} → Cấp ${cur + 1}/4`, "good");
    this.save();
    this.renderUpgrade();
  },

  buyStock(id, qty) {
    const ing = INGREDIENTS[id];
    if (!ing) return;
    const fx = this.effects();
    const disc = fx.stockDiscount || 0;
    let add = qty;
    if (qty >= 5 && fx.stockBonusQty) add = qty + fx.stockBonusQty;
    const cost = Math.round(ing.cost * (1 - disc) * qty);
    if (this.state.money < cost) {
      UI.toast("Không đủ tiền", "bad");
      this.sfxBad();
      return;
    }
    this.state.money -= cost;
    this.state.inventory[id] = (this.state.inventory[id] || 0) + add;
    this.sfxClick();
    UI.toast(`+${add} ${ing.name}`, "good");
    this.save();
    this.renderUpgrade();
  },

  advanceDay() {
    this.sfxClick();
    if (this.state.day >= GAME_CONFIG.totalDays) {
      this.goWin();
      return;
    }
    this.state.day += 1;
    this.save();
    this.startDayMorning();
  },

  goWin() {
    this.stateName = "WIN";
    this.state.flags.finished = true;
    this.save();
    UI.renderWin(this.state, () => {
      try {
        localStorage.removeItem(GAME_CONFIG.saveKey);
      } catch (_) {}
      this.goTitle();
    });
  },

  /* ---------- LOOP ---------- */
  stopShopLoop() {},

  loop(ts) {
    const dt = this.lastTs ? Math.min(0.1, (ts - this.lastTs) / 1000) : 0.016;
    this.lastTs = ts;

    if (this.stateName === "SHOP" && this.state && this.state.shopOpen) {
      this.tickShop(dt);
    }
    if (this.stateName === "BREW" && this.brewSession) {
      this.tickBrew(dt);
    }

    this.raf = requestAnimationFrame((t) => this.loop(t));
  },

  tickShop(dt) {
    let needFullRender = false;
    let needQueueRefresh = false;

    if (this.syncFloorIntegrity(false)) needFullRender = true;

    // Progress barista jobs even if staff panel toggled off / count changed
    if (this.staffBrewJobs && this.staffBrewJobs.length) {
      const still = [];
      this.staffBrewJobs.forEach((job) => {
        job.t += dt;
        if (job.t >= job.dur) {
          this.finishStaffBrew(job);
          needFullRender = true;
        } else still.push(job);
      });
      this.staffBrewJobs = still;
    }

    // cleaning progress
    if (this.cleanJob) {
      this.cleanJob.t += dt;
      const table = this.state.tables.find((t) => t.id === this.cleanJob.tableId);
      if (table) table.cleanT = this.cleanJob.t / this.cleanJob.dur;
      if (this.cleanJob.t >= this.cleanJob.dur) {
        this.finishClean(this.cleanJob.tableId);
        needFullRender = true;
      }
    }

    // spawn
    if (this.state.customersLeft > 0) {
      this.state.spawnTimer -= dt;
      const maxFloor = WALK_CONFIG.maxOnFloor + Math.min(2, this.state.tables.length);
      if (this.state.spawnTimer <= 0 && this.floorCount() < maxFloor) {
        this.spawnCustomer();
        this.state.spawnTimer = 3.5 + Math.random() * 4.5;
        needFullRender = true;
      }
    }

    // auto-seat dine-in walkers when table free
    this.state.queue.forEach((c) => {
      if (c.service === "dinein" && c.phase === "waiting_table") {
        const table = this.freeTable();
        if (table) {
          this.seatAtTable(c, table);
          needFullRender = true;
        } else {
          // patience drains while waiting for table — worse if dirty
          const drain = 1 + this.dirtyTableCount() * 0.25;
          c.patience -= dt * drain;
        }
      }
    });

    this.state.queue.forEach((c) => {
      if (c.phase === "walking_in") {
        c.walkT += dt;
        const t = Math.min(1, c.walkT / c.walkDur);
        const ease = 1 - Math.pow(1 - t, 2);
        c.pos = ease * c.targetPos;
        c.mood = "walk";
        if (t >= 1) {
          if (c.service === "takeaway") {
            c.phase = "waiting";
            c.pos = c.targetPos;
            c.mood = "wait";
            this.reindexLineSlots();
          } else {
            const table = this.freeTable();
            if (table) {
              this.seatAtTable(c, table);
            } else {
              c.phase = "waiting_table";
              c.mood = "wait";
              c.pos = 0.28;
              c.targetPos = 0.28;
            }
          }
          needQueueRefresh = true;
          needFullRender = true;
        }
      } else if (c.phase === "waiting") {
        const diff = c.targetPos - c.pos;
        if (Math.abs(diff) > 0.002) {
          c.pos += diff * Math.min(1, dt * 3);
        }
      } else if (c.phase === "eating") {
        c.eatT = (c.eatT || 0) + dt;
        if (c.eatT >= GAME_CONFIG.eatDuration) {
          // Defer finish to after iteration (mutation-safe)
          c._finishEat = true;
        }
      } else if (c.phase === "waiting_pickup") {
        // patience while waiting for bag
        c.patience -= dt * 0.35;
      } else if (c.phase === "waiting_brew") {
        c.patience -= dt * 0.3;
      } else if (c.phase === "waiting_food" || c.phase === "seated_ready") {
        c.patience -= dt * 0.4;
      }
    });

    // Finish eaters after iteration (avoids forEach mutation + null result crash)
    const finishEaters = (this.state.queue || []).filter((c) => c._finishEat);
    finishEaters.forEach((c) => {
      c._finishEat = false;
      if (this.forceFinishEating(c)) needFullRender = true;
    });

    // departing
    const stillDeparting = [];
    this.state.departing.forEach((c) => {
      if (c._outStart == null) c._outStart = c.pos != null ? c.pos : 0.88;
      c.walkT += dt;
      const t = Math.min(1, c.walkT / c.walkDur);
      const ease = 1 - Math.pow(1 - t, 2);
      c.pos = c._outStart * (1 - ease);
      c.mood = c.exitReason === "angry" || c.exitReason === "left" ? "angry" : "happy";
      if (t < 1) stillDeparting.push(c);
      else needFullRender = true;
    });
    if (stillDeparting.length !== this.state.departing.length) needFullRender = true;
    this.state.departing = stillDeparting;

    // patience leave (waiting takeaway / table / food)
    const leftIds = [];
    this.state.queue.forEach((c) => {
      if (
        c.phase === "waiting" ||
        c.phase === "waiting_table" ||
        c.phase === "seated_ready" ||
        c.phase === "waiting_food" ||
        c.phase === "waiting_pickup" ||
        c.phase === "waiting_brew"
      ) {
        if (c.phase === "waiting") c.patience -= dt;
        if (c.patience <= 0) leftIds.push(c.id);
      }
    });
    if (leftIds.length) {
      const leavers = this.state.queue.filter((c) => leftIds.includes(c.id));
      this.state.queue = this.state.queue.filter((c) => !leftIds.includes(c.id));
      // remove their ready trays
      this.state.readyTray = this.state.readyTray.filter(
        (t) => !leftIds.includes(t.customerId)
      );
      leavers.forEach((c) => {
        this.dayStats.left++;
        const stars = 1;
        this.applyStarRep(stars);
        this.recordStars(stars);
        this.beginDepart(c, "left");
      });
      this.reindexLineSlots();
      this.sfxBad();
      UI.toast("Một khách đã bỏ đi... ★☆☆☆☆", "bad");
      needFullRender = true;
    }

    if (this.state.currentCustomer && this.stateName === "SHOP") {
      this.state.currentCustomer.patience -= dt * 0.5;
      if (this.state.currentCustomer.patience <= 0) {
        const c = this.state.currentCustomer;
        this.state.currentCustomer = null;
        this.state.queue = this.state.queue.filter((x) => x.id !== c.id);
        this.dayStats.left++;
        const stars = 1;
        this.applyStarRep(stars);
        this.recordStars(stars);
        this.beginDepart(c, "left");
        this.sfxBad();
        UI.toast("Khách bỏ đi khi đang nhận đơn!", "bad");
        needFullRender = true;
      }
    }

    if (this.tickStaff(dt)) needFullRender = true;

    // Offer end-day / unstick when spawn is done
    const dayMayEnd =
      this.state.customersLeft <= 0 &&
      (this.isDayFloorClear() || this.hasStuckLastCustomers());

    if (needFullRender && !UI.hasModal()) {
      this.renderShop();
      this.save();
    } else {
      UI.syncShopFloor(this.state);
      UI.syncTables(this.state, {
        cleanTable: (id) => this.cleanTable(id),
        deliverToTable: (id) => this.deliverToTable(id),
        takeOrder: (id) => this.takeOrder(id),
        pickMoveTable: (id) => this.completeMoveTable(id),
        moveTableCustId: this.moveTableCustId,
      });
      if ((needQueueRefresh || dayMayEnd) && !UI.hasModal()) {
        UI.renderQueue(this.state, {
          takeOrder: (id) => this.takeOrder(id),
          moveTable: (id) => this.beginMoveTable(id),
          unstickCustomer: (id) => this.unstickCustomer(id),
        });
        UI.refreshQueuePanelMeta(this.state, {
          endDay: () => this.endDay(),
          unstickCustomer: (id) => this.unstickCustomer(id),
          canEndDay: () => this.isDayFloorClear(),
          hasStuck: () => this.hasStuckLastCustomers(),
        });
        UI.renderReadyTray(this.state, {
          serveReady: (id) => this.serveReady(id),
        });
        UI.renderFloorActions(this.state, {
          takeOrder: (id) => this.takeOrder(id),
          serveReady: (id) => this.serveReady(id),
          cleanTable: (id) => this.cleanTable(id),
          deliverToTable: (id) => this.deliverToTable(id),
          moveTable: (id) => this.beginMoveTable(id),
        });
      } else {
        UI.syncPatienceBars(this.state);
      }
      if (needFullRender) this.save();
    }
  },

  tickBrew(dt) {
    if (!this.brewSession || !this.brewSession.methodActive) return;
    const done = Brew.tickMethod(this.brewSession, dt);
    UI.updateMethodBar(this.brewSession);
    if (!done && !this.brewSession.methodActive && !this.brewSession.done) {
      this.renderBrew();
      return;
    }
    if (done) this.finishBrew();

    if (this.state.currentCustomer) {
      this.state.currentCustomer.patience -= dt;
      if (this.state.currentCustomer.patience <= 0) {
        this.brewSession.methodActive = false;
        this.brewSession = null;
        const c = this.state.currentCustomer;
        this.state.currentCustomer = null;
        this.state.queue = this.state.queue.filter((x) => x.id !== c.id);
        this.dayStats.left++;
        const stars = 1;
        const repDelta = this.applyStarRep(stars);
        this.recordStars(stars);
        this.stateName = "SHOP";
        this.beginDepart(c, "left");
        this.sfxBad();
        this.renderShop();
        UI.renderServeResult(
          {
            quality: "left",
            payText: "Không kịp phục vụ",
            stars,
            repDelta,
            flavor: this.starFlavor(stars),
            starDisplay: this.starString(stars),
          },
          () => {
            UI.closeModal();
            this.renderShop();
            this.save();
          }
        );
      }
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Game.boot());
