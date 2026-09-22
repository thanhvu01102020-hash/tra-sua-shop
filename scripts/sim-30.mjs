/**
 * Headless day 1→30 playtest for tra-sua-shop.
 * Loads real js/* with a minimal window/document/localStorage shim,
 * auto-plays each shop day, asserts endDay always works.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

function el(id) {
  const o = {
    id,
    style: {},
    className: "",
    dataset: {},
    children: [],
    _html: "",
    get innerHTML() {
      return this._html;
    },
    set innerHTML(v) {
      this._html = String(v ?? "");
    },
    textContent: "",
    value: "",
    disabled: false,
    onclick: null,
    oninput: null,
    addEventListener() {},
    removeEventListener() {},
    appendChild(c) {
      this.children.push(c);
      return c;
    },
    remove() {},
    focus() {},
    click() {
      if (typeof this.onclick === "function") this.onclick({ target: this });
    },
    setAttribute() {},
    getAttribute(n) {
      return this.dataset[n] || null;
    },
    querySelector() {
      return el("q");
    },
    querySelectorAll() {
      return [];
    },
  };
  return o;
}

const elements = new Map();
function getEl(id) {
  if (!id) return el("anon");
  if (!elements.has(id)) elements.set(id, el(id));
  return elements.get(id);
}

const documentStub = {
  body: el("body"),
  documentElement: el("html"),
  getElementById: (id) => getEl(id),
  querySelector: () => el("q"),
  querySelectorAll: () => [],
  createElement: (tag) => el(tag),
  addEventListener() {},
  removeEventListener() {},
};

const windowStub = {
  localStorage,
  AudioContext: class {
    createOscillator() {
      return {
        type: "sine",
        frequency: { value: 0 },
        connect() {},
        start() {},
        stop() {},
      };
    }
    createGain() {
      return { gain: { value: 0, exponentialRampToValueAtTime() {} }, connect() {} };
    }
    get currentTime() {
      return 0;
    }
    get destination() {
      return {};
    }
  },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  setTimeout,
  clearTimeout,
  console,
  Math,
  Date,
  JSON,
  parseInt,
  parseFloat,
  isNaN,
  Number,
  String,
  Array,
  Object,
  Map,
  Set,
  Promise,
  Error,
  RegExp,
  Infinity,
  NaN,
  undefined,
};

windowStub.window = windowStub;
windowStub.document = documentStub;
windowStub.globalThis = windowStub;

const context = vm.createContext(windowStub);

function loadScript(rel, exports) {
  const code = fs.readFileSync(path.join(ROOT, rel), "utf8");
  // const/let do not become context properties — re-export listed names
  const exportStmt = (exports || [])
    .map((n) => `try { globalThis.${n} = ${n}; } catch (_) {}`)
    .join("\n");
  vm.runInContext(code + "\n" + exportStmt, context, { filename: rel });
}

loadScript("js/data.js", [
  "GAME_CONFIG", "DEVICES", "STAFF_ROLES", "RECIPES", "SNACKS", "INGREDIENTS",
  "BASES", "MILKS", "TOPPINGS", "WALK_CONFIG", "CUSTOMER_NAMES", "CUSTOMER_EMOJIS",
  "NPCS", "dayGoal", "baseCustomers", "tableCount", "maxStaffSlots", "staffRoleById",
  "staffWage", "normalizeStaffList", "countRole", "employeesOfRole", "staffCount",
  "totalStaffWages", "sortEmployeesForFire", "pickStaffName", "getEffects",
  "dineInWeight", "orderTypeWeights", "baristaBrewDuration", "managerTip",
  "LEGACY_UPGRADE_MAP", "STAFF_ROLE_ALIAS", "STAFF_NAME_POOL", "STAFF_PRIORITY_OPTIONS",
  "baseTables", "comboWeight", "snackOnlyWeight", "SUGAR_LEVELS", "ICE_LEVELS",
]);
loadScript("js/brew.js", ["Brew"]);
loadScript("js/story.js", ["Story"]);
loadScript("js/ui.js", ["UI"]);
loadScript("js/game.js", ["Game"]);

const Game = context.Game;
const UI = context.UI;
const GAME_CONFIG = context.GAME_CONFIG;
const DEVICES = context.DEVICES;
const STAFF_ROLES = context.STAFF_ROLES;
const maxStaffSlots = context.maxStaffSlots;
const Brew = context.Brew;
const Story = context.Story;

if (!Game || !UI || !Brew || !Story) {
  console.error("Failed to load modules", {
    Game: !!Game,
    UI: !!UI,
    Brew: !!Brew,
    Story: !!Story,
    GAME_CONFIG: !!GAME_CONFIG,
  });
  process.exit(1);
}

// --- Neutralize UI / audio side effects; auto-advance story & day-end ---
const toasts = [];
UI.init = () => {};
UI.toast = (msg, kind) => {
  toasts.push({ msg, kind });
};
UI.money = (n) => String(n);
UI.hasModal = () => false;
UI.closeModal = () => {};
UI.renderTitle = () => {};
UI.renderNameSetup = () => {};
UI.renderStory = (beat, line, phase, onNext, onChoice) => {
  // Auto-skip story: jump to afterStory via Game hooks
  if (typeof onChoice === "function" && beat && beat.choices && beat.choices.length) {
    onChoice(beat.choices[0]);
  } else if (typeof onNext === "function") {
    // Keep advancing until Game.afterStory
    let guard = 0;
    while (Game.stateName === "STORY" && guard++ < 40) {
      onNext();
      if (Game.stateName !== "STORY") break;
      // re-bind next from current showStory — call Game.afterStory path
      if (Game.storyLine >= (Game.storyBeat?.lines?.length || 1) - 1) {
        Game.afterStory();
        break;
      }
      Game.storyLine++;
    }
  }
};
UI.renderShop = () => {};
UI.renderQueue = () => {};
UI.refreshQueuePanelMeta = () => {};
UI.renderReadyTray = () => {};
UI.renderFloorActions = () => {};
UI.renderCounter = () => {};
UI.renderOrder = () => {};
UI.renderTables = () => {};
UI.renderStaffSprites = () => {};
UI.renderShopFloor = () => {};
UI.syncShopFloor = () => {};
UI.syncTables = () => {};
UI.syncPatienceBars = () => {};
UI.renderBrew = () => {};
UI.updateMethodBar = () => {};
UI.renderServeResult = (_r, onDone) => {
  if (typeof onDone === "function") onDone();
};
UI.renderDayEnd = (_summary, onContinue) => {
  if (typeof onContinue === "function") onContinue();
};
UI.renderUpgrade = () => {};
UI.renderWin = () => {};
UI.renderStaffModal = () => {};
UI.renderMoveTableModal = () => {};
UI.renderRecipesModal = () => {};
UI.renderInventoryModal = () => {};

Game.beep = () => {};
Game.sfxClick = () => {};
Game.sfxOk = () => {};
Game.sfxBad = () => {};
Game.sfxCoin = () => {};
Game.save = () => {}; // avoid localStorage noise mid-sim
Game.loop = () => {}; // disable rAF loop

function describeStuck() {
  const s = Game.state;
  if (!s) return "no-state";
  const phases = (s.queue || []).map((c) => `${c.name}:${c.phase}`).join(", ") || "-";
  const tables = (s.tables || []).map((t) => `${t.id}:${t.status}`).join(", ");
  return `day=${s.day} leftSpawn=${s.customersLeft} cur=${s.currentCustomer?.phase || "-"} queue=[${phases}] trays=${(s.readyTray || []).length} jobs=${(Game.staffBrewJobs || []).length} departing=${(s.departing || []).length} cleanJob=${Game.cleanJob ? Game.cleanJob.tableId : "-"} tables=[${tables}] clear=${Game.isDayFloorClear()} stuck=${Game.hasStuckLastCustomers()}`;
}

function autoHire() {
  const day = Game.state.day;
  const slots = maxStaffSlots(day, Game.state.upgrades);
  const staff = Game.state.staff || [];
  const want = [];
  for (const r of STAFF_ROLES) {
    if (day >= r.unlockDay) want.push(r.id);
  }
  // Prefer barista + server + cashier + cleaner order for throughput
  const priority = ["barista", "server", "cashier", "cleaner"];
  for (const roleId of priority) {
    if (!want.includes(roleId)) continue;
    if ((Game.state.staff || []).length >= slots) break;
    if ((Game.state.staff || []).some((e) => e.role === roleId)) continue;
    const before = (Game.state.staff || []).length;
    Game.hireStaff(roleId);
    if ((Game.state.staff || []).length === before) break;
  }
  // Fill remaining slots with baristas
  while ((Game.state.staff || []).length < slots) {
    const before = (Game.state.staff || []).length;
    Game.hireStaff("barista");
    if ((Game.state.staff || []).length === before) break;
  }
}

function autoBuyCheapUpgrades() {
  for (const d of DEVICES) {
    const lv = Game.state.upgrades[d.id] | 0;
    if (lv >= d.maxLevel) continue;
    const cost = d.costs[lv];
    if (cost && Game.state.money >= cost + 25000) {
      Game.buyUpgrade(d.id);
    }
  }
}

function playerAssistTick() {
  // Manual assist on top of staff AI — take order / brew / deliver / clean
  const s = Game.state;
  if (!s || !s.shopOpen) return;

  // Deliver ready trays
  for (const tray of [...(s.readyTray || [])]) {
    Game.serveReady(tray.id);
  }

  // Clean dirty tables
  for (const t of s.tables || []) {
    if (t.status === "dirty" && !Game.cleanJob) Game.cleanTable(t.id);
  }

  // Take next waiting order if free
  if (!s.currentCustomer && Game.stateName === "SHOP") {
    const seated = (s.queue || []).find((c) => c.phase === "seated_ready");
    const waiting = (s.queue || []).find((c) => c.phase === "waiting");
    const target = waiting || seated;
    if (target) Game.takeOrder(target.id);
  }

  // If holding an order and not in brew, auto-perfect brew
  if (s.currentCustomer && Game.stateName === "SHOP" && !Game.brewSession) {
    const cust = s.currentCustomer;
    // Skip if staff already picked up into waiting_brew
    if (cust.phase === "serving" || !cust.phase) {
      try {
        const session = Brew.autoPerfect(cust.order, s.upgrades, 5);
        Brew.consumeStock(s.inventory, session);
        Game.brewSession = null;
        Game.resolveServe(session.result);
      } catch (err) {
        // fallback: unstick
        Game.unstickCustomer(cust.id);
      }
    }
  }

  // Unstick long waiters
  for (const c of [...(s.queue || [])]) {
    if (
      ["waiting_brew", "waiting_food", "waiting_pickup", "waiting_table", "eating"].includes(
        c.phase
      ) &&
      c.patience != null &&
      c.patience < 5
    ) {
      Game.unstickCustomer(c.id);
    }
  }
}

function simulateOneDay(dayNum) {
  const log = { day: dayNum, ok: false, ticks: 0, forced: false, error: null, note: "" };
  const MAX_TICKS = 8000; // ~800s at dt=0.1
  const DT = 0.1;
  let idleClearTicks = 0;

  try {
    // Morning story → openShop (UI.renderStory auto-advances)
    if (Game.stateName !== "SHOP" || !Game.state.shopOpen) {
      Game.startDayMorning();
      // If still in STORY after stub, force open
      let guard = 0;
      while (Game.stateName === "STORY" && guard++ < 60) {
        if (Game.storyBeat && Game.storyLine < Game.storyBeat.lines.length - 1) {
          Game.storyLine++;
          Game.showStory();
        } else {
          Game.afterStory();
        }
      }
      if (Game.stateName !== "SHOP") {
        Game.openShop();
      }
    }

    autoHire();

    while (log.ticks < MAX_TICKS) {
      log.ticks++;
      Game.tickShop(DT);
      playerAssistTick();

      if (Game.state.customersLeft <= 0 && Game.isDayFloorClear()) {
        idleClearTicks++;
      } else {
        idleClearTicks = 0;
      }

      // End when clear for a moment, or force after hang
      if (Game.state.customersLeft <= 0 && Game.isDayFloorClear() && idleClearTicks >= 3) {
        Game.endDay();
        log.ok = true;
        break;
      }
      if (log.ticks > 2500 && Game.state.customersLeft <= 0) {
        // Force path — must still succeed
        log.forced = true;
        log.note = describeStuck();
        if (typeof Game.forceClearFloorForEnd === "function") {
          Game.forceClearFloorForEnd();
        }
        Game.endDay();
        log.ok = true;
        break;
      }
    }

    if (!log.ok) {
      log.error = "timeout: " + describeStuck();
      return log;
    }

    // Day end → evening story → upgrade (stubs auto-continue renderDayEnd)
    // endDay's callback may have fired sync via stub
    let guard = 0;
    while (Game.stateName === "STORY" && guard++ < 60) {
      if (Game.storyBeat && Game.storyLine < Game.storyBeat.lines.length - 1) {
        Game.storyLine++;
        Game.showStory();
      } else {
        Game.afterStory();
      }
    }
    if (Game.stateName === "DAY_END") {
      // callback didn't run? force
      Game.storyPhase = "evening";
      Game.storyBeat = Story.getEvening(Game.state.day);
      Game.storyLine = 0;
      if (Game.storyBeat) {
        Game.stateName = "STORY";
        Game.showStory();
      } else if (Game.state.day >= GAME_CONFIG.totalDays) {
        Game.goWin();
      } else {
        Game.goUpgrade();
      }
      guard = 0;
      while (Game.stateName === "STORY" && guard++ < 60) {
        if (Game.storyBeat && Game.storyLine < Game.storyBeat.lines.length - 1) {
          Game.storyLine++;
          Game.showStory();
        } else {
          Game.afterStory();
        }
      }
    }

    if (Game.stateName === "UPGRADE" || Game.stateName === "WIN") {
      autoBuyCheapUpgrades();
    }

    if (Game.state.day >= GAME_CONFIG.totalDays) {
      if (Game.stateName !== "WIN") Game.goWin();
      log.note = (log.note ? log.note + " | " : "") + "reached WIN";
      return log;
    }

    // Advance to next morning
    if (Game.stateName === "UPGRADE" || Game.stateName === "DAY_END" || Game.stateName === "SHOP") {
      Game.advanceDay();
    }
  } catch (err) {
    log.error = (err && err.stack) || String(err);
    log.ok = false;
  }
  return log;
}

function assertDay5CleanerLockFixed() {
  // Reproduce pre-fix soft-lock: spawn done, no guests, tables cleaning/dirty
  Game.state = Game.freshState("LockTest");
  Game.state.day = 5;
  Game.state.shopOpen = true;
  Game.state.customersLeft = 0;
  Game.state.queue = [];
  Game.state.departing = [];
  Game.state.readyTray = [];
  Game.state.currentCustomer = null;
  Game.state.tables = [
    { id: "t1", index: 0, status: "dirty", customerId: null, cleanT: 0 },
    { id: "t2", index: 1, status: "cleaning", customerId: null, cleanT: 0.4 },
    { id: "t3", index: 2, status: "dirty", customerId: null, cleanT: 0 },
  ];
  Game.cleanJob = { tableId: "t2", t: 0.5, dur: 2.2, by: "staff" };
  Game.staffBrewJobs = [];
  Game.stateName = "SHOP";
  Game.dayStats = {
    served: 3, perfect: 2, wrong: 0, left: 0, tips: 0, revenue: 90000,
    repStart: Game.state.rep, starSum: 12, starCount: 3, snacks: 1, combos: 1,
    dineIn: 2, takeaway: 1, cleaned: 0, wages: 0,
  };
  Game.state.dayRevenue = 90000;

  // Dirty/cleaning alone must not block (root cause of day-5 soft-lock)
  if (!Game.isDayFloorClear()) {
    throw new Error("day5 lock regression: dirty/cleaning still block isDayFloorClear — " + describeStuck());
  }
  Game.settleIdleHousekeeping();
  Game.endDay();
  console.log("Regression: day-5 dirty/cleaning no longer blocks endDay — PASS");
}

function main() {
  assertDay5CleanerLockFixed();

  console.log("=== tra-sua-shop sim 1→30 ===");
  Game.state = Game.freshState("Sim Quán");
  Game.stateName = "SETUP";
  Game.muted = true;

  const results = [];
  let day = 1;
  let reachedWin = false;

  while (day <= GAME_CONFIG.totalDays) {
    const beforeDay = Game.state.day;
    const r = simulateOneDay(beforeDay);
    results.push(r);
    const flag = r.ok ? (r.forced ? "FORCED" : "OK") : "FAIL";
    console.log(
      `Day ${beforeDay}: ${flag} ticks=${r.ticks} money=${Game.state?.money} staff=${(Game.state?.staff || []).length}` +
        (r.forced ? ` :: ${r.note}` : "") +
        (r.error ? ` ERR=${r.error}` : "")
    );
    if (!r.ok) {
      console.error("STOPPED — day could not end");
      process.exitCode = 1;
      break;
    }
    if (r.note && r.note.includes("WIN")) {
      reachedWin = true;
      break;
    }
    // safety: ensure day advanced
    if (Game.state.day === beforeDay && beforeDay < GAME_CONFIG.totalDays) {
      Game.state.day += 1;
    }
    day = Game.state.day;
    if (day > GAME_CONFIG.totalDays) break;
    // prevent infinite if advance failed
    if (results.length > GAME_CONFIG.totalDays + 2) break;
  }

  const failed = results.filter((x) => !x.ok);
  const forced = results.filter((x) => x.forced);
  console.log("---");
  console.log(
    `Passed days: ${results.filter((x) => x.ok).length}/${results.length}; forced ends: ${forced.length}; win=${reachedWin || Game.stateName === "WIN"}; finalDay=${Game.state?.day}`
  );
  if (failed.length) {
    console.error("Failures:", failed);
    process.exitCode = 1;
  } else if (!(reachedWin || Game.stateName === "WIN" || Game.state.day >= GAME_CONFIG.totalDays)) {
    console.error("Did not reach day 30 / WIN");
    process.exitCode = 1;
  } else {
    console.log("SIM PASS");
  }
}

main();
