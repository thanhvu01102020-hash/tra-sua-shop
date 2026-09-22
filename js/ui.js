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
        <p class="hint">30 ngày · Tại chỗ & mang đi · Bàn · Nhân viên · Snack · Thiết bị</p>
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
  serviceBadge(service) {
    if (service === "dinein") return `<span class="badge badge-dinein">Tại chỗ</span>`;
    return `<span class="badge badge-takeaway">Mang đi</span>`;
  },

  renderShop(state, handlers) {
    this.clear();
    this.root.classList.add("screen-shop");
    const goal = dayGoal(state.day);
    const progress = Math.min(100, (state.dayRevenue / goal) * 100);
    const staffN = staffCount(state.staff);
    const tablesN = (state.tables || []).length;
    const dirtyN = (state.tables || []).filter((t) => t.status === "dirty" || t.status === "cleaning").length;

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
          <span title="Bàn" class="hud-chip">🪑 ${tablesN}${dirtyN ? ` · bẩn ${dirtyN}` : ""}</span>
          ${staffN ? `<span title="Nhân viên" class="hud-chip">👥 ${staffN}</span>` : ""}
        </div>
        <div class="hud-right">
          <button class="btn btn-ghost btn-sm" id="btn-recipes">📖 Menu</button>
          <button class="btn btn-ghost btn-sm" id="btn-inv">📦 Kho</button>
          <button class="btn btn-ghost btn-sm" id="btn-staff-shop">👥 NV</button>
          <button class="btn btn-ghost btn-sm" id="btn-mute-shop">🔊</button>
        </div>
      </header>
      <div class="goal-bar"><div class="goal-fill" style="width:${progress}%"></div></div>

      <section class="panel shop-floor-panel">
        <div class="floor-header">
          <h3>Sàn quán</h3>
          <span class="muted small">Mang đi → quầy · Tại chỗ → bàn · Bưng món / Dọn bàn</span>
        </div>
        <div class="shop-floor shop-floor-v3" id="shop-floor" aria-label="Sàn quán">
          <div class="floor-bg">
            <div class="floor-door" title="Cửa vào">
              <span class="door-emoji">🚪</span>
              <span class="door-label">Cửa</span>
            </div>
            <div class="floor-path"></div>
            <div class="floor-tables" id="floor-tables"></div>
            <div class="floor-counter" title="Quầy">
              <div class="bar-top">🧋</div>
              <div class="bar-body"></div>
              <span class="bar-label">Quầy</span>
            </div>
            <div class="floor-pickup" title="Chỗ lấy mang đi">
              <span>🛍️</span>
              <span class="door-label">Mang đi</span>
            </div>
            <div class="floor-decor floor-plant">🪴</div>
            <div class="floor-decor floor-lamp">🪟</div>
            <div class="floor-staff" id="floor-staff"></div>
          </div>
          <div class="floor-actors" id="floor-actors"></div>
        </div>
        <div class="floor-actions" id="floor-actions"></div>
      </section>

      <div class="shop-layout shop-layout-v3">
        <section class="panel queue-panel">
          <h3>Khách <span class="muted" id="queue-count">(0)</span></h3>
          <div id="queue-list" class="queue-list"></div>
          <div id="queue-meta"></div>
        </section>
        <section class="panel counter-panel">
          <h3>Quầy / Phục vụ</h3>
          <div id="counter-area"></div>
          <div id="ready-tray" class="ready-tray"></div>
        </section>
        <section class="panel order-panel">
          <h3>Vé đơn</h3>
          <div id="order-area"></div>
        </section>
      </div>
      <div id="modal-root"></div>
    `;

    document.getElementById("btn-recipes").onclick = handlers.openRecipes;
    document.getElementById("btn-inv").onclick = handlers.openInventory;
    const staffBtn = document.getElementById("btn-staff-shop");
    if (staffBtn) staffBtn.onclick = handlers.openStaff;
    const muteBtn = document.getElementById("btn-mute-shop");
    if (muteBtn) muteBtn.onclick = handlers.toggleMute;

    this.renderTables(state, {
      ...handlers,
      moveTableCustId: Game.moveTableCustId,
    });
    this.renderStaffSprites(state);
    this.renderShopFloor(state);
    this.renderFloorActions(state, handlers);
    this.renderQueue(state, handlers);
    this.refreshQueuePanelMeta(state, {
      ...handlers,
      canEndDay: () => Game.isDayFloorClear(),
      hasStuck: () => Game.hasStuckLastCustomers(),
    });
    this.renderCounter(state, handlers);
    this.renderReadyTray(state, handlers);
    this.renderOrder(state);
  },

  renderStaffSprites(state) {
    const box = document.getElementById("floor-staff");
    if (!box) return;
    if (!state.staffActive) {
      box.innerHTML = "";
      return;
    }
    const list = normalizeStaffList(state.staff);
    box.innerHTML = list
      .map((e) => {
        const r = staffRoleById(e.role);
        const emoji = r ? r.emoji : "👤";
        const label = (r ? r.name : e.role) + " · " + e.name;
        return `<span class="staff-sprite" title="${label}"><span class="staff-emoji">${emoji}</span><span class="staff-tag">${e.name}</span></span>`;
      })
      .join("");
  },

  renderTables(state, handlers) {
    const box = document.getElementById("floor-tables");
    if (!box) return;
    box.innerHTML = "";
    const tables = state.tables || [];
    tables.forEach((t) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "table-spot status-" + t.status;
      el.dataset.tableId = t.id;
      el.style.left = this.tableLeftPct(t.index, tables.length) + "%";
      const cust =
        t.customerId &&
        ((state.queue || []).find((c) => c.id === t.customerId) ||
          (state.currentCustomer && state.currentCustomer.id === t.customerId
            ? state.currentCustomer
            : null));
      let label = t.id.replace("t", "B");
      let sub = "trống";
      if (t.status === "occupied") {
        sub = cust ? cust.emoji + " " + cust.name : "có khách";
      } else if (t.status === "dirty") {
        sub = "bẩn · Dọn";
      } else if (t.status === "cleaning") {
        const pct = Math.min(100, Math.round((t.cleanT || 0) * 100));
        sub = `đang dọn ${pct}%`;
      }
      el.innerHTML = `
        <span class="table-emoji">${t.status === "dirty" ? "🪑💨" : t.status === "cleaning" ? "🧹" : "🪑"}</span>
        <span class="table-id">${label}</span>
        <span class="table-sub">${sub}</span>
        ${
          t.status === "cleaning"
            ? `<span class="table-cleanbar"><span style="width:${Math.min(100, (t.cleanT || 0) * 100)}%"></span></span>`
            : ""
        }
      `;
      if (handlers.moveTableCustId && t.status === "empty") {
        el.classList.add("table-move-target");
      }
      el.onclick = () => {
        if (handlers.moveTableCustId) {
          if (t.status === "empty" && handlers.pickMoveTable) handlers.pickMoveTable(t.id);
          return;
        }
        if (t.status === "dirty" && handlers.cleanTable) handlers.cleanTable(t.id);
        else if (t.status === "occupied" && cust) {
          if (cust.phase === "seated_ready" && handlers.takeOrder) handlers.takeOrder(cust.id);
          else if (cust.phase === "waiting_food" && handlers.deliverToTable)
            handlers.deliverToTable(t.id);
        } else if (t.status === "empty" && handlers.pickMoveTable && handlers.moveTableCustId) {
          handlers.pickMoveTable(t.id);
        }
      };
      box.appendChild(el);
    });
  },

  tableLeftPct(index, total) {
    const start = 18;
    const span = 42;
    if (total <= 1) return start + span / 2;
    return start + (index / (total - 1)) * span;
  },

  syncTables(state, handlers) {
    const box = document.getElementById("floor-tables");
    if (!box) return;
    // lightweight update of status labels
    (state.tables || []).forEach((t) => {
      let el = box.querySelector(`[data-table-id="${t.id}"]`);
      if (!el) {
        this.renderTables(state, handlers || {});
        return;
      }
      el.className = "table-spot status-" + t.status;
      const cust =
        t.customerId &&
        ((state.queue || []).find((c) => c.id === t.customerId) ||
          (state.currentCustomer && state.currentCustomer.id === t.customerId
            ? state.currentCustomer
            : null));
      const subEl = el.querySelector(".table-sub");
      const emojiEl = el.querySelector(".table-emoji");
      if (emojiEl) {
        emojiEl.textContent =
          t.status === "dirty" ? "🪑💨" : t.status === "cleaning" ? "🧹" : "🪑";
      }
      if (subEl) {
        if (t.status === "occupied") subEl.textContent = cust ? cust.emoji + " " + cust.name : "có khách";
        else if (t.status === "dirty") subEl.textContent = "bẩn · Dọn";
        else if (t.status === "cleaning")
          subEl.textContent = `đang dọn ${Math.min(100, Math.round((t.cleanT || 0) * 100))}%`;
        else subEl.textContent = "trống";
      }
      let bar = el.querySelector(".table-cleanbar");
      if (t.status === "cleaning") {
        if (!bar) {
          bar = document.createElement("span");
          bar.className = "table-cleanbar";
          bar.innerHTML = "<span></span>";
          el.appendChild(bar);
        }
        const fill = bar.querySelector("span");
        if (fill) fill.style.width = Math.min(100, (t.cleanT || 0) * 100) + "%";
      } else if (bar) {
        bar.remove();
      }
    });
  },

  renderFloorActions(state, handlers) {
    const box = document.getElementById("floor-actions");
    if (!box) return;
    const dirty = (state.tables || []).filter((t) => t.status === "dirty");
    const readyDi = (state.readyTray || []).filter((t) => t.service === "dinein");
    const readyTw = (state.readyTray || []).filter((t) => t.service === "takeaway");
    const seated = (state.queue || []).filter((c) => c.phase === "seated_ready");
    const movable = (state.queue || []).filter(
      (c) =>
        c.service === "dinein" &&
        ["seated_ready", "waiting_food", "waiting_brew", "eating"].includes(c.phase)
    );
    const bits = [];
    if (seated.length && !state.currentCustomer) {
      bits.push(
        `<button class="btn btn-sm btn-primary" id="fa-take">📝 Nhận đơn bàn (${seated[0].name})</button>`
      );
    }
    if (movable.length && handlers.moveTable) {
      bits.push(
        `<button class="btn btn-sm btn-ghost" id="fa-move">🔄 Đổi bàn (${movable[0].name})</button>`
      );
    }
    if (readyDi.length) {
      bits.push(
        `<button class="btn btn-sm btn-secondary" id="fa-serve">🍽️ Bưng món (${readyDi.length})</button>`
      );
    }
    if (readyTw.length) {
      bits.push(
        `<button class="btn btn-sm btn-secondary" id="fa-bag">🛍️ Giao mang đi (${readyTw.length})</button>`
      );
    }
    if (dirty.length) {
      bits.push(
        `<button class="btn btn-sm btn-ghost" id="fa-clean">🧹 Dọn bàn (${dirty.length})</button>`
      );
    }
    box.innerHTML = bits.join(" ") || `<span class="muted small">Không có việc sàn ngay</span>`;
    const take = document.getElementById("fa-take");
    if (take) take.onclick = () => handlers.takeOrder(seated[0].id);
    const move = document.getElementById("fa-move");
    if (move) move.onclick = () => handlers.moveTable(movable[0].id);
    const serve = document.getElementById("fa-serve");
    if (serve) serve.onclick = () => handlers.serveReady(readyDi[0].id);
    const bag = document.getElementById("fa-bag");
    if (bag) bag.onclick = () => handlers.serveReady(readyTw[0].id);
    const clean = document.getElementById("fa-clean");
    if (clean) clean.onclick = () => handlers.cleanTable(dirty[0].id);
  },

  allFloorActors(state) {
    const list = [];
    (state.queue || []).forEach((c) => {
      // seated customers shown at tables primarily; still show sprite near table
      list.push(c);
    });
    if (state.currentCustomer && state.currentCustomer.service === "takeaway") {
      if (!list.find((c) => c.id === state.currentCustomer.id)) list.push(state.currentCustomer);
    } else if (state.currentCustomer && state.currentCustomer.service === "dinein") {
      if (!list.find((c) => c.id === state.currentCustomer.id)) list.push(state.currentCustomer);
    }
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
    el.className =
      "floor-sprite phase-" +
      (c.phase || "waiting") +
      " mood-" +
      (c.mood || "wait") +
      " svc-" +
      (c.service || "takeaway");
    el.dataset.id = c.id;
    el.style.left = this.actorLeftPct(c) + "%";
    if (
      c.service === "dinein" &&
      ["seated_ready", "serving", "waiting_food", "waiting_brew", "eating"].includes(c.phase)
    ) {
      el.style.bottom = "58px";
    }
    const pct = Math.max(0, (c.patience / c.maxPatience) * 100);
    const showPatience = [
      "waiting",
      "serving",
      "waiting_table",
      "seated_ready",
      "waiting_food",
      "waiting_pickup",
      "waiting_brew",
    ].includes(c.phase);
    const statusMap = {
      walking_in: "đang tới…",
      walking_out: c.mood === "angry" ? "rời quán 💢" : c.bag ? "mang túi 👋" : "tạm biệt 👋",
      serving: "đặt món",
      waiting: "chờ quầy",
      waiting_table: "chờ bàn",
      seated_ready: "ngồi · chờ nhận",
      waiting_food: "chờ món",
      waiting_brew: "đang pha…",
      waiting_pickup: "chờ túi",
      eating: "đang ăn…",
    };
    const status = statusMap[c.phase] || "…";
    const svcIcon = c.service === "dinein" ? "🪑" : "🛍️";
    el.innerHTML = `
      ${
        showPatience
          ? `<div class="sprite-patience"><div class="patience-fill" style="width:${pct}%"></div></div>`
          : `<div class="sprite-status">${status}</div>`
      }
      <div class="sprite-emoji">${c.emoji}${c.bag ? "🛍️" : ""}</div>
      <div class="sprite-name">${svcIcon}${c.name}</div>
      ${c.phase === "walking_in" ? `<div class="sprite-walk-dots">🚶</div>` : ""}
      ${!showPatience && c.phase !== "walking_in" ? "" : showPatience ? `<div class="sprite-status micro">${status}</div>` : ""}
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
        el.className =
          "floor-sprite phase-" +
          (c.phase || "waiting") +
          " mood-" +
          (c.mood || "wait") +
          " svc-" +
          (c.service || "takeaway");
        if (
          c.service === "dinein" &&
          ["seated_ready", "serving", "waiting_food", "waiting_brew", "eating"].includes(
            c.phase
          )
        ) {
          el.style.bottom = "58px";
        } else {
          el.style.bottom = "";
        }
        const showPatience = [
          "waiting",
          "serving",
          "waiting_table",
          "seated_ready",
          "waiting_food",
          "waiting_pickup",
          "waiting_brew",
        ].includes(c.phase);
        const fill = el.querySelector(".patience-fill");
        if (showPatience && fill) {
          fill.style.width = Math.max(0, (c.patience / c.maxPatience) * 100) + "%";
        }
        const emoji = el.querySelector(".sprite-emoji");
        if (emoji) emoji.textContent = c.emoji + (c.bag ? "🛍️" : "");
      }
    });
  },

  syncPatienceBars(state) {
    const waiting = (state.queue || []).filter(
      (c) =>
        c.phase === "waiting" ||
        c.phase === "waiting_table" ||
        c.phase === "seated_ready" ||
        c.phase === "waiting_food" ||
        c.phase === "waiting_pickup" ||
        c.phase === "waiting_brew"
    );
    document.querySelectorAll(".queue-list .customer-card").forEach((card) => {
      const id = card.dataset.id;
      const c = waiting.find((x) => x.id === id);
      if (!c) return;
      const fill = card.querySelector(".patience-fill");
      if (fill) fill.style.width = Math.max(0, (c.patience / c.maxPatience) * 100) + "%";
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
          Math.max(
            0,
            (state.currentCustomer.patience / state.currentCustomer.maxPatience) * 100
          ) + "%";
      }
    }
    // sync clean bars
    this.syncTables(state, {});
  },

  refreshQueuePanelMeta(state, handlers) {
    const meta = document.getElementById("queue-meta");
    const count = document.getElementById("queue-count");
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
    const active = (state.queue || []).filter((c) => activePhases.has(c.phase)).length;
    if (count) count.textContent = `(${active})`;
    if (!meta) return;

    const canEnd =
      typeof handlers.canEndDay === "function"
        ? handlers.canEndDay()
        : active === 0 &&
          !(state.departing || []).length &&
          !state.currentCustomer &&
          !(state.readyTray || []).length &&
          state.customersLeft <= 0 &&
          !(state.tables || []).some((t) => t.status === "occupied" || t.status === "cleaning");

    const stuck =
      typeof handlers.hasStuck === "function"
        ? handlers.hasStuck()
        : state.customersLeft <= 0 &&
          active > 0 &&
          (state.queue || []).some((c) =>
            ["waiting_food", "waiting_brew", "waiting_pickup", "eating", "waiting_table", "serving"].includes(
              c.phase
            )
          );

    if (canEnd) {
      meta.innerHTML = `<p class="muted center">Hết khách hôm nay.</p>
        <button class="btn btn-primary" id="btn-end-day">Kết thúc ngày →</button>`;
      const endBtn = document.getElementById("btn-end-day");
      if (endBtn && handlers.endDay) endBtn.onclick = handlers.endDay;
    } else if (stuck && state.customersLeft <= 0) {
      const stuckCust =
        (state.queue || []).find((c) =>
          ["waiting_food", "waiting_brew", "waiting_pickup", "eating", "waiting_table", "serving"].includes(
            c.phase
          )
        ) || state.currentCustomer;
      meta.innerHTML = `
        <p class="muted center">Có khách đang treo — hãy Đổi bàn / Bưng món, hoặc xử lý.</p>
        <div class="row-actions center-actions">
          ${
            stuckCust
              ? `<button class="btn btn-sm btn-ghost" id="btn-unstick">Bỏ qua khách / Xử lý treo</button>`
              : ""
          }
          <button class="btn btn-sm btn-secondary" id="btn-end-day-force">Kết thúc ngày →</button>
        </div>`;
      const u = document.getElementById("btn-unstick");
      if (u && stuckCust && handlers.unstickCustomer) {
        u.onclick = () => handlers.unstickCustomer(stuckCust.id);
      }
      const endBtn = document.getElementById("btn-end-day-force");
      if (endBtn) {
        endBtn.onclick = () => {
          if (handlers.forceEndDay) handlers.forceEndDay();
          else if (handlers.endDay) handlers.endDay();
        };
      }
    } else if (active === 0 && state.customersLeft > 0) {
      meta.innerHTML = `<p class="muted center">Đang chờ khách...</p>`;
    } else {
      meta.innerHTML = "";
    }
  },

  renderQueue(state, handlers) {
    const list = document.getElementById("queue-list");
    if (!list) return;
    list.innerHTML = "";

    const showPhases = [
      "waiting",
      "waiting_table",
      "seated_ready",
      "waiting_food",
      "waiting_pickup",
      "waiting_brew",
      "eating",
      "walking_in",
    ];
    const cards = (state.queue || []).filter((c) => showPhases.includes(c.phase));

    // sort: takeaway waiting first, then seated needing order, then others
    const rank = (c) => {
      if (c.phase === "waiting" && c.service === "takeaway") return 0;
      if (c.phase === "seated_ready") return 1;
      if (c.phase === "waiting_pickup") return 2;
      if (c.phase === "waiting_food") return 3;
      if (c.phase === "waiting_brew") return 3.5;
      if (c.phase === "waiting_table") return 4;
      if (c.phase === "eating") return 5;
      return 6;
    };
    cards.sort((a, b) => rank(a) - rank(b));

    const firstTakeaway = cards.find(
      (c) => c.phase === "waiting" && c.service === "takeaway"
    );

    cards.forEach((c) => {
      const pct = Math.max(0, (c.patience / c.maxPatience) * 100);
      const div = document.createElement("div");
      div.className =
        "customer-card" +
        (c === firstTakeaway || c.phase === "seated_ready" ? " first" : "") +
        (c.phase === "walking_in" ? " walking" : "") +
        (c.service === "dinein" ? " dinein" : " takeaway");
      div.dataset.id = c.id;
      const typeHint =
        c.order.type === "combo" ? "🧋+🍪" : c.order.type === "snack" ? "🍪" : "🧋";
      const phaseHint =
        c.phase === "walking_in"
          ? "🚶 Đang vào…"
          : c.phase === "waiting_table"
          ? "⏳ Chờ bàn"
          : c.phase === "seated_ready"
          ? "🪑 Chờ nhận đơn"
          : c.phase === "waiting_food"
          ? "🍜 Chờ bưng món"
          : c.phase === "waiting_brew"
          ? "🧋 Đang pha…"
          : c.phase === "waiting_pickup"
          ? "🛍️ Chờ túi"
          : c.phase === "eating"
          ? "😋 Đang dùng"
          : "chờ quầy";

      const canMove =
        c.service === "dinein" &&
        ["seated_ready", "waiting_food", "waiting_brew", "eating", "serving"].includes(
          c.phase
        );
      let actionBits = [];
      if (
        !state.currentCustomer &&
        ((c.phase === "waiting" && c.service === "takeaway" && c === firstTakeaway) ||
          c.phase === "seated_ready")
      ) {
        actionBits.push(`<button class="btn btn-sm btn-primary take-btn">Nhận đơn</button>`);
      }
      if (canMove && handlers.moveTable) {
        actionBits.push(
          `<button class="btn btn-sm btn-ghost move-btn" title="Chuyển sang bàn trống sạch">Đổi bàn</button>`
        );
      }
      const action =
        actionBits.join(" ") || `<span class="muted small">${phaseHint}</span>`;

      div.innerHTML = `
        <div class="cust-emoji">${c.emoji}</div>
        <div class="cust-info">
          <div class="cust-name">${c.name}${c.isNPC ? " · " + c.npcRole : ""}
            ${this.serviceBadge(c.service)} ${typeHint}
            ${c.tableId ? `<span class="muted small">· ${c.tableId.replace("t", "B")}</span>` : ""}</div>
          <div class="muted small">${Game.orderTicketText(c.order)}</div>
          ${
            c.phase !== "walking_in" && c.phase !== "eating"
              ? `<div class="patience"><div class="patience-fill" style="width:${pct}%"></div></div>`
              : `<div class="muted small">${phaseHint}</div>`
          }
        </div>
        <div class="cust-actions">${action}</div>
      `;
      const btn = div.querySelector(".take-btn");
      if (btn) btn.onclick = () => handlers.takeOrder(c.id);
      const moveBtn = div.querySelector(".move-btn");
      if (moveBtn) moveBtn.onclick = () => handlers.moveTable(c.id);
      list.appendChild(div);
    });
  },

  renderReadyTray(state, handlers) {
    const box = document.getElementById("ready-tray");
    if (!box) return;
    const trays = state.readyTray || [];
    if (!trays.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML =
      `<div class="ready-title">Món sẵn sàng</div>` +
      trays
        .map((t) => {
          const cust =
            (state.queue || []).find((c) => c.id === t.customerId) ||
            null;
          const name = cust ? cust.name : "?";
          const label =
            t.service === "dinein"
              ? `🍽️ Bưng → ${t.tableId || "bàn"}`
              : `🛍️ Giao mang đi`;
          return `<div class="ready-row">
            <span>${Game.orderTicketText(t.order)} · ${name}</span>
            <button class="btn btn-sm btn-secondary" data-tray="${t.id}">${label}</button>
          </div>`;
        })
        .join("");
    box.querySelectorAll("[data-tray]").forEach((btn) => {
      btn.onclick = () => handlers.serveReady(btn.getAttribute("data-tray"));
    });
  },

  renderCounter(state, handlers) {
    const area = document.getElementById("counter-area");
    if (!area) return;
    if (!state.currentCustomer) {
      area.innerHTML = `<div class="empty-counter">🧋<p>Nhận đơn mang đi ở quầy hoặc đơn bàn (Tại chỗ)</p></div>`;
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
          <strong>${c.name}</strong> ${this.serviceBadge(c.service)} ${this.orderTypeBadge(o.type)}
          <div class="wanted">${wanted}</div>
          <p class="muted small">${detail}${c.tableId ? " · " + c.tableId : ""}</p>
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
      // show next pending tickets summary
      const pending = (state.queue || []).filter((c) =>
        ["seated_ready", "waiting", "waiting_food", "waiting_pickup"].includes(c.phase)
      );
      if (!pending.length) {
        area.innerHTML = `<p class="muted">Chưa có đơn.</p>`;
        return;
      }
      area.innerHTML =
        `<p class="muted small">Vé đang chờ:</p>` +
        pending
          .slice(0, 4)
          .map(
            (c) =>
              `<div class="mini-ticket">${this.serviceBadge(c.service)} ${this.orderTypeBadge(
                c.order.type
              )} ${Game.orderTicketText(c.order)}</div>`
          )
          .join("");
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
    const c = state.currentCustomer;
    area.innerHTML = `
      <div class="order-ticket">
        ${this.serviceBadge(c.service)} ${this.orderTypeBadge(o.type)}
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

  renderMoveTableModal(state, customer, handlers) {
    const empties = (state.tables || []).filter((t) => t.status === "empty");
    const rows = empties.length
      ? empties
          .map(
            (t) =>
              `<button type="button" class="btn btn-secondary move-table-pick" data-table="${t.id}">
                🪑 Bàn ${t.id.replace("t", "")} — trống sạch
              </button>`
          )
          .join("")
      : `<p class="muted">Không còn bàn trống sạch. Hãy dọn bàn bẩn trước.</p>`;
    this.modal(`
      <h2>Đổi bàn</h2>
      <p>Chuyển <b>${customer.emoji} ${customer.name}</b>
        ${customer.tableId ? `(đang ở ${customer.tableId.replace("t", "B")})` : ""}
        sang bàn trống sạch.</p>
      <div class="move-table-list">${rows}</div>
      <p class="hint small">Hoặc bấm trực tiếp bàn trống trên sàn quán.</p>
      <button type="button" class="btn btn-ghost" id="modal-close">Huỷ</button>
    `);
    document.getElementById("modal-close").onclick = handlers.cancel;
    document.querySelectorAll(".move-table-pick").forEach((btn) => {
      btn.onclick = () => handlers.pick(btn.getAttribute("data-table"));
    });
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
          <li>Tại chỗ: <b>${summary.dineIn || 0}</b> · Mang đi: <b>${summary.takeaway || 0}</b>
            ${summary.cleaned ? ` · đã dọn ${summary.cleaned} bàn` : ""}</li>
          <li>Nhân viên hôm nay: <b>${summary.staff || 0}</b></li>
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
  staffPanelHtml(state) {
    const slots = maxStaffSlots(state.day, state.upgrades);
    const list = normalizeStaffList(state.staff);
    const hired = list.length;
    const priority = state.staffPriority || "balanced";
    const tip = managerTip(state.day, list, state.money, slots);
    const roster = list.length
      ? list
          .map((e) => {
            const r = staffRoleById(e.role);
            return `<div class="staff-roster-row">
              <span>${r ? r.emoji : "👤"} <b>${e.name}</b> · ${r ? r.name : e.role}
                <span class="muted small">(${this.money(staffWage(e.role, state.day))}/ngày)</span>
              </span>
              <button type="button" class="btn btn-sm btn-ghost" data-fire="${e.id}">Cho nghỉ</button>
            </div>`;
          })
          .join("")
      : `<p class="muted small">Chưa có nhân viên — bạn đang tự làm mọi việc.</p>`;
    const hireRows = STAFF_ROLES.map((r) => {
      const locked = state.day < r.unlockDay;
      const count = countRole(list, r.id);
      const wage = staffWage(r, state.day);
      const fee = Math.round(wage * 0.5);
      let btn;
      if (locked) btn = `<button type="button" class="btn btn-sm btn-ghost" disabled>Ngày ${r.unlockDay}</button>`;
      else {
        const full = hired >= slots;
        btn = `<button type="button" class="btn btn-sm btn-secondary" data-hire="${r.id}" ${
          full || state.money < fee ? "disabled" : ""
        }>Thuê thêm · ${this.money(fee)}</button>`;
      }
      return `<div class="upgrade-row staff-row">
        <div>
          <div>${r.emoji} <b>${r.name}</b> ${count ? `<span class="level-pill">×${count}</span>` : ""}</div>
          <div class="muted small">${r.blurb}</div>
          <div class="muted small">Lương/ngày: <b>${this.money(wage)}</b></div>
        </div>
        ${btn}
      </div>`;
    }).join("");
    const prio = STAFF_PRIORITY_OPTIONS.map((p) => {
      const on = priority === p.id;
      return `<button type="button" class="btn btn-sm ${on ? "btn-primary" : "btn-ghost"}" data-priority="${p.id}">${p.emoji} ${p.label}</button>`;
    }).join(" ");
    return `
      <p class="muted small">Slot: <b>${hired}/${slots}</b> · Có thể thuê nhiều người cùng vai trò.
        ${tip ? `<br/><span class="manager-tip">💡 ${tip}</span>` : ""}</p>
      <h3 class="menu-sec">Đội ngũ hiện tại</h3>
      <div class="staff-roster">${roster}</div>
      <h3 class="menu-sec">Ưu tiên quản lý</h3>
      <div class="staff-priority">${prio}</div>
      <h3 class="menu-sec">Thuê thêm</h3>
      <div class="staff-list">${hireRows}</div>
    `;
  },

  renderUpgrade(state, handlers) {
    this.clear();
    this.root.classList.add("screen-upgrade");
    const fx = getEffects(state.upgrades);
    const disc = fx.stockDiscount || 0;
    const slots = maxStaffSlots(state.day, state.upgrades);
    const hired = staffCount(state.staff);

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

    const stockSection = (cat) =>
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

    const staffPanel = this.staffPanelHtml(state);

    const nextLabel =
      state.day >= GAME_CONFIG.totalDays
        ? "Xem kết thúc →"
        : `Sang Ngày ${state.day + 1} →`;

    const tablePreview = tableCount(state.day + (state.day < GAME_CONFIG.totalDays ? 1 : 0), state.upgrades);

    this.root.innerHTML = `
      <div class="upgrade-layout upgrade-layout-v3">
        <div class="card">
          <h2>⬆️ Thiết bị (Cấp 0→4)</h2>
          <p class="muted">Tiền: <b>${this.money(state.money)}</b>${
      disc ? ` · Giảm giá kho ${Math.round(disc * 100)}%` : ""
    }
            · Bàn ngày mai ~${tablePreview}</p>
          <div class="upgrade-list">${upRows}</div>
        </div>
        <div class="card">
          <h2>👥 Quản lý nhân viên</h2>
          ${staffPanel}
          <h2 class="pad-top">🛒 Nhập hàng</h2>
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
    this.root.querySelectorAll("[data-hire]").forEach((btn) => {
      btn.onclick = () => handlers.hireStaff(btn.getAttribute("data-hire"));
    });
    this.root.querySelectorAll("[data-fire]").forEach((btn) => {
      btn.onclick = () => handlers.fireStaff(btn.getAttribute("data-fire"));
    });
    this.root.querySelectorAll("[data-priority]").forEach((btn) => {
      if (handlers.setPriority) {
        btn.onclick = () => handlers.setPriority(btn.getAttribute("data-priority"));
      }
    });
    document.getElementById("btn-next-day").onclick = handlers.nextDay;
  },

  renderStaffModal(state, handlers) {
    this.modal(`
      <h2>👥 Quản lý nhân viên</h2>
      ${this.staffPanelHtml(state)}
      <button type="button" class="btn btn-primary" id="modal-close">Đóng</button>
    `);
    document.getElementById("modal-close").onclick = handlers.close;
    const root = document.getElementById("modal-root-global") || document;
    root.querySelectorAll("[data-hire]").forEach((btn) => {
      btn.onclick = () => handlers.hireStaff(btn.getAttribute("data-hire"));
    });
    root.querySelectorAll("[data-fire]").forEach((btn) => {
      btn.onclick = () => handlers.fireStaff(btn.getAttribute("data-fire"));
    });
    root.querySelectorAll("[data-priority]").forEach((btn) => {
      if (handlers.setPriority) {
        btn.onclick = () => handlers.setPriority(btn.getAttribute("data-priority"));
      }
    });
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
          <li>Nhân viên (đỉnh điểm): <b>${staffCount(state.staff)} / peak ${lt.peakStaff || staffCount(state.staff)}</b></li>
        </ul>
        <div class="staff-win">${
          STAFF_ROLES.map((r) => {
            const n = countRole(state.staff, r.id);
            return `<span class="staff-chip ${n ? "on" : "off"}">${r.emoji} ${r.name}${
              n ? " ×" + n : ""
            }</span>`;
          }).join(" ")
        }</div>
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
      ${result.serviceTag ? `<p class="muted small">${result.serviceTag}</p>` : ""}
      <p>${result.payText || ""}</p>
      <button class="btn btn-primary" id="modal-close">OK</button>
    `);
    document.getElementById("modal-close").onclick = onDone;
  },
};
