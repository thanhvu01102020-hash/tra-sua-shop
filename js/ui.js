/* ===== UI RENDERING (Vietnamese) ===== */

const UI = {
  root: null,
  toastTimer: null,

  init() {
    this.root = document.getElementById("app");
  },

  clear() {
    this.root.innerHTML = "";
    this.root.className = "app";
  },

  money(n) {
    return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";
  },

  stars(rep) {
    const full = Math.floor(rep);
    const half = rep - full >= 0.5;
    let s = "★".repeat(full);
    if (half) s += "½";
    s += "☆".repeat(Math.max(0, 5 - full - (half ? 1 : 0)));
    return `${s} (${rep.toFixed(1)})`;
  },

  toast(msg, type = "info") {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.body.appendChild(el);
    }
    el.className = `toast toast-${type} show`;
    el.textContent = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  },

  /* ---------- TITLE ---------- */
  renderTitle(onNew, onContinue, hasSave, shopName) {
    this.clear();
    this.root.classList.add("screen-title");
    this.root.innerHTML = `
      <div class="title-card card">
        <div class="title-emoji">🧋</div>
        <h1>Tiệm Trà Sữa</h1>
        <p class="subtitle">Mô phỏng quán indie ấm áp</p>
        <p class="shop-tag">${shopName || GAME_CONFIG.shopNameDefault}</p>
        <div class="title-actions">
          <button class="btn btn-primary" id="btn-new">☕ Ván mới</button>
          <button class="btn btn-secondary" id="btn-continue" ${hasSave ? "" : "disabled"}>💾 Tiếp tục</button>
        </div>
        <p class="hint">Ngày 1–3 · Pha chế · Quản lý · Câu chuyện nhẹ</p>
        <button class="btn btn-ghost btn-mute" id="btn-mute" title="Âm thanh">🔊</button>
      </div>
    `;
    document.getElementById("btn-new").onclick = onNew;
    document.getElementById("btn-continue").onclick = onContinue;
  },

  /* ---------- NEW GAME NAME ---------- */
  renderNameSetup(onStart, onBack) {
    this.clear();
    this.root.classList.add("screen-setup");
    this.root.innerHTML = `
      <div class="card setup-card">
        <h2>Đặt tên tiệm</h2>
        <p>Bạn là chủ quán trà sữa nhỏ trong khu phố.</p>
        <label class="field">
          <span>Tên tiệm</span>
          <input type="text" id="shop-name" maxlength="28" value="${GAME_CONFIG.shopNameDefault}" />
        </label>
        <div class="row-actions">
          <button class="btn btn-ghost" id="btn-back">← Quay lại</button>
          <button class="btn btn-primary" id="btn-start">Bắt đầu ngày 1 →</button>
        </div>
      </div>
    `;
    document.getElementById("btn-back").onclick = onBack;
    document.getElementById("btn-start").onclick = () => {
      const name = document.getElementById("shop-name").value.trim() || GAME_CONFIG.shopNameDefault;
      onStart(name);
    };
  },

  /* ---------- STORY ---------- */
  renderStory(beat, lineIndex, onNext, onChoice) {
    this.clear();
    this.root.classList.add("screen-story");
    const line = beat.lines[lineIndex];
    const isLast = lineIndex >= beat.lines.length - 1;
    const showChoice = isLast && beat.choice;

    this.root.innerHTML = `
      <div class="card story-card">
        <div class="story-day">${beat.title}</div>
        <div class="dialogue">
          <div class="speaker">${Story.speakerLabel(line.speaker)}</div>
          <div class="line">${line.text}</div>
        </div>
        <div class="story-actions" id="story-actions"></div>
      </div>
    `;
    const actions = document.getElementById("story-actions");
    if (showChoice) {
      actions.innerHTML = `<p class="choice-prompt">${beat.choice.prompt}</p>`;
      beat.choice.options.forEach((opt) => {
        const b = document.createElement("button");
        b.className = "btn btn-secondary choice-btn";
        b.textContent = opt.label;
        b.onclick = () => onChoice(opt);
        actions.appendChild(b);
      });
    } else {
      const b = document.createElement("button");
      b.className = "btn btn-primary";
      b.textContent = isLast ? "Mở quán →" : "Tiếp →";
      b.onclick = onNext;
      actions.appendChild(b);
    }
  },

  /* ---------- SHOP HUD ---------- */
  renderShop(state, handlers) {
    this.clear();
    this.root.classList.add("screen-shop");
    const goal = GAME_CONFIG.dayGoals[state.day - 1] || 150000;
    const progress = Math.min(100, (state.dayRevenue / goal) * 100);
    const waiting = (state.queue || []).filter((c) => c.phase === "waiting");
    const walking = (state.queue || []).filter((c) => c.phase === "walking_in");
    const floorEmpty =
      waiting.length === 0 &&
      walking.length === 0 &&
      !(state.departing || []).length &&
      !state.currentCustomer &&
      state.customersLeft === 0;

    this.root.innerHTML = `
      <header class="hud">
        <div class="hud-left">
          <strong class="shop-name">${state.shopName}</strong>
          <span class="badge">Ngày ${state.day}/3</span>
        </div>
        <div class="hud-mid">
          <span title="Tiền">💰 ${this.money(state.money)}</span>
          <span title="Uy tín">⭐ ${this.stars(state.rep)}</span>
          <span title="Doanh thu ngày">📈 ${this.money(state.dayRevenue)} / ${this.money(goal)}</span>
        </div>
        <div class="hud-right">
          <button class="btn btn-ghost btn-sm" id="btn-recipes">📖 Công thức</button>
          <button class="btn btn-ghost btn-sm" id="btn-inv">📦 Kho</button>
          <button class="btn btn-ghost btn-sm" id="btn-mute-shop">🔊</button>
        </div>
      </header>
      <div class="goal-bar"><div class="goal-fill" style="width:${progress}%"></div></div>

      <section class="panel shop-floor-panel">
        <div class="floor-header">
          <h3>Không gian quán</h3>
          <span class="muted small">Cửa → quầy · khách phải tới quầy mới nhận đơn</span>
        </div>
        <div class="shop-floor" id="shop-floor" aria-label="Sàn quán nhìn nghiêng">
          <div class="floor-bg">
            <div class="floor-door" title="Cửa vào">
              <span class="door-emoji">🚪</span>
              <span class="door-label">Cửa</span>
            </div>
            <div class="floor-path"></div>
            <div class="floor-counter" title="Quầy bar">
              <div class="bar-top">🧋</div>
              <div class="bar-body"></div>
              <span class="bar-label">Quầy</span>
            </div>
            <div class="floor-decor floor-plant">🪴</div>
            <div class="floor-decor floor-lamp">🪟</div>
          </div>
          <div class="floor-actors" id="floor-actors"></div>
        </div>
      </section>

      <div class="shop-layout">
        <section class="panel queue-panel">
          <h3>Hàng chờ <span class="muted" id="queue-count">(${waiting.length})</span></h3>
          <div id="queue-list" class="queue-list"></div>
          <div id="queue-meta"></div>
        </section>
        <section class="panel counter-panel">
          <h3>Quầy phục vụ</h3>
          <div id="counter-area"></div>
        </section>
        <section class="panel order-panel">
          <h3>Đơn hiện tại</h3>
          <div id="order-area"></div>
        </section>
      </div>
      <div id="modal-root"></div>
    `;

    document.getElementById("btn-recipes").onclick = handlers.openRecipes;
    document.getElementById("btn-inv").onclick = handlers.openInventory;
    const muteBtn = document.getElementById("btn-mute-shop");
    if (muteBtn) muteBtn.onclick = handlers.toggleMute;

    this.renderShopFloor(state);
    this.renderQueue(state, handlers);
    this.refreshQueuePanelMeta(state, handlers);
    this.renderCounter(state, handlers);
    this.renderOrder(state);
  },

  allFloorActors(state) {
    const list = [];
    (state.queue || []).forEach((c) => list.push(c));
    if (state.currentCustomer) list.push(state.currentCustomer);
    (state.departing || []).forEach((c) => list.push(c));
    return list;
  },

  actorLeftPct(c) {
    // map 0..1 pos to ~8%..82% of floor width
    const p = Math.max(0, Math.min(1, c.pos != null ? c.pos : 0));
    return 8 + p * 74;
  },

  renderShopFloor(state) {
    const box = document.getElementById("floor-actors");
    if (!box) return;
    box.innerHTML = "";
    this.allFloorActors(state).forEach((c) => {
      box.appendChild(this.makeFloorSprite(c));
    });
  },

  makeFloorSprite(c) {
    const el = document.createElement("div");
    el.className = "floor-sprite phase-" + (c.phase || "waiting") + " mood-" + (c.mood || "wait");
    el.dataset.id = c.id;
    el.style.left = this.actorLeftPct(c) + "%";
    const pct = Math.max(0, (c.patience / c.maxPatience) * 100);
    const showPatience = c.phase === "waiting" || c.phase === "serving";
    const status =
      c.phase === "walking_in"
        ? "đang tới…"
        : c.phase === "walking_out"
        ? c.mood === "angry"
          ? "rời quán 💢"
          : "tạm biệt 👋"
        : c.phase === "serving"
        ? "đặt món"
        : "chờ";
    el.innerHTML = `
      ${
        showPatience
          ? `<div class="sprite-patience"><div class="patience-fill" style="width:${pct}%"></div></div>`
          : `<div class="sprite-status">${status}</div>`
      }
      <div class="sprite-emoji">${c.emoji}</div>
      <div class="sprite-name">${c.name}</div>
      ${c.phase === "walking_in" ? `<div class="sprite-walk-dots">🚶</div>` : ""}
    `;
    return el;
  },

  syncShopFloor(state) {
    const box = document.getElementById("floor-actors");
    if (!box) return;
    const actors = this.allFloorActors(state);
    const ids = new Set(actors.map((c) => c.id));

    // remove gone
    [...box.querySelectorAll(".floor-sprite")].forEach((el) => {
      if (!ids.has(el.dataset.id)) el.remove();
    });

    actors.forEach((c) => {
      let el = box.querySelector(`.floor-sprite[data-id="${c.id}"]`);
      if (!el) {
        el = this.makeFloorSprite(c);
        box.appendChild(el);
      } else {
        el.style.left = this.actorLeftPct(c) + "%";
        el.className = "floor-sprite phase-" + (c.phase || "waiting") + " mood-" + (c.mood || "wait");
        const showPatience = c.phase === "waiting" || c.phase === "serving";
        const fill = el.querySelector(".patience-fill");
        if (showPatience) {
          if (!el.querySelector(".sprite-patience")) {
            const bar = document.createElement("div");
            bar.className = "sprite-patience";
            bar.innerHTML = `<div class="patience-fill" style="width:${Math.max(0, (c.patience / c.maxPatience) * 100)}%"></div>`;
            const status = el.querySelector(".sprite-status");
            if (status) status.replaceWith(bar);
            else el.prepend(bar);
          } else if (fill) {
            fill.style.width = Math.max(0, (c.patience / c.maxPatience) * 100) + "%";
          }
          const dots = el.querySelector(".sprite-walk-dots");
          if (dots) dots.remove();
        } else {
          const statusText =
            c.phase === "walking_in"
              ? "đang tới…"
              : c.mood === "angry"
              ? "rời quán 💢"
              : "tạm biệt 👋";
          let st = el.querySelector(".sprite-status");
          if (!st) {
            const bar = el.querySelector(".sprite-patience");
            st = document.createElement("div");
            st.className = "sprite-status";
            if (bar) bar.replaceWith(st);
            else el.prepend(st);
          }
          st.textContent = statusText;
        }
      }
    });
  },

  syncPatienceBars(state) {
    const waiting = (state.queue || []).filter((c) => c.phase === "waiting");
    const fills = document.querySelectorAll(".queue-list .patience-fill");
    waiting.forEach((c, i) => {
      if (fills[i]) {
        fills[i].style.width = Math.max(0, (c.patience / c.maxPatience) * 100) + "%";
      }
    });
    // floor patience
    waiting.forEach((c) => {
      const el = document.querySelector(`.floor-sprite[data-id="${c.id}"] .patience-fill`);
      if (el) el.style.width = Math.max(0, (c.patience / c.maxPatience) * 100) + "%";
    });
    if (state.currentCustomer) {
      const el = document.querySelector(
        `.floor-sprite[data-id="${state.currentCustomer.id}"] .patience-fill`
      );
      if (el) {
        el.style.width =
          Math.max(0, (state.currentCustomer.patience / state.currentCustomer.maxPatience) * 100) +
          "%";
      }
    }
  },

  refreshQueuePanelMeta(state, handlers) {
    const meta = document.getElementById("queue-meta");
    const count = document.getElementById("queue-count");
    if (count) {
      const waiting = (state.queue || []).filter((c) => c.phase === "waiting").length;
      count.textContent = `(${waiting})`;
    }
    if (!meta) return;
    const waiting = (state.queue || []).filter((c) => c.phase === "waiting");
    const walking = (state.queue || []).filter((c) => c.phase === "walking_in");
    const done =
      waiting.length === 0 &&
      walking.length === 0 &&
      !(state.departing || []).length &&
      !state.currentCustomer &&
      state.customersLeft === 0;

    if (done) {
      meta.innerHTML = `<p class="muted center">Hết khách hôm nay.</p>
        <button class="btn btn-primary" id="btn-end-day">Kết thúc ngày →</button>`;
      const endBtn = document.getElementById("btn-end-day");
      if (endBtn && handlers.endDay) endBtn.onclick = handlers.endDay;
    } else if (waiting.length === 0) {
      meta.innerHTML = `<p class="muted center">${
        walking.length ? "Khách đang đi vào quán…" : "Đang chờ khách..."
      }</p>`;
    } else {
      meta.innerHTML = "";
    }
  },

  renderQueue(state, handlers) {
    const list = document.getElementById("queue-list");
    if (!list) return;
    list.innerHTML = "";
    const waiting = (state.queue || []).filter((c) => c.phase === "waiting");
    waiting.forEach((c, i) => {
      const pct = Math.max(0, (c.patience / c.maxPatience) * 100);
      const div = document.createElement("div");
      div.className = "customer-card" + (i === 0 ? " first" : "");
      div.dataset.id = c.id;
      div.innerHTML = `
        <div class="cust-emoji">${c.emoji}</div>
        <div class="cust-info">
          <div class="cust-name">${c.name}${c.isNPC ? " · " + c.npcRole : ""}</div>
          <div class="patience"><div class="patience-fill" style="width:${pct}%"></div></div>
        </div>
        ${
          i === 0 && !state.currentCustomer
            ? `<button class="btn btn-sm btn-primary take-btn">Nhận</button>`
            : i === 0
            ? `<span class="muted small">Đang phục vụ</span>`
            : `<span class="muted small">chờ</span>`
        }
      `;
      const btn = div.querySelector(".take-btn");
      if (btn) btn.onclick = () => handlers.takeOrder(c.id);
      list.appendChild(div);
    });

    // also show walking_in as non-orderable previews
    (state.queue || [])
      .filter((c) => c.phase === "walking_in")
      .forEach((c) => {
        const div = document.createElement("div");
        div.className = "customer-card walking";
        div.innerHTML = `
          <div class="cust-emoji">${c.emoji}</div>
          <div class="cust-info">
            <div class="cust-name">${c.name}</div>
            <div class="muted small">🚶 Đang đi vào…</div>
          </div>
        `;
        list.appendChild(div);
      });
  },

  renderCounter(state, handlers) {
    const area = document.getElementById("counter-area");
    if (!area) return;
    if (!state.currentCustomer) {
      area.innerHTML = `<div class="empty-counter">🧋<p>Chọn khách đã tới quầy để nhận đơn</p></div>`;
      return;
    }
    const c = state.currentCustomer;
    const r = c.order.recipe;
    area.innerHTML = `
      <div class="serving">
        <div class="serving-face">${c.emoji}</div>
        <div>
          <strong>${c.name}</strong> muốn
          <div class="wanted">${r.emoji} <b>${r.name}</b></div>
          <p class="muted small">${this.sugarIceLabel(r)} · ${r.method === "shake" ? "Lắc" : "Xay"}</p>
        </div>
      </div>
      <div class="counter-actions">
        <button class="btn btn-primary" id="btn-brew">🧪 Pha chế</button>
        <button class="btn btn-ghost" id="btn-cancel-order">Huỷ (mất uy tín)</button>
      </div>
    `;
    document.getElementById("btn-brew").onclick = handlers.startBrew;
    document.getElementById("btn-cancel-order").onclick = handlers.cancelOrder;
  },

  sugarIceLabel(r) {
    const s = SUGAR_LEVELS.find((x) => x.id === r.sugar)?.name || r.sugar;
    const i = ICE_LEVELS.find((x) => x.id === r.ice)?.name || r.ice;
    return `${s}, ${i}`;
  },

  renderOrder(state) {
    const area = document.getElementById("order-area");
    if (!area) return;
    if (!state.currentCustomer) {
      area.innerHTML = `<p class="muted">Chưa có đơn.</p>`;
      return;
    }
    const r = state.currentCustomer.order.recipe;
    const base = BASES.find((b) => b.id === r.base);
    const milk = MILKS.find((m) => m.id === r.milk);
    const top = TOPPINGS.find((t) => t.id === r.topping);
    area.innerHTML = `
      <div class="order-ticket">
        <div class="ticket-title">${r.emoji} ${r.name}</div>
        <ul class="ticket-list">
          <li>${base?.emoji || ""} Base: <b>${base?.name}</b></li>
          <li>${milk?.emoji || ""} Sữa: <b>${milk?.name}</b></li>
          <li>${top?.emoji || ""} Topping: <b>${top?.name}</b></li>
          <li>🍬 ${this.sugarIceLabel(r)}</li>
          <li>🔄 ${r.method === "shake" ? "Lắc tay" : "Xay blend"}</li>
          <li class="price">💵 ${this.money(r.price)}</li>
        </ul>
        <p class="hint small">Mở 📖 Công thức nếu quên!</p>
      </div>
    `;
  },

  /* ---------- BREW SCREEN ---------- */
  renderBrew(state, session, handlers) {
    this.clear();
    this.root.classList.add("screen-brew");
    const step = Brew.currentStep(session);
    const r = session.order.recipe;
    const elapsed = ((Date.now() - session.startTime) / 1000).toFixed(0);

    this.root.innerHTML = `
      <header class="hud brew-hud">
        <div><strong>Pha: ${r.emoji} ${r.name}</strong> cho ${state.currentCustomer.name}</div>
        <div>⏱ ${elapsed}s · Bước ${session.stepIndex + 1}/${Brew.steps.length}</div>
        <button class="btn btn-ghost btn-sm" id="btn-brew-book">📖</button>
      </header>
      <div class="brew-layout">
        <div class="card brew-steps">
          <div class="step-tabs" id="step-tabs"></div>
          <h3>${Brew.stepLabels[step]}</h3>
          <div id="brew-options" class="brew-options"></div>
          <div class="brew-nav">
            <button class="btn btn-ghost" id="btn-brew-back" ${session.stepIndex === 0 || session.methodActive ? "disabled" : ""}>← Lùi</button>
            <button class="btn btn-secondary" id="btn-brew-next" ${step === "method" ? "disabled" : ""}>Tiếp →</button>
          </div>
        </div>
        <div class="card brew-summary">
          <h3>Đã chọn</h3>
          <ul id="sel-summary" class="ticket-list"></ul>
          <div id="method-zone"></div>
        </div>
      </div>
      <div id="modal-root"></div>
    `;

    document.getElementById("btn-brew-book").onclick = handlers.openRecipes;
    document.getElementById("btn-brew-back").onclick = handlers.brewBack;
    document.getElementById("btn-brew-next").onclick = handlers.brewNext;

    // tabs
    const tabs = document.getElementById("step-tabs");
    Brew.steps.forEach((st, i) => {
      const t = document.createElement("span");
      t.className = "step-tab" + (i === session.stepIndex ? " active" : "") + (i < session.stepIndex ? " done" : "");
      t.textContent = i + 1;
      tabs.appendChild(t);
    });

    this.renderBrewOptions(state, session, step, handlers);
    this.renderBrewSummary(session);
    this.renderMethodZone(session, handlers);
  },

  renderBrewOptions(state, session, step, handlers) {
    const box = document.getElementById("brew-options");
    if (!box) return;
    box.innerHTML = "";

    if (step === "method") {
      box.innerHTML = `
        <p>Công thức cần: <b>${session.order.recipe.method === "shake" ? "Lắc tay 🥤" : "Xay blend 🌀"}</b></p>
        <button class="btn btn-primary btn-lg" id="btn-start-method">
          Bắt đầu ${session.order.recipe.method === "shake" ? "lắc" : "xay"}!
        </button>
        <p class="hint">Bấm liên tục hoặc giữ nhịp để đầy thanh.</p>
      `;
      document.getElementById("btn-start-method").onclick = handlers.startMethod;
      return;
    }

    let options = [];
    if (step === "base") options = BASES;
    if (step === "milk") options = MILKS;
    if (step === "topping") options = TOPPINGS;
    if (step === "sugar") options = SUGAR_LEVELS.map((s) => ({ ...s, emoji: "🍬" }));
    if (step === "ice") options = ICE_LEVELS.map((s) => ({ ...s, emoji: "🧊" }));

    options.forEach((opt) => {
      const can = step === "sugar" || step === "ice" || Brew.canAffordSelection(state.inventory, opt);
      const selected = session.selections[step] === opt.id;
      const btn = document.createElement("button");
      btn.className = "opt-btn" + (selected ? " selected" : "") + (!can ? " disabled" : "");
      btn.disabled = !can;
      const stock =
        opt.ingredient != null
          ? ` · còn ${state.inventory[opt.ingredient] || 0}`
          : "";
      btn.innerHTML = `<span class="opt-emoji">${opt.emoji || ""}</span><span>${opt.name}</span><span class="muted small">${stock}</span>`;
      btn.onclick = () => handlers.selectBrew(step, opt.id);
      box.appendChild(btn);
    });

    // extra topping upgrade
    if (step === "topping" && session.hasExtraTopping) {
      const wrap = document.createElement("div");
      wrap.className = "extra-top";
      wrap.innerHTML = `<p class="muted">Topping thêm (thưởng nhỏ):</p>`;
      TOPPINGS.filter((t) => t.id !== "none").forEach((opt) => {
        const can = Brew.canAffordSelection(state.inventory, opt);
        const btn = document.createElement("button");
        btn.className = "opt-btn sm" + (session.selections.extraTopping === opt.id ? " selected" : "");
        btn.disabled = !can;
        btn.textContent = `${opt.emoji} ${opt.name}`;
        btn.onclick = () => handlers.selectBrew("extraTopping", opt.id);
        wrap.appendChild(btn);
      });
      box.appendChild(wrap);
    }
  },

  renderBrewSummary(session) {
    const ul = document.getElementById("sel-summary");
    if (!ul) return;
    const s = session.selections;
    const base = BASES.find((b) => b.id === s.base);
    const milk = MILKS.find((m) => m.id === s.milk);
    const top = TOPPINGS.find((t) => t.id === s.topping);
    const sugar = SUGAR_LEVELS.find((x) => x.id === s.sugar);
    const ice = ICE_LEVELS.find((x) => x.id === s.ice);
    ul.innerHTML = `
      <li>Base: ${base ? base.emoji + " " + base.name : "—"}</li>
      <li>Sữa: ${milk ? milk.emoji + " " + milk.name : "—"}</li>
      <li>Topping: ${top ? top.emoji + " " + top.name : "—"}</li>
      <li>Đường: ${sugar ? sugar.name : "—"}</li>
      <li>Đá: ${ice ? ice.name : "—"}</li>
      <li>Cách: ${s.method ? (s.method === "shake" ? "Lắc" : "Xay") : "—"}</li>
    `;
  },

  renderMethodZone(session, handlers) {
    const zone = document.getElementById("method-zone");
    if (!zone) return;
    if (!session.methodActive && session.methodProgress < 100) {
      zone.innerHTML = "";
      return;
    }
    zone.innerHTML = `
      <div class="method-bar-wrap">
        <div class="method-label">${session.order.recipe.method === "shake" ? "Đang lắc..." : "Đang xay..."}</div>
        <div class="method-bar"><div class="method-fill" id="method-fill" style="width:${session.methodProgress}%"></div></div>
        <button class="btn btn-primary btn-lg" id="btn-shake-click">🥤 Bấm!</button>
      </div>
    `;
    const btn = document.getElementById("btn-shake-click");
    if (btn) btn.onclick = handlers.shakeClick;
  },

  updateMethodBar(session) {
    const fill = document.getElementById("method-fill");
    if (fill) fill.style.width = session.methodProgress + "%";
  },

  /* ---------- MODALS ---------- */
  modal(html) {
    // Prefer body-level overlay so SHOP re-renders (walk animations) don't wipe it
    let root = document.getElementById("modal-root-global");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root-global";
      document.body.appendChild(root);
    }
    root.innerHTML = `<div class="modal-backdrop"><div class="modal card">${html}</div></div>`;
    // also clear in-app modal hole if present
    const local = document.getElementById("modal-root");
    if (local) local.innerHTML = "";
    return root;
  },

  closeModal() {
    const root = document.getElementById("modal-root-global");
    if (root) root.innerHTML = "";
    const local = document.getElementById("modal-root");
    if (local) local.innerHTML = "";
  },

  hasModal() {
    const root = document.getElementById("modal-root-global");
    return !!(root && root.innerHTML.trim());
  },

  renderRecipesModal(state, onClose) {
    const unlocked = RECIPES.filter((r) => r.unlockDay <= state.day);
    const items = unlocked
      .map((r) => {
        const base = BASES.find((b) => b.id === r.base)?.name;
        const milk = MILKS.find((m) => m.id === r.milk)?.name;
        const top = TOPPINGS.find((t) => t.id === r.topping)?.name;
        return `<div class="recipe-row">
          <div class="recipe-title">${r.emoji} <b>${r.name}</b> · ${this.money(r.price)}</div>
          <div class="muted small">${base} + ${milk} + ${top} · ${this.sugarIceLabel(r)} · ${r.method === "shake" ? "Lắc" : "Xay"}</div>
          <div class="muted small">${r.desc}</div>
        </div>`;
      })
      .join("");
    this.modal(`
      <h2>📖 Sổ công thức</h2>
      <div class="recipe-list">${items}</div>
      <button class="btn btn-primary" id="modal-close">Đóng</button>
    `);
    document.getElementById("modal-close").onclick = onClose;
  },

  renderInventoryModal(state, onClose) {
    const rows = Object.values(INGREDIENTS)
      .map((ing) => {
        const qty = state.inventory[ing.id] || 0;
        const low = qty <= 2 ? " low" : "";
        return `<div class="inv-row${low}"><span>${ing.emoji} ${ing.name}</span><span>${qty}</span></div>`;
      })
      .join("");
    this.modal(`
      <h2>📦 Kho nguyên liệu</h2>
      <div class="inv-list">${rows}</div>
      <p class="hint">Nhập hàng sau khi hết ngày.</p>
      <button class="btn btn-primary" id="modal-close">Đóng</button>
    `);
    document.getElementById("modal-close").onclick = onClose;
  },

  /* ---------- DAY END ---------- */
  renderDayEnd(summary, onContinue) {
    this.clear();
    this.root.classList.add("screen-dayend");
    const goalMet = summary.revenue >= summary.goal;
    this.root.innerHTML = `
      <div class="card dayend-card">
        <h2>📅 Kết thúc Ngày ${summary.day}</h2>
        <ul class="summary-list">
          <li>Doanh thu: <b>${this.money(summary.revenue)}</b> / mục tiêu ${this.money(summary.goal)}
            ${goalMet ? "✅" : "❌"}</li>
          <li>Khách phục vụ: <b>${summary.served}</b></li>
          <li>Hoàn hảo: <b>${summary.perfect}</b> · Sai: <b>${summary.wrong}</b> · Bỏ đi: <b>${summary.left}</b></li>
          <li>Tip nhận: <b>${this.money(summary.tips)}</b></li>
          <li>Uy tín: <b>${this.stars(summary.rep)}</b> (${summary.repDelta >= 0 ? "+" : ""}${summary.repDelta.toFixed(1)})</li>
          <li>Đánh giá TB: <b>${summary.starCount ? ("★".repeat(Math.round(summary.avgStars)) + "☆".repeat(Math.max(0, 5 - Math.round(summary.avgStars))) + " " + summary.avgStars.toFixed(1) + "/5") : "—"}</b>
            ${summary.starCount ? `(${summary.starCount} lượt)` : ""}</li>
          <li>Tiền hiện có: <b>${this.money(summary.money)}</b></li>
        </ul>
        <p class="flavor">${goalMet ? "Một ngày tốt đẹp! Quán đang lớn dần." : "Chưa đạt mục tiêu — ngày mai cố thêm nhé!"}</p>
        <button class="btn btn-primary" id="btn-to-story">Tiếp →</button>
      </div>
    `;
    document.getElementById("btn-to-story").onclick = onContinue;
  },

  /* ---------- UPGRADE + STOCK ---------- */
  renderUpgrade(state, handlers) {
    this.clear();
    this.root.classList.add("screen-upgrade");
    const disc = state.upgrades.restock_discount ? 0.2 : 0;

    const upRows = UPGRADES.map((u) => {
      const owned = !!state.upgrades[u.id];
      return `<div class="upgrade-row">
        <div>
          <div>${u.emoji} <b>${u.name}</b> ${owned ? "✅" : "· " + this.money(u.cost)}</div>
          <div class="muted small">${u.desc}</div>
        </div>
        <button class="btn btn-sm ${owned ? "btn-ghost" : "btn-secondary"}" data-up="${u.id}" ${owned || state.money < u.cost ? "disabled" : ""}>
          ${owned ? "Đã có" : "Mua"}
        </button>
      </div>`;
    }).join("");

    const stockRows = Object.values(INGREDIENTS)
      .map((ing) => {
        const price = Math.round(ing.cost * (1 - disc));
        const qty = state.inventory[ing.id] || 0;
        return `<div class="stock-row">
          <span>${ing.emoji} ${ing.name} <span class="muted">(còn ${qty})</span></span>
          <span class="stock-buy">
            <button class="btn btn-sm btn-ghost" data-buy="${ing.id}" data-qty="1">+1 · ${this.money(price)}</button>
            <button class="btn btn-sm btn-secondary" data-buy="${ing.id}" data-qty="5">+5 · ${this.money(price * 5)}</button>
          </span>
        </div>`;
      })
      .join("");

    this.root.innerHTML = `
      <div class="upgrade-layout">
        <div class="card">
          <h2>⬆️ Nâng cấp</h2>
          <p class="muted">Tiền: <b>${this.money(state.money)}</b>${disc ? " · Giảm giá kho 20%" : ""}</p>
          <div class="upgrade-list">${upRows}</div>
        </div>
        <div class="card">
          <h2>🛒 Nhập hàng</h2>
          <div class="stock-list">${stockRows}</div>
        </div>
      </div>
      <div class="center pad">
        <button class="btn btn-primary btn-lg" id="btn-next-day">
          ${state.day >= 3 ? "Xem kết thúc →" : `Sang Ngày ${state.day + 1} →`}
        </button>
      </div>
    `;

    this.root.querySelectorAll("[data-up]").forEach((btn) => {
      btn.onclick = () => handlers.buyUpgrade(btn.getAttribute("data-up"));
    });
    this.root.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.onclick = () =>
        handlers.buyStock(btn.getAttribute("data-buy"), parseInt(btn.getAttribute("data-qty"), 10));
    });
    document.getElementById("btn-next-day").onclick = handlers.nextDay;
  },

  /* ---------- WIN ---------- */
  renderWin(state, onTitle) {
    this.clear();
    this.root.classList.add("screen-win");
    this.root.innerHTML = `
      <div class="card win-card">
        <div class="title-emoji">🎉🧋</div>
        <h1>Ba ngày đầu thành công!</h1>
        <p><b>${state.shopName}</b> đã đứng vững trong khu phố.</p>
        <ul class="summary-list">
          <li>Tiền cuối: <b>${this.money(state.money)}</b></li>
          <li>Uy tín: <b>${this.stars(state.rep)}</b></li>
          <li>Nâng cấp: <b>${Object.keys(state.upgrades).filter((k) => state.upgrades[k]).length}/${UPGRADES.length}</b></li>
        </ul>
        <p class="flavor">MVP đến đây — cảm ơn bạn đã chơi!</p>
        <button class="btn btn-primary" id="btn-title">Về màn hình chính</button>
      </div>
    `;
    document.getElementById("btn-title").onclick = onTitle;
  },

  /* ---------- SERVE RESULT FLASH ---------- */
  renderServeResult(result, onDone) {
    const map = {
      perfect: { title: "Hoàn hảo! ✨", cls: "good", msg: "Khách cười toe toét." },
      ok: { title: "Gần đúng 🙂", cls: "ok", msg: "Khách chấp nhận, ít tip hơn." },
      wrong: { title: "Sai công thức 😅", cls: "bad", msg: "Phải hoàn / mất uy tín." },
      left: { title: "Khách bỏ đi...", cls: "bad", msg: "Hết kiên nhẫn." },
    };
    const m = map[result.quality] || map.ok;
    const stars = result.stars || 0;
    const starDisplay =
      result.starDisplay ||
      (stars ? "★".repeat(stars) + "☆".repeat(Math.max(0, 5 - stars)) : "");
    const repDelta = result.repDelta != null ? result.repDelta : 0;
    const repTxt =
      (repDelta >= 0 ? "+" : "") + repDelta.toFixed(2) + " uy tín";
    this.modal(`
      <h2 class="${m.cls}">${m.title}</h2>
      <p>${m.msg}</p>
      ${
        stars
          ? `<div class="rating-block">
              <div class="rating-stars">${starDisplay}</div>
              <p class="rating-line">Khách đánh giá: <b>${starDisplay}</b> (${stars}/5)</p>
              <p class="flavor">“${result.flavor || ""}”</p>
              <p class="muted small">Uy tín: ${repTxt}</p>
            </div>`
          : ""
      }
      <p>${result.payText || ""}</p>
      <button class="btn btn-primary" id="modal-close">OK</button>
    `);
    document.getElementById("modal-close").onclick = onDone;
  },
};
