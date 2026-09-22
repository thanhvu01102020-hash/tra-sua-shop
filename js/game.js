/* ===== MAIN GAME STATE MACHINE ===== */
/* States: TITLE | SETUP | STORY | SHOP | BREW | DAY_END | UPGRADE | WIN */

const Game = {
  stateName: "TITLE",
  state: null,
  brewSession: null,
  storyBeat: null,
  storyLine: 0,
  storyPhase: "morning", // morning | evening
  raf: null,
  lastTs: 0,
  muted: false,
  audioCtx: null,
  dayStats: null,

  /* ---------- BOOT ---------- */
  boot() {
    UI.init();
    this.bindMuteGlobal();
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

  /* ---------- AUDIO (tiny Web Audio beeps) ---------- */
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

  /* ---------- SAVE / LOAD ---------- */
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
      upgrades: {},
      flags: {},
      dayRevenue: 0,
      queue: [],
      currentCustomer: null,
      customersLeft: 0,
      spawnTimer: 0,
      shopOpen: false,
    };
  },

  save() {
    if (!this.state) return;
    const data = {
      shopName: this.state.shopName,
      day: this.state.day,
      money: this.state.money,
      rep: this.state.rep,
      inventory: this.state.inventory,
      upgrades: this.state.upgrades,
      flags: this.state.flags,
      muted: this.muted,
      // save between days mostly — if mid-shop, save day progress lightly
      midDay: this.stateName === "SHOP" || this.stateName === "BREW",
      dayRevenue: this.state.dayRevenue,
    };
    try {
      localStorage.setItem(GAME_CONFIG.saveKey, JSON.stringify(data));
    } catch (_) {}
  },

  load() {
    try {
      const raw = localStorage.getItem(GAME_CONFIG.saveKey);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  },

  hasSave() {
    return !!this.load();
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
    this.state = this.freshState(data.shopName);
    Object.assign(this.state, {
      day: data.day,
      money: data.money,
      rep: data.rep,
      inventory: data.inventory,
      upgrades: data.upgrades || {},
      flags: data.flags || {},
    });
    this.muted = !!data.muted;
    // Resume at morning of current day (safe)
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
      this.state.flags._bonusCustomers = (this.state.flags._bonusCustomers || 0) + e.bonusCustomers;
    }
    this.save();
  },

  afterStory() {
    if (this.storyPhase === "morning") {
      this.openShop();
    } else {
      // evening -> upgrade
      this.goUpgrade();
    }
  },

  openShop() {
    this.stateName = "SHOP";
    this.state.dayRevenue = 0;
    this.state.queue = [];
    this.state.currentCustomer = null;
    this.state.shopOpen = true;

    let count = GAME_CONFIG.customersPerDay[this.state.day - 1] || 5;
    if (this.state.upgrades.better_sign) count += 1;
    if (this.state.flags._bonusCustomers) {
      count += this.state.flags._bonusCustomers;
      this.state.flags._bonusCustomers = 0;
    }
    // mai_help lingering tiny bonus day 2+
    if (this.state.flags.mai_help && this.state.day >= 2) count += 0; // already applied via choice once

    this.state.customersLeft = count;
    this.state.spawnTimer = 1.5; // first customer soon

    this.dayStats = {
      served: 0,
      perfect: 0,
      wrong: 0,
      left: 0,
      tips: 0,
      revenue: 0,
      repStart: this.state.rep,
    };

    this.renderShop();
  },

  renderShop() {
    UI.renderShop(this.state, {
      takeOrder: (i) => this.takeOrder(i),
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

  /* ---------- CUSTOMERS ---------- */
  spawnCustomer() {
    const unlocked = RECIPES.filter((r) => r.unlockDay <= this.state.day);
    const recipe = { ...unlocked[Math.floor(Math.random() * unlocked.length)] };

    // inject NPCs on certain slots
    let name = CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)];
    let emoji = CUSTOMER_EMOJIS[Math.floor(Math.random() * CUSTOMER_EMOJIS.length)];
    let isNPC = false;
    let npcRole = "";
    const served = this.dayStats.served + this.state.queue.length + (this.state.currentCustomer ? 1 : 0);

    if (this.state.day === 1 && served === 1) {
      name = NPCS.mai.name;
      emoji = NPCS.mai.emoji;
      isNPC = true;
      npcRole = NPCS.mai.role;
    } else if (this.state.day === 2 && served === 0) {
      name = NPCS.linh.name;
      emoji = NPCS.linh.emoji;
      isNPC = true;
      npcRole = NPCS.linh.role;
      // Linh prefers matcha
      const matcha = RECIPES.find((r) => r.id === "matcha_latte");
      if (matcha) Object.assign(recipe, { ...matcha });
    } else if (this.state.day >= 2 && served === 2) {
      name = NPCS.anh.name;
      emoji = NPCS.anh.emoji;
      isNPC = true;
      npcRole = NPCS.anh.role;
    }

    const maxP = GAME_CONFIG.customerPatienceBase + (this.state.rep - 2.5) * 4;
    const customer = {
      id: "c_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      name,
      emoji,
      isNPC,
      npcRole,
      patience: maxP,
      maxPatience: maxP,
      order: { recipe: { ...recipe } },
    };
    this.state.queue.push(customer);
    this.state.customersLeft--;
  },

  takeOrder(index) {
    if (this.state.currentCustomer) return;
    if (index !== 0) return;
    this.sfxClick();
    this.state.currentCustomer = this.state.queue.shift();
    this.renderShop();
  },

  cancelOrder() {
    if (!this.state.currentCustomer) return;
    this.sfxBad();
    this.state.rep = Math.max(0.5, this.state.rep - 0.3);
    this.dayStats.wrong++;
    this.state.currentCustomer = null;
    UI.toast("Đã huỷ đơn (−uy tín)", "bad");
    this.renderShop();
    this.save();
  },

  /* ---------- BREW ---------- */
  startBrew() {
    if (!this.state.currentCustomer) return;
    this.sfxClick();
    this.stateName = "BREW";
    this.brewSession = Brew.createSession(this.state.currentCustomer.order, this.state.upgrades);
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
        if (!this.brewSession.selections[step] && step !== "method") {
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
    Brew.consumeStock(this.state.inventory, session.selections);
    const result = session.result;
    this.resolveServe(result);
  },

  resolveServe(result) {
    const customer = this.state.currentCustomer;
    const price = customer.order.recipe.price;
    let pay = 0;
    let tip = 0;
    let quality = result.quality;
    let payText = "";

    if (quality === "perfect") {
      pay = price;
      if (Math.random() < GAME_CONFIG.tipChance + (result.fast ? 0.2 : 0) || result.extraToppingBonus) {
        tip = Math.round(price * GAME_CONFIG.tipRate);
      }
      if (result.extraToppingBonus) tip += 3000;
      this.state.rep = Math.min(GAME_CONFIG.maxRep, this.state.rep + 0.15);
      this.dayStats.perfect++;
      this.sfxOk();
      this.sfxCoin();
      payText = `+${UI.money(pay)}${tip ? " + tip " + UI.money(tip) : ""}`;
    } else if (quality === "ok") {
      pay = Math.round(price * 0.7);
      this.state.rep = Math.min(GAME_CONFIG.maxRep, this.state.rep + 0.05);
      this.dayStats.served;
      this.sfxOk();
      payText = `+${UI.money(pay)} (giảm vì gần đúng)`;
    } else {
      pay = 0;
      this.state.rep = Math.max(0.5, this.state.rep - 0.25);
      this.dayStats.wrong++;
      this.sfxBad();
      payText = "Hoàn tiền · −uy tín";
    }

    if (quality !== "wrong") this.dayStats.served++;
    this.state.money += pay + tip;
    this.state.dayRevenue += pay + tip;
    this.dayStats.tips += tip;
    this.dayStats.revenue += pay + tip;

    this.state.currentCustomer = null;
    this.brewSession = null;
    this.stateName = "SHOP";

    UI.renderServeResult({ quality, payText }, () => {
      UI.closeModal();
      this.renderShop();
      this.save();
      this.checkDayDone();
    });
  },

  checkDayDone() {
    if (
      this.state.customersLeft <= 0 &&
      this.state.queue.length === 0 &&
      !this.state.currentCustomer
    ) {
      // auto prompt end — UI already shows button
    }
  },

  /* ---------- DAY END ---------- */
  endDay() {
    this.state.shopOpen = false;
    this.stateName = "DAY_END";
    const goal = GAME_CONFIG.dayGoals[this.state.day - 1] || 150000;
    const repDelta = this.state.rep - this.dayStats.repStart;
    // mild goal bonus
    if (this.state.dayRevenue >= goal) {
      this.state.rep = Math.min(GAME_CONFIG.maxRep, this.state.rep + 0.2);
      this.state.money += 10000;
      UI.toast("Đạt mục tiêu! +10.000đ thưởng", "good");
    }

    this.save();
    UI.renderDayEnd(
      {
        day: this.state.day,
        revenue: this.state.dayRevenue,
        goal,
        served: this.dayStats.served,
        perfect: this.dayStats.perfect,
        wrong: this.dayStats.wrong,
        left: this.dayStats.left,
        tips: this.dayStats.tips,
        rep: this.state.rep,
        repDelta,
        money: this.state.money,
      },
      () => {
        this.sfxClick();
        this.storyPhase = "evening";
        this.storyBeat = Story.getEvening(this.state.day);
        this.storyLine = 0;
        if (this.storyBeat) {
          this.stateName = "STORY";
          this.showStory();
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
    const u = UPGRADES.find((x) => x.id === id);
    if (!u || this.state.upgrades[id]) return;
    if (this.state.money < u.cost) {
      UI.toast("Không đủ tiền", "bad");
      this.sfxBad();
      return;
    }
    this.state.money -= u.cost;
    this.state.upgrades[id] = true;
    this.sfxCoin();
    UI.toast(`Đã mua ${u.name}!`, "good");
    this.save();
    this.renderUpgrade();
  },

  buyStock(id, qty) {
    const ing = INGREDIENTS[id];
    if (!ing) return;
    const disc = this.state.upgrades.restock_discount ? 0.2 : 0;
    const cost = Math.round(ing.cost * (1 - disc) * qty);
    if (this.state.money < cost) {
      UI.toast("Không đủ tiền", "bad");
      this.sfxBad();
      return;
    }
    this.state.money -= cost;
    this.state.inventory[id] = (this.state.inventory[id] || 0) + qty;
    this.sfxClick();
    UI.toast(`+${qty} ${ing.name}`, "good");
    this.save();
    this.renderUpgrade();
  },

  advanceDay() {
    this.sfxClick();
    if (this.state.day >= 3) {
      this.stateName = "WIN";
      this.save();
      UI.renderWin(this.state, () => {
        try {
          localStorage.removeItem(GAME_CONFIG.saveKey);
        } catch (_) {}
        this.goTitle();
      });
      return;
    }
    this.state.day += 1;
    this.save();
    this.startDayMorning();
  },

  /* ---------- LOOP ---------- */
  stopShopLoop() {
    // handled in main loop by state check
  },

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
    // spawn
    if (this.state.customersLeft > 0) {
      this.state.spawnTimer -= dt;
      if (this.state.spawnTimer <= 0 && this.state.queue.length < 4) {
        this.spawnCustomer();
        this.state.spawnTimer = 4 + Math.random() * 5;
        if (this.stateName === "SHOP") this.renderShop();
      }
    }

    // patience
    let dirty = false;
    let leftIds = [];
    this.state.queue.forEach((c) => {
      c.patience -= dt;
      if (c.patience <= 0) leftIds.push(c.id);
    });
    if (leftIds.length) {
      this.state.queue = this.state.queue.filter((c) => {
        if (leftIds.includes(c.id)) {
          this.dayStats.left++;
          this.state.rep = Math.max(0.5, this.state.rep - 0.15);
          dirty = true;
          return false;
        }
        return true;
      });
      if (dirty) {
        this.sfxBad();
        UI.toast("Một khách đã bỏ đi...", "bad");
        this.renderShop();
      }
    } else {
      // update patience bars without full re-render thrash: light update
      const fills = document.querySelectorAll(".queue-list .patience-fill");
      this.state.queue.forEach((c, i) => {
        if (fills[i]) {
          fills[i].style.width = Math.max(0, (c.patience / c.maxPatience) * 100) + "%";
        }
      });
    }

    // current customer also loses patience slowly while waiting at counter
    if (this.state.currentCustomer && this.stateName === "SHOP") {
      this.state.currentCustomer.patience -= dt * 0.5;
      if (this.state.currentCustomer.patience <= 0) {
        this.dayStats.left++;
        this.state.rep = Math.max(0.5, this.state.rep - 0.2);
        this.state.currentCustomer = null;
        this.sfxBad();
        UI.toast("Khách ở quầy bỏ đi!", "bad");
        this.renderShop();
      }
    }
  },

  tickBrew(dt) {
    if (!this.brewSession || !this.brewSession.methodActive) return;
    const done = Brew.tickMethod(this.brewSession, dt);
    UI.updateMethodBar(this.brewSession);
    if (done) this.finishBrew();

    // also drain customer patience during brew
    if (this.state.currentCustomer) {
      this.state.currentCustomer.patience -= dt;
      if (this.state.currentCustomer.patience <= 0) {
        this.brewSession.methodActive = false;
        this.brewSession = null;
        this.dayStats.left++;
        this.state.rep = Math.max(0.5, this.state.rep - 0.2);
        this.state.currentCustomer = null;
        this.stateName = "SHOP";
        this.sfxBad();
        UI.renderServeResult(
          { quality: "left", payText: "Không kịp phục vụ" },
          () => {
            UI.closeModal();
            this.renderShop();
          }
        );
      }
    }
  },
};

document.addEventListener("DOMContentLoaded", () => Game.boot());
