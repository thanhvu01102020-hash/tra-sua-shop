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
  staffTimers: { take: 0, serve: 0, clean: 0, brewHelp: 0 },
  cleanJob: null, // { tableId, t, dur, by: 'player'|'staff' }

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
    if (this.state && this.state.staff && this.state.staff.cashier && this.state.staffActive) {
      base.brewTimeBonus = (base.brewTimeBonus || 0) + 4;
      base.shakeSpeed = (base.shakeSpeed || 1) * 1.08;
      base.blendSpeed = (base.blendSpeed || 1) * 1.08;
      base.snackSpeed = (base.snackSpeed || 1) * 1.06;
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
    return { cashier: false, server: false, janitor: false };
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
      saveVersion: 3,
    };
  },

  migrateSaveIfNeeded() {
    try {
      const v3 = localStorage.getItem(GAME_CONFIG.saveKey);
      if (v3) return;

      let raw = localStorage.getItem(GAME_CONFIG.saveKeyLegacyV2);
      let from = 2;
      if (!raw) {
        raw = localStorage.getItem(GAME_CONFIG.saveKeyLegacy);
        from = 1;
      }
      if (!raw) return;
      const old = JSON.parse(raw);
      if (!old) return;

      if (old.won3day || old.won || (old.flags && old.flags.mvp_win)) {
        try {
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
      if (old.staff) {
        migrated.staff = {
          cashier: !!old.staff.cashier,
          server: !!old.staff.server,
          janitor: !!old.staff.janitor,
        };
      }

      localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(this.serialize(migrated, false)));
      try {
        localStorage.removeItem(GAME_CONFIG.saveKeyLegacyV2);
        localStorage.removeItem(GAME_CONFIG.saveKeyLegacy);
      } catch (_) {}
    } catch (_) {}
  },

  serialize(state, midDay) {
    return {
      saveVersion: 3,
      shopName: state.shopName,
      day: state.day,
      money: state.money,
      rep: state.rep,
      inventory: state.inventory,
      upgrades: state.upgrades,
      staff: state.staff || this.emptyStaff(),
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
      if (!raw) {
        // try v2 still present
        raw = localStorage.getItem(GAME_CONFIG.saveKeyLegacyV2);
      }
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
    const staff = this.emptyStaff();
    if (data.staff) {
      staff.cashier = !!data.staff.cashier;
      staff.server = !!data.staff.server;
      staff.janitor = !!data.staff.janitor;
    }
    Object.assign(this.state, {
      day: Math.max(1, Math.min(GAME_CONFIG.totalDays, data.day || 1)),
      money: data.money,
      rep: data.rep,
      inventory: { ...this.state.inventory, ...(data.inventory || {}) },
      upgrades: ups,
      staff,
      flags: data.flags || {},
      lifetime: data.lifetime || this.state.lifetime,
      saveVersion: 3,
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
    const staff = this.state.staff || this.emptyStaff();
    let total = 0;
    const working = [];
    STAFF_ROLES.forEach((role) => {
      if (staff[role.id]) {
        const w = staffWage(role, this.state.day);
        total += w;
        working.push({ role, wage: w });
      }
    });
    if (!working.length) {
      this.state.staffActive = true;
      return;
    }
    if (this.state.money < total) {
      // fire all if can't pay
      working.forEach((w) => {
        this.state.staff[w.role.id] = false;
      });
      this.state.staffActive = false;
      UI.toast("Không đủ tiền trả lương — nhân viên nghỉ việc hôm nay!", "bad");
      this.sfxBad();
      return;
    }
    this.state.money -= total;
    this.state.staffActive = true;
    const names = working.map((w) => w.role.emoji + " −" + UI.money(w.wage)).join(" · ");
    UI.toast("Lương nhân viên: " + names, "info");
    const cnt = staffCount(this.state.staff);
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
    this.staffTimers = { take: 1.5, serve: 2, clean: 2.5, brewHelp: 0 };

    this.payStaffWages();

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

  beginDepart(customer, reason) {
    if (!customer) return;
    // free table if still marked occupied without dirty transition
    if (customer.tableId) {
      const t = this.state.tables.find((x) => x.id === customer.tableId);
      if (t && t.customerId === customer.id && t.status === "occupied") {
        // angry leave without eating → free table (not dirty)
        if (reason === "angry" || reason === "left") {
          t.status = "empty";
          t.customerId = null;
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
      UI.toast("Không tìm thấy khách chờ món", "bad");
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
    const staff = this.state.staff || {};
    if (!staff.cashier && !staff.server && !staff.janitor) return false;
    let changed = false;

    if (staff.cashier) {
      this.staffTimers.take -= dt;
      if (this.staffTimers.take <= 0) {
        this.staffTimers.take = 2.8 + Math.random() * 1.5;
        if (!this.state.currentCustomer && this.stateName === "SHOP") {
          const tw = this.takeawayWaiting();
          if (tw.length) {
            this.takeOrder(tw[0].id);
            UI.toast("🧾 Thu ngân nhận đơn mang đi", "info");
          } else {
            const di = this.dineInNeedingOrder();
            if (di.length && Math.random() < 0.45) {
              this.takeOrder(di[0].id);
              UI.toast("🧾 Thu ngân nhận đơn bàn", "info");
            }
          }
        }
        // auto complete takeaway pickup if ready
        const readyTw = this.state.readyTray.find((t) => t.service === "takeaway");
        if (readyTw && !this.state.currentCustomer) {
          const c = this.state.queue.find(
            (x) => x.id === readyTw.customerId && x.phase === "waiting_pickup"
          );
          if (c) {
            this.completeTakeaway(readyTw);
            UI.toast("🧾 Giao túi mang đi", "info");
          }
        }
      }
    }

    if (staff.server) {
      this.staffTimers.serve -= dt;
      if (this.staffTimers.serve <= 0) {
        this.staffTimers.serve = 3.2 + Math.random() * 1.8;
        const readyDi = this.state.readyTray.find((t) => t.service === "dinein");
        if (readyDi) {
          this.deliverToTable(readyDi.tableId, readyDi.id);
          UI.toast("🍽️ Phục vụ bưng món", "info");
        } else if (!staff.janitor) {
          // soft clean one dirty table slowly
          const dirty = this.state.tables.find((t) => t.status === "dirty");
          if (dirty && !this.cleanJob) {
            dirty.status = "cleaning";
            this.cleanJob = {
              tableId: dirty.id,
              t: 0,
              dur: GAME_CONFIG.cleanDuration * 1.6,
              by: "staff",
            };
            UI.toast("🍽️ Phục vụ dọn bàn", "info");
            changed = true;
          }
        }
      }
    }

    if (staff.janitor) {
      this.staffTimers.clean -= dt;
      if (this.staffTimers.clean <= 0) {
        this.staffTimers.clean = 2.4 + Math.random();
        if (!this.cleanJob) {
          const dirty = this.state.tables.find((t) => t.status === "dirty");
          if (dirty) {
            dirty.status = "cleaning";
            this.cleanJob = {
              tableId: dirty.id,
              t: 0,
              dur: GAME_CONFIG.cleanDuration * 0.85,
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

  /* ---------- DAY END ---------- */
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
      fireStaff: (roleId) => this.fireStaff(roleId),
      nextDay: () => this.advanceDay(),
    });
  },

  renderStaffModal() {
    UI.renderStaffModal(this.state, {
      hireStaff: (roleId) => {
        this.hireStaff(roleId);
        UI.closeModal();
        if (this.stateName === "UPGRADE") this.renderUpgrade();
        else this.renderShop();
      },
      fireStaff: (roleId) => {
        this.fireStaff(roleId);
        UI.closeModal();
        if (this.stateName === "UPGRADE") this.renderUpgrade();
        else this.renderShop();
      },
      close: () => UI.closeModal(),
    });
  },

  hireStaff(roleId) {
    const role = STAFF_ROLES.find((r) => r.id === roleId);
    if (!role) return;
    if (this.state.day < role.unlockDay) {
      UI.toast(`Mở từ ngày ${role.unlockDay}`, "bad");
      this.sfxBad();
      return;
    }
    if (this.state.staff[roleId]) {
      UI.toast("Đã thuê rồi", "info");
      return;
    }
    const slots = maxStaffSlots(this.state.day);
    if (staffCount(this.state.staff) >= slots) {
      UI.toast(`Tối đa ${slots} nhân viên ở giai đoạn này`, "bad");
      this.sfxBad();
      return;
    }
    // hiring fee = half day wage
    const fee = Math.round(staffWage(role, this.state.day) * 0.5);
    if (this.state.money < fee) {
      UI.toast("Không đủ tiền đặt cọc thuê", "bad");
      this.sfxBad();
      return;
    }
    this.state.money -= fee;
    this.state.staff[roleId] = true;
    this.sfxCoin();
    UI.toast(`Đã thuê ${role.emoji} ${role.name} (−${UI.money(fee)})`, "good");
    this.save();
    if (this.stateName === "UPGRADE") this.renderUpgrade();
  },

  fireStaff(roleId) {
    const role = STAFF_ROLES.find((r) => r.id === roleId);
    if (!role || !this.state.staff[roleId]) return;
    this.state.staff[roleId] = false;
    this.sfxClick();
    UI.toast(`Đã cho nghỉ ${role.emoji} ${role.name}`, "info");
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
        c.eatT += dt;
        if (c.eatT >= GAME_CONFIG.eatDuration) {
          const result = c.pendingResult;
          this.state.queue = this.state.queue.filter((x) => x.id !== c.id);
          this.applyPaymentAndRate(c, result, "dinein");
          needFullRender = true;
        }
      } else if (c.phase === "waiting_pickup") {
        // patience while waiting for bag
        c.patience -= dt * 0.35;
      } else if (c.phase === "waiting_food" || c.phase === "seated_ready") {
        c.patience -= dt * 0.4;
      }
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
        c.phase === "waiting_pickup"
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

    if (needFullRender && !UI.hasModal()) {
      this.renderShop();
      this.save();
    } else {
      UI.syncShopFloor(this.state);
      UI.syncTables(this.state, {
        cleanTable: (id) => this.cleanTable(id),
        deliverToTable: (id) => this.deliverToTable(id),
        takeOrder: (id) => this.takeOrder(id),
      });
      if (needQueueRefresh && !UI.hasModal()) {
        UI.renderQueue(this.state, {
          takeOrder: (id) => this.takeOrder(id),
        });
        UI.refreshQueuePanelMeta(this.state, {
          endDay: () => this.endDay(),
        });
        UI.renderReadyTray(this.state, {
          serveReady: (id) => this.serveReady(id),
        });
        UI.renderFloorActions(this.state, {
          takeOrder: (id) => this.takeOrder(id),
          serveReady: (id) => this.serveReady(id),
          cleanTable: (id) => this.cleanTable(id),
          deliverToTable: (id) => this.deliverToTable(id),
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
