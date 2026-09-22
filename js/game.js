/* ===== MAIN GAME STATE MACHINE ===== */
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
  _floorDirty: false,

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
    return getEffects(this.state ? this.state.upgrades : {});
  },

  /* ---------- SAVE / LOAD / MIGRATE ---------- */
  emptyUpgrades() {
    const u = {};
    DEVICES.forEach((d) => {
      u[d.id] = 0;
    });
    return u;
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
      flags: {},
      dayRevenue: 0,
      queue: [],
      departing: [],
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
      },
      saveVersion: 2,
    };
  },

  migrateSaveIfNeeded() {
    try {
      const v2 = localStorage.getItem(GAME_CONFIG.saveKey);
      if (v2) {
        const data = JSON.parse(v2);
        if (data && data.won3day) {
          localStorage.removeItem(GAME_CONFIG.saveKey);
        }
        return;
      }
      const legacy = localStorage.getItem(GAME_CONFIG.saveKeyLegacy);
      if (!legacy) return;
      const old = JSON.parse(legacy);
      if (!old) return;

      // Old 3-day win: clear and start fresh prompt
      if (old.won || old.day > 3 && old.flags && old.flags.mvp_win) {
        localStorage.removeItem(GAME_CONFIG.saveKeyLegacy);
        return;
      }

      const migrated = this.freshState(old.shopName);
      migrated.day = Math.min(GAME_CONFIG.totalDays, Math.max(1, old.day || 1));
      if (old.day > GAME_CONFIG.totalDays) migrated.day = 1;
      migrated.money = old.money != null ? old.money : migrated.money;
      migrated.rep = old.rep != null ? old.rep : migrated.rep;
      migrated.flags = old.flags || {};
      delete migrated.flags.mvp_win;
      delete migrated.flags.won;

      // merge inventory
      if (old.inventory) {
        Object.keys(INGREDIENTS).forEach((k) => {
          if (old.inventory[k] != null) migrated.inventory[k] = old.inventory[k];
        });
      }

      // map legacy boolean upgrades → levels
      const ups = this.emptyUpgrades();
      if (old.upgrades) {
        Object.keys(old.upgrades).forEach((k) => {
          if (!old.upgrades[k]) return;
          if (typeof old.upgrades[k] === "number") {
            if (ups[k] !== undefined) ups[k] = Math.min(4, old.upgrades[k]);
          } else if (LEGACY_UPGRADE_MAP[k]) {
            const m = LEGACY_UPGRADE_MAP[k];
            ups[m.id] = Math.max(ups[m.id], m.level);
          }
        });
      }
      migrated.upgrades = ups;
      migrated.muted = !!old.muted;

      localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(this.serialize(migrated, false)));
      localStorage.removeItem(GAME_CONFIG.saveKeyLegacy);
    } catch (_) {}
  },

  serialize(state, midDay) {
    return {
      saveVersion: 2,
      shopName: state.shopName,
      day: state.day,
      money: state.money,
      rep: state.rep,
      inventory: state.inventory,
      upgrades: state.upgrades,
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
      const raw = localStorage.getItem(GAME_CONFIG.saveKey);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data) return null;
      // clamp / invalidate broken saves
      if (data.day > GAME_CONFIG.totalDays) {
        data.day = GAME_CONFIG.totalDays;
        data.needsNewGameHint = true;
      }
      if (data.won3day || data.flags && data.flags.mvp_win) {
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
    Object.assign(this.state, {
      day: Math.max(1, Math.min(GAME_CONFIG.totalDays, data.day || 1)),
      money: data.money,
      rep: data.rep,
      inventory: { ...this.state.inventory, ...(data.inventory || {}) },
      upgrades: ups,
      flags: data.flags || {},
      lifetime: data.lifetime || this.state.lifetime,
    });
    // ensure all ingredient keys exist
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
    if (data.needsNewGameHint || data.day >= GAME_CONFIG.totalDays && data.finished) {
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

  openShop() {
    this.stateName = "SHOP";
    this.state.dayRevenue = 0;
    this.state.queue = [];
    this.state.departing = [];
    this.state.currentCustomer = null;
    this.state.shopOpen = true;

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
    };

    this.renderShop();
  },

  renderShop() {
    UI.renderShop(this.state, {
      takeOrder: (id) => this.takeOrder(id),
      startBrew: () => this.startBrew(),
      cancelOrder: () => this.cancelOrder(),
      openRecipes: () => {
        this.sfxClick();
        UI.renderRecipesModal(this.state, () => UI.closeModal());
      },
      openInventory: () => {
        this.sfxClick();
        UI.renderInventoryModal(this.state, () => UI.closeModal());
      },
      toggleMute: () => this.toggleMute(),
      endDay: () => this.endDay(),
    });
  },

  floorCount() {
    return (
      this.state.queue.length +
      this.state.departing.length +
      (this.state.currentCustomer ? 1 : 0)
    );
  },

  waitingCustomers() {
    return this.state.queue.filter((c) => c.phase === "waiting");
  },

  /* ---------- ORDER PICKING ---------- */
  pickOrderType() {
    const day = this.state.day;
    const unlockedSnacks = SNACKS.filter((s) => s.unlockDay <= day);
    if (!unlockedSnacks.length) return "drink";

    const r = Math.random();
    const cw = comboWeight(day);
    const sw = snackOnlyWeight(day);
    if (r < cw) return "combo";
    if (r < cw + sw) return "snack";
    return "drink";
  },

  buildOrder() {
    const day = this.state.day;
    const type = this.pickOrderType();
    const unlockedDrinks = RECIPES.filter((r) => r.unlockDay <= day);
    const unlockedSnacks = SNACKS.filter((s) => s.unlockDay <= day);

    const recipe =
      type !== "snack"
        ? { ...unlockedDrinks[Math.floor(Math.random() * unlockedDrinks.length)] }
        : null;
    const snack =
      type !== "drink"
        ? { ...unlockedSnacks[Math.floor(Math.random() * unlockedSnacks.length)] }
        : null;

    return { type, recipe, snack };
  },

  orderPrice(order) {
    let p = 0;
    if (order.recipe) p += order.recipe.price;
    if (order.snack) p += order.snack.price;
    if (order.type === "combo") p = Math.round(p * 0.95); // tiny combo discount feel
    return p;
  },

  orderLabel(order) {
    if (order.type === "drink") return `${order.recipe.emoji} ${order.recipe.name}`;
    if (order.type === "snack") return `${order.snack.emoji} ${order.snack.name}`;
    return `${order.recipe.emoji}+${order.snack.emoji} Combo`;
  },

  /* ---------- CUSTOMERS ---------- */
  spawnCustomer() {
    const order = this.buildOrder();

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
      phase: "walking_in",
      walkT: 0,
      walkDur,
      lineSlot,
      pos: 0,
      targetPos: this.slotPos(lineSlot),
      mood: "walk",
    };
    this.state.queue.push(customer);
    this.state.customersLeft--;
  },

  slotPos(slot) {
    return Math.max(0.42, 0.78 - slot * 0.09);
  },

  reindexLineSlots() {
    let i = 0;
    this.state.queue.forEach((c) => {
      if (c.phase === "waiting" || c.phase === "walking_in") {
        c.lineSlot = i;
        c.targetPos = this.slotPos(i);
        i++;
      }
    });
  },

  takeOrder(idOrIndex) {
    if (this.state.currentCustomer) return;
    const waiting = this.waitingCustomers();
    if (!waiting.length) return;

    let customer = null;
    if (typeof idOrIndex === "string") {
      customer = waiting.find((c) => c.id === idOrIndex) || null;
      if (customer && waiting[0].id !== customer.id) return;
    } else {
      customer = waiting[0];
    }
    if (!customer) return;

    this.sfxClick();
    this.state.queue = this.state.queue.filter((c) => c.id !== customer.id);
    customer.phase = "serving";
    customer.mood = "order";
    customer.pos = 0.88;
    customer.targetPos = 0.88;
    this.state.currentCustomer = customer;
    this.reindexLineSlots();
    this.renderShop();
  },

  beginDepart(customer, reason) {
    if (!customer) return;
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

  cancelOrder() {
    if (!this.state.currentCustomer) return;
    this.sfxBad();
    const c = this.state.currentCustomer;
    this.state.currentCustomer = null;
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
        // if mid-combo finished drink method, re-render to show snack steps
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

  resolveServe(result) {
    const customer = this.state.currentCustomer;
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

    if (order.type === "snack" || order.type === "combo") {
      if (order.type === "snack") this.dayStats.snacks++;
      if (order.type === "combo") this.dayStats.combos++;
    }

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

    this.state.currentCustomer = null;
    this.brewSession = null;
    this.stateName = "SHOP";
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
      },
      () => {
        UI.closeModal();
        this.renderShop();
        this.save();
        this.checkDayDone();
      }
    );
  },

  checkDayDone() {
    // end-day button appears via UI meta
  },

  /* ---------- DAY END ---------- */
  endDay() {
    this.state.shopOpen = false;
    this.stateName = "DAY_END";
    this.state.flags._tipBoostDay = false;

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
      nextDay: () => this.advanceDay(),
    });
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

    if (this.state.customersLeft > 0) {
      this.state.spawnTimer -= dt;
      if (this.state.spawnTimer <= 0 && this.floorCount() < WALK_CONFIG.maxOnFloor) {
        this.spawnCustomer();
        this.state.spawnTimer = 3.5 + Math.random() * 4.5;
        needFullRender = true;
      }
    }

    this.state.queue.forEach((c) => {
      if (c.phase === "walking_in") {
        c.walkT += dt;
        const t = Math.min(1, c.walkT / c.walkDur);
        const ease = 1 - Math.pow(1 - t, 2);
        c.pos = ease * c.targetPos;
        c.mood = "walk";
        if (t >= 1) {
          c.phase = "waiting";
          c.pos = c.targetPos;
          c.mood = "wait";
          needQueueRefresh = true;
        }
      } else if (c.phase === "waiting") {
        const diff = c.targetPos - c.pos;
        if (Math.abs(diff) > 0.002) {
          c.pos += diff * Math.min(1, dt * 3);
        }
      }
    });

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

    const leftIds = [];
    this.state.queue.forEach((c) => {
      if (c.phase !== "waiting") return;
      c.patience -= dt;
      if (c.patience <= 0) leftIds.push(c.id);
    });
    if (leftIds.length) {
      const leavers = this.state.queue.filter((c) => leftIds.includes(c.id));
      this.state.queue = this.state.queue.filter((c) => !leftIds.includes(c.id));
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
        this.dayStats.left++;
        const stars = 1;
        this.applyStarRep(stars);
        this.recordStars(stars);
        this.beginDepart(c, "left");
        this.sfxBad();
        UI.toast("Khách ở quầy bỏ đi!", "bad");
        needFullRender = true;
      }
    }

    if (needFullRender && !UI.hasModal()) {
      this.renderShop();
      this.save();
    } else {
      UI.syncShopFloor(this.state);
      if (needQueueRefresh && !UI.hasModal()) {
        UI.renderQueue(this.state, {
          takeOrder: (id) => this.takeOrder(id),
        });
        UI.refreshQueuePanelMeta(this.state, {
          endDay: () => this.endDay(),
        });
      } else {
        UI.syncPatienceBars(this.state);
      }
      if (needFullRender) this.save();
    }

    this.checkDayDone();
  },

  tickBrew(dt) {
    if (!this.brewSession || !this.brewSession.methodActive) return;
    const done = Brew.tickMethod(this.brewSession, dt);
    UI.updateMethodBar(this.brewSession);
    if (!done && !this.brewSession.methodActive && !this.brewSession.done) {
      // transition drink→snack in combo
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
