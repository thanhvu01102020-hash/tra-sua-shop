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

  orderTypeBadge(type) {
    if (type === "combo") return `<span class="badge badge-combo">Combo</span>`;
    if (type === "snack") return `<span class="badge badge-snack">Ăn nhẹ</span>`;
    return `<span class="badge badge-drink">Trà</span>`;
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
        <p class="hint">30 ngày · Trà & món ăn nhẹ · Nâng cấp thiết bị · Câu chuyện nhẹ</p>
        <button class="btn btn-ghost btn-mute" id="btn-mute" title="Âm thanh">🔊</button>
      </div>
    `;
    document.getElementById("btn-new").onclick = onNew;
    document.getElementById("btn-continue").onclick = onContinue;
  },

  renderNameSetup(onStart, onBack) {
    this.clear();
    this.root.classList.add("screen-setup");
    this.root.innerHTML = `
      <div class="card setup-card">
        <h2>Đặt tên tiệm</h2>
        <p>Bạn là chủ quán trà sữa nhỏ trong khu phố. Hành trình dài <b>30 ngày</b>.</p>
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
  renderStory(beat, lineIndex, phase, onNext, onChoice) {
    this.clear();
    this.root.classList.add("screen-story");
    const line = beat.lines[lineIndex];
    const isLast = lineIndex >= beat.lines.length - 1;
    const showChoice = isLast && beat.choice;
    const isDay30Evening =
      phase === "evening" && beat.id && String(beat.id).indexOf("day30") === 0;
    const nextLabel =
      phase === "evening"
        ? isDay30Evening
          ? "Xem kết thúc →"
          : "Nâng cấp / nhập hàng →"
        : "Mở quán →";

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
      b.textContent = isLast ? nextLabel : "Tiếp →";
      b.onclick = onNext;
      actions.appendChild(b);
    }
  },

  /* ---------- SHOP HUD ---------- */
  renderShop(state, handlers) {
    this.clear();
    this.root.classList.add("screen-shop");
    const goal = dayGoal(state.day);
    const progress = Math.min(100, (state.dayRevenue / goal) * 100);

    this.root.innerHTML = `
      <header class="hud">
        <div class="hud-left">
          <strong class="shop-name">${state.shopName}</strong>
          <span class="badge">Ngày ${state.day}/${GAME_CONFIG.totalDays}</span>
        </div>
        <div class="hud-mid">
          <span title="Tiền">💰 ${this.money(state.money)}</span>
          <span title="Uy tín">⭐ ${this.stars(state.rep)}</span>
          <span title="Doanh thu ngày">📈 ${this.money(state.dayRevenue)} / ${this.money(goal)}</span>
        </div>
        <div class="hud-right">
          <button class="btn btn-ghost btn-sm" id="btn-recipes">📖 Menu</button>
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
          <h3>Hàng chờ <span class="muted" id="queue-count">(0)</span></h3>
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
      const typeHint =
        c.order.type === "combo" ? "🧋+🍪" : c.order.type === "snack" ? "🍪" : "🧋";
      div.innerHTML = `
        <div class="cust-emoji">${c.emoji}</div>
        <div class="cust-info">
          <div class="cust-name">${c.name}${c.isNPC ? " · " + c.npcRole : ""} ${typeHint}</div>
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
    const o = c.order;
    let wanted = "";
    let detail = "";
    if (o.type === "drink") {
      wanted = `${o.recipe.emoji} <b>${o.recipe.name}</b>`;
      detail = `${this.sugarIceLabel(o.recipe)} · ${Brew.methodLabel(o.recipe.method)}`;
    } else if (o.type === "snack") {
      wanted = `${o.snack.emoji} <b>${o.snack.name}</b>`;
      detail = Brew.methodLabel(o.snack.method);
    } else {
      wanted = `${o.recipe.emoji} <b>${o.recipe.name}</b> + ${o.snack.emoji} <b>${o.snack.name}</b>`;
      detail = `Combo · ${Brew.methodLabel(o.recipe.method)} + ${Brew.methodLabel(o.snack.method)}`;
    }
    area.innerHTML = `
      <div class="serving">
        <div class="serving-face">${c.emoji}</div>
        <div>
          <strong>${c.name}</strong> ${this.orderTypeBadge(o.type)}
          <div class="wanted">${wanted}</div>
          <p class="muted small">${detail}</p>
        </div>
      </div>
      <div class="counter-actions">
        <button class="btn btn-primary" id="btn-brew">${
          o.type === "snack" ? "🍪 Chuẩn bị" : o.type === "combo" ? "🧪 Pha + chuẩn bị" : "🧪 Pha chế"
        }</button>
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
    const o = state.currentCustomer.order;
    let body = "";
    if (o.recipe) {
      const r = o.recipe;
      const base = BASES.find((b) => b.id === r.base);
      const milk = MILKS.find((m) => m.id === r.milk);
      const top = TOPPINGS.find((t) => t.id === r.topping);
      body += `
        <div class="ticket-title">${r.emoji} ${r.name}</div>
        <ul class="ticket-list">
          <li>${base?.emoji || ""} Base: <b>${base?.name}</b></li>
          <li>${milk?.emoji || ""} Sữa: <b>${milk?.name}</b></li>
          <li>${top?.emoji || ""} Topping: <b>${top?.name}</b></li>
          <li>🍬 ${this.sugarIceLabel(r)}</li>
          <li>🔄 ${Brew.methodLabel(r.method)}</li>
        </ul>`;
    }
    if (o.snack) {
      const sn = o.snack;
      body += `
        <div class="ticket-title snack-title">${sn.emoji} ${sn.name}</div>
        <ul class="ticket-list">
          <li>Cách làm: <b>${Brew.methodLabel(sn.method)}</b></li>
          <li class="muted small">${sn.desc}</li>
        </ul>`;
    }
    const price = Game.orderPrice(o);
    area.innerHTML = `
      <div class="order-ticket">
        ${this.orderTypeBadge(o.type)}
        ${body}
        <ul class="ticket-list"><li class="price">💵 ${this.money(price)}</li></ul>
        <p class="hint small">Mở 📖 Menu nếu quên!</p>
      </div>
    `;
  },

  /* ---------- BREW SCREEN ---------- */
  renderBrew(state, session, handlers) {
    this.clear();
    this.root.classList.add("screen-brew");
    const step = Brew.currentStep(session);
    const o = session.order;
    const title =
      o.type === "snack"
        ? `${o.snack.emoji} ${o.snack.name}`
        : o.type === "combo"
        ? `${o.recipe.emoji}+${o.snack.emoji} Combo`
        : `${o.recipe.emoji} ${o.recipe.name}`;
    const elapsed = ((Date.now() - session.startTime) / 1000).toFixed(0);

    this.root.innerHTML = `
      <header class="hud brew-hud">
        <div><strong>${o.type === "snack" ? "Chuẩn bị" : "Pha"}: ${title}</strong> cho ${state.currentCustomer.name}</div>
        <div>⏱ ${elapsed}s · Bước ${session.stepIndex + 1}/${session.steps.length}</div>
        <button class="btn btn-ghost btn-sm" id="btn-brew-book">📖</button>
      </header>
      <div class="brew-layout">
        <div class="card brew-steps">
          <div class="step-tabs" id="step-tabs"></div>
          <h3>${Brew.stepLabels[step] || step}</h3>
          <div id="brew-options" class="brew-options"></div>
          <div class="brew-nav">
            <button class="btn btn-ghost" id="btn-brew-back" ${session.stepIndex === 0 || session.methodActive ? "disabled" : ""}>← Lùi</button>
            <button class="btn btn-secondary" id="btn-brew-next" ${step === "method" || step === "snack_method" ? "disabled" : ""}>Tiếp →</button>
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

    const tabs = document.getElementById("step-tabs");
    session.steps.forEach((st, i) => {
      const t = document.createElement("span");
      t.className =
        "step-tab" +
        (i === session.stepIndex ? " active" : "") +
        (i < session.stepIndex ? " done" : "") +
        (st.startsWith("snack") ? " snack-tab" : "");
      t.textContent = i + 1;
      t.title = Brew.stepLabels[st] || st;
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
      const m = session.order.recipe.method;
      box.innerHTML = `
        <p>Công thức cần: <b>${Brew.methodLabel(m)}</b></p>
        <button class="btn btn-primary btn-lg" id="btn-start-method">
          Bắt đầu ${m === "shake" ? "lắc" : "xay"}!
        </button>
        <p class="hint">Bấm liên tục hoặc giữ nhịp để đầy thanh.</p>
      `;
      document.getElementById("btn-start-method").onclick = handlers.startMethod;
      return;
    }

    if (step === "snack_method") {
      const m = session.order.snack.method;
      const verb =
        m === "oven" ? "nướng" : m === "fry" ? "chiên" : "trình bày";
      box.innerHTML = `
        <p>Snack cần: <b>${Brew.methodLabel(m)}</b></p>
        <button class="btn btn-primary btn-lg" id="btn-start-method">
          Bắt đầu ${verb}!
        </button>
        <p class="hint">Bấm để đẩy tiến độ chế biến (lò / chảo / đĩa).</p>
      `;
      document.getElementById("btn-start-method").onclick = handlers.startMethod;
      return;
    }

    if (step === "snack_pick") {
      const unlocked = SNACKS.filter((s) => s.unlockDay <= state.day);
      unlocked.forEach((opt) => {
        const can = Brew.canAffordSnack(state.inventory, opt);
        const selected = session.selections.snack_pick === opt.id;
        const btn = document.createElement("button");
        btn.className = "opt-btn" + (selected ? " selected" : "") + (!can ? " disabled" : "");
        btn.disabled = !can;
        const miss = (opt.ingredients || [])
          .map((id) => `${INGREDIENTS[id]?.emoji || ""} ${state.inventory[id] || 0}`)
          .join(" · ");
        btn.innerHTML = `<span class="opt-emoji">${opt.emoji}</span><span>${opt.name}</span><span class="muted small">${Brew.methodLabel(opt.method)} · ${miss}</span>`;
        btn.onclick = () => handlers.selectBrew("snack_pick", opt.id);
        box.appendChild(btn);
      });
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
        opt.ingredient != null ? ` · còn ${state.inventory[opt.ingredient] || 0}` : "";
      btn.innerHTML = `<span class="opt-emoji">${opt.emoji || ""}</span><span>${opt.name}</span><span class="muted small">${stock}</span>`;
      btn.onclick = () => handlers.selectBrew(step, opt.id);
      box.appendChild(btn);
    });

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
    let html = "";
    if (session.type === "drink" || session.type === "combo") {
      const base = BASES.find((b) => b.id === s.base);
      const milk = MILKS.find((m) => m.id === s.milk);
      const top = TOPPINGS.find((t) => t.id === s.topping);
      const sugar = SUGAR_LEVELS.find((x) => x.id === s.sugar);
      const ice = ICE_LEVELS.find((x) => x.id === s.ice);
      html += `
        <li>Base: ${base ? base.emoji + " " + base.name : "—"}</li>
        <li>Sữa: ${milk ? milk.emoji + " " + milk.name : "—"}</li>
        <li>Topping: ${top ? top.emoji + " " + top.name : "—"}</li>
        <li>Đường: ${sugar ? sugar.name : "—"}</li>
        <li>Đá: ${ice ? ice.name : "—"}</li>
        <li>Cách: ${s.method ? Brew.methodLabel(s.method) : "—"}</li>`;
    }
    if (session.type === "snack" || session.type === "combo") {
      const sn = SNACKS.find((x) => x.id === s.snack_pick);
      html += `
        <li class="snack-sum">Snack: ${sn ? sn.emoji + " " + sn.name : "—"}</li>
        <li>Chế biến: ${s.snack_method ? Brew.methodLabel(s.snack_method) : "—"}</li>`;
    }
    ul.innerHTML = html;
  },

  renderMethodZone(session, handlers) {
    const zone = document.getElementById("method-zone");
    if (!zone) return;
    if (!session.methodActive && session.methodProgress < 100) {
      zone.innerHTML = "";
      return;
    }
    let label = "Đang xử lý...";
    if (session.methodKind === "snack") {
      const m = session.order.snack.method;
      label = m === "oven" ? "Đang nướng..." : m === "fry" ? "Đang chiên..." : "Đang bày đĩa...";
    } else if (session.order.recipe) {
      label = session.order.recipe.method === "shake" ? "Đang lắc..." : "Đang xay...";
    }
    const btnLabel =
      session.methodKind === "snack"
        ? session.order.snack.method === "oven"
          ? "🔥 Nướng!"
          : session.order.snack.method === "fry"
          ? "🍟 Chiên!"
          : "🍽️ Bày!"
        : "🥤 Bấm!";
    zone.innerHTML = `
      <div class="method-bar-wrap">
        <div class="method-label">${label}</div>
        <div class="method-bar"><div class="method-fill" id="method-fill" style="width:${session.methodProgress}%"></div></div>
        <button class="btn btn-primary btn-lg" id="btn-shake-click">${btnLabel}</button>
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
    let root = document.getElementById("modal-root-global");
    if (!root) {
      root = document.createElement("div");
      root.id = "modal-root-global";
      document.body.appendChild(root);
    }
    root.innerHTML = `<div class="modal-backdrop"><div class="modal card">${html}</div></div>`;
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
    const drinks = RECIPES.filter((r) => r.unlockDay <= state.day)
      .map((r) => {
        const base = BASES.find((b) => b.id === r.base)?.name;
        const milk = MILKS.find((m) => m.id === r.milk)?.name;
        const top = TOPPINGS.find((t) => t.id === r.topping)?.name;
        return `<div class="recipe-row">
          <div class="recipe-title">${r.emoji} <b>${r.name}</b> · ${this.money(r.price)}</div>
          <div class="muted small">${base} + ${milk} + ${top} · ${this.sugarIceLabel(r)} · ${Brew.methodLabel(r.method)}</div>
        </div>`;
      })
      .join("");

    const snacks = SNACKS.filter((s) => s.unlockDay <= state.day)
      .map((s) => {
        return `<div class="recipe-row">
          <div class="recipe-title">${s.emoji} <b>${s.name}</b> · ${this.money(s.price)}</div>
          <div class="muted small">${Brew.methodLabel(s.method)} · ${s.desc}</div>
        </div>`;
      })
      .join("");

    const lockedSnacks = SNACKS.filter((s) => s.unlockDay > state.day)
      .map((s) => `<div class="muted small">🔒 ${s.emoji} ${s.name} (ngày ${s.unlockDay})</div>`)
      .join("");

    this.modal(`
      <h2>📖 Menu</h2>
      <h3 class="menu-sec">🧋 Đồ uống</h3>
      <div class="recipe-list">${drinks}</div>
      <h3 class="menu-sec">🍪 Món ăn nhẹ</h3>
      <div class="recipe-list">${snacks || "<p class='muted'>Chưa mở món ăn nhẹ.</p>"}</div>
      ${lockedSnacks ? `<div class="pad-top">${lockedSnacks}</div>` : ""}
      <button class="btn btn-primary" id="modal-close">Đóng</button>
    `);
    document.getElementById("modal-close").onclick = onClose;
  },

  renderInventoryModal(state, onClose) {
    const drinkRows = Object.values(INGREDIENTS)
      .filter((ing) => ing.cat === "drink")
      .map((ing) => {
        const qty = state.inventory[ing.id] || 0;
        const low = qty <= 2 ? " low" : "";
        return `<div class="inv-row${low}"><span>${ing.emoji} ${ing.name}</span><span>${qty}</span></div>`;
      })
      .join("");
    const snackRows = Object.values(INGREDIENTS)
      .filter((ing) => ing.cat === "snack")
      .map((ing) => {
        const qty = state.inventory[ing.id] || 0;
        const low = qty <= 2 ? " low" : "";
        return `<div class="inv-row${low}"><span>${ing.emoji} ${ing.name}</span><span>${qty}</span></div>`;
      })
      .join("");
    this.modal(`
      <h2>📦 Kho nguyên liệu</h2>
      <h3 class="menu-sec">Trà</h3>
      <div class="inv-list">${drinkRows}</div>
      <h3 class="menu-sec">Ăn nhẹ</h3>
      <div class="inv-list">${snackRows}</div>
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
        <h2>📅 Kết thúc Ngày ${summary.day}/${summary.totalDays}</h2>
        <ul class="summary-list">
          <li>Doanh thu: <b>${this.money(summary.revenue)}</b> / mục tiêu ${this.money(summary.goal)}
            ${goalMet ? "✅" : "❌"}</li>
          <li>Khách phục vụ: <b>${summary.served}</b>
            ${summary.snacks || summary.combos ? ` · snack ${summary.snacks || 0} · combo ${summary.combos || 0}` : ""}</li>
          <li>Hoàn hảo: <b>${summary.perfect}</b> · Sai: <b>${summary.wrong}</b> · Bỏ đi: <b>${summary.left}</b></li>
          <li>Tip nhận: <b>${this.money(summary.tips)}</b></li>
          <li>Uy tín: <b>${this.stars(summary.rep)}</b> (${summary.repDelta >= 0 ? "+" : ""}${summary.repDelta.toFixed(1)})</li>
          <li>Đánh giá TB: <b>${
            summary.starCount
              ? "★".repeat(Math.round(summary.avgStars)) +
                "☆".repeat(Math.max(0, 5 - Math.round(summary.avgStars))) +
                " " +
                summary.avgStars.toFixed(1) +
                "/5"
              : "—"
          }</b>
            ${summary.starCount ? `(${summary.starCount} lượt)` : ""}</li>
          <li>Tiền hiện có: <b>${this.money(summary.money)}</b></li>
        </ul>
        <p class="flavor">${
          goalMet
            ? "Một ngày tốt đẹp! Quán đang lớn dần."
            : "Chưa đạt mục tiêu — ngày mai cố thêm nhé!"
        }</p>
        <button class="btn btn-primary" id="btn-to-story">Tiếp →</button>
      </div>
    `;
    document.getElementById("btn-to-story").onclick = onContinue;
  },

  /* ---------- UPGRADE + STOCK ---------- */
  renderUpgrade(state, handlers) {
    this.clear();
    this.root.classList.add("screen-upgrade");
    const fx = getEffects(state.upgrades);
    const disc = fx.stockDiscount || 0;

    const upRows = DEVICES.map((d) => {
      const lv = state.upgrades[d.id] | 0;
      const maxed = lv >= d.maxLevel;
      const cost = deviceUpgradeCost(d, lv);
      const canBuy = !maxed && state.money >= cost;
      const levelPips =
        "●".repeat(lv) + "○".repeat(Math.max(0, d.maxLevel - lv));
      return `<div class="upgrade-row">
        <div>
          <div>${d.emoji} <b>${d.name}</b>
            <span class="level-pill">Cấp ${lv}/4</span>
            <span class="level-pips" title="Cấp ${lv}/4">${levelPips}</span>
          </div>
          <div class="muted small">${d.blurb}</div>
          <div class="muted small effect-line">${d.effectLine(lv)}${
        !maxed ? ` → ${d.effectLine(lv + 1)}` : " · Tối đa"
      }</div>
        </div>
        <button class="btn btn-sm ${maxed ? "btn-ghost" : "btn-secondary"}" data-up="${d.id}" ${
        maxed || !canBuy ? "disabled" : ""
      }>
          ${maxed ? "Max" : "Nâng · " + this.money(cost)}
        </button>
      </div>`;
    }).join("");

    const stockSection = (cat, title) =>
      Object.values(INGREDIENTS)
        .filter((ing) => ing.cat === cat)
        .map((ing) => {
          const price = Math.round(ing.cost * (1 - disc));
          const qty = state.inventory[ing.id] || 0;
          const bonus =
            fx.stockBonusQty && qty >= 0
              ? ` <span class="muted small">(+${fx.stockBonusQty} khi mua +5)</span>`
              : "";
          return `<div class="stock-row">
            <span>${ing.emoji} ${ing.name} <span class="muted">(còn ${qty})</span>${bonus}</span>
            <span class="stock-buy">
              <button class="btn btn-sm btn-ghost" data-buy="${ing.id}" data-qty="1">+1 · ${this.money(price)}</button>
              <button class="btn btn-sm btn-secondary" data-buy="${ing.id}" data-qty="5">+5 · ${this.money(price * 5)}</button>
            </span>
          </div>`;
        })
        .join("");

    const nextLabel =
      state.day >= GAME_CONFIG.totalDays
        ? "Xem kết thúc →"
        : `Sang Ngày ${state.day + 1} →`;

    this.root.innerHTML = `
      <div class="upgrade-layout">
        <div class="card">
          <h2>⬆️ Thiết bị (Cấp 0→4)</h2>
          <p class="muted">Tiền: <b>${this.money(state.money)}</b>${
      disc ? ` · Giảm giá kho ${Math.round(disc * 100)}%` : ""
    }</p>
          <div class="upgrade-list">${upRows}</div>
        </div>
        <div class="card">
          <h2>🛒 Nhập hàng</h2>
          <h3 class="menu-sec">Nguyên liệu trà</h3>
          <div class="stock-list">${stockSection("drink")}</div>
          <h3 class="menu-sec">Nguyên liệu ăn nhẹ</h3>
          <div class="stock-list">${stockSection("snack")}</div>
        </div>
      </div>
      <div class="center pad">
        <button class="btn btn-primary btn-lg" id="btn-next-day">${nextLabel}</button>
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

  /* ---------- WIN / ENDING ---------- */
  renderWin(state, onTitle) {
    this.clear();
    this.root.classList.add("screen-win");
    const lt = state.lifetime || { starSum: 0, starCount: 0, totalRevenue: 0, served: 0 };
    const avg =
      lt.starCount > 0 ? (lt.starSum / lt.starCount).toFixed(2) : "—";
    let ownedLevels = 0;
    let maxLevels = 0;
    const deviceLines = DEVICES.map((d) => {
      const lv = state.upgrades[d.id] | 0;
      ownedLevels += lv;
      maxLevels += d.maxLevel;
      return `<li>${d.emoji} ${d.name}: <b>Cấp ${lv}/4</b></li>`;
    }).join("");

    this.root.innerHTML = `
      <div class="card win-card">
        <div class="title-emoji">🎉🧋🍪</div>
        <h1>30 ngày thành công!</h1>
        <p><b>${state.shopName}</b> đã đứng vững một tháng trong khu phố.</p>
        <ul class="summary-list">
          <li>Tiền cuối: <b>${this.money(state.money)}</b></li>
          <li>Doanh thu cả tháng (ước): <b>${this.money(lt.totalRevenue || 0)}</b></li>
          <li>Uy tín: <b>${this.stars(state.rep)}</b></li>
          <li>Đánh giá TB: <b>${avg}/5</b> (${lt.starCount || 0} lượt)</li>
          <li>Khách phục vụ: <b>${lt.served || 0}</b></li>
          <li>Nâng cấp thiết bị: <b>${ownedLevels}/${maxLevels}</b> cấp</li>
        </ul>
        <details class="device-details">
          <summary>Chi tiết thiết bị</summary>
          <ul class="summary-list compact">${deviceLines}</ul>
        </details>
        <p class="flavor">Cảm ơn bạn đã chơi Trà Nhà Mình!</p>
        <button class="btn btn-primary" id="btn-title">Ván mới / Màn hình chính</button>
      </div>
    `;
    document.getElementById("btn-title").onclick = onTitle;
  },

  renderServeResult(result, onDone) {
    const map = {
      perfect: { title: "Hoàn hảo! ✨", cls: "good", msg: "Khách cười toe toét." },
      ok: { title: "Gần đúng 🙂", cls: "ok", msg: "Khách chấp nhận, ít tip hơn." },
      wrong: { title: "Sai món 😅", cls: "bad", msg: "Phải hoàn / mất uy tín." },
      left: { title: "Khách bỏ đi...", cls: "bad", msg: "Hết kiên nhẫn." },
    };
    const m = map[result.quality] || map.ok;
    const stars = result.stars || 0;
    const starDisplay =
      result.starDisplay ||
      (stars ? "★".repeat(stars) + "☆".repeat(Math.max(0, 5 - stars)) : "");
    const repDelta = result.repDelta != null ? result.repDelta : 0;
    const repTxt = (repDelta >= 0 ? "+" : "") + repDelta.toFixed(2) + " uy tín";
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
