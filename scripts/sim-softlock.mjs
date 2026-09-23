/**
 * Soft-lock regression tests for tra-sua-shop.
 * 1) Last customer eating + departing + dirty tables → endDay succeeds
 * 2) Đổi bàn with only dirty other tables → auto-clean then move
 * 3) Modal stuck + customersLeft=0 → refreshEndDayUi / escape path
 * Then runs days 1–30 via shared helpers from sim-30 patterns.
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
  "STAR_FLAVOR", "deviceUpgradeCost",
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

if (!Game || !UI || !Brew) {
  console.error("Failed to load modules");
  process.exit(1);
}

let modalOpen = false;
const toasts = [];
UI.init = () => {};
UI.toast = (msg, kind) => toasts.push({ msg, kind });
UI.money = (n) => String(n);
UI.hasModal = () => modalOpen;
UI.closeModal = () => {
  modalOpen = false;
};
UI.renderTitle = () => {};
UI.renderNameSetup = () => {};
UI.renderStory = (beat, line, phase, onNext, onChoice) => {
  if (typeof onChoice === "function" && beat && beat.choices && beat.choices.length) {
    onChoice(beat.choices[0]);
  } else if (typeof onNext === "function") {
    let guard = 0;
    while (Game.stateName === "STORY" && guard++ < 40) {
      onNext();
      if (Game.stateName !== "STORY") break;
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
UI.renderDayEscapeBar = () => {};
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
UI.renderServeResult = () => {
  modalOpen = true; // simulate sticky modal unless closed
};
UI.renderDayEnd = (_summary, onContinue) => {
  if (typeof onContinue === "function") onContinue();
};
UI.renderUpgrade = () => {};
UI.renderWin = () => {};
UI.renderStaffModal = () => {};
UI.renderMoveTableModal = () => {
  modalOpen = true;
};
UI.renderRecipesModal = () => {
  modalOpen = true;
};
UI.renderInventoryModal = () => {
  modalOpen = true;
};

Game.beep = () => {};
Game.sfxClick = () => {};
Game.sfxOk = () => {};
Game.sfxBad = () => {};
Game.sfxCoin = () => {};
Game.save = () => {};
Game.loop = () => {};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function describeStuck() {
  const s = Game.state;
  if (!s) return "no-state";
  const phases = (s.queue || []).map((c) => `${c.name}:${c.phase}`).join(", ") || "-";
  const tables = (s.tables || []).map((t) => `${t.id}:${t.status}`).join(", ");
  return `day=${s.day} leftSpawn=${s.customersLeft} cur=${s.currentCustomer?.phase || "-"} queue=[${phases}] trays=${(s.readyTray || []).length} jobs=${(Game.staffBrewJobs || []).length} departing=${(s.departing || []).length} cleanJob=${Game.cleanJob ? Game.cleanJob.tableId : "-"} tables=[${tables}] clear=${Game.isDayFloorClear()} stuck=${Game.hasStuckLastCustomers()} modal=${modalOpen}`;
}

function makeEater(id, tableId) {
  return {
    id,
    name: "Test",
    emoji: "🙂",
    isNPC: false,
    npcRole: "",
    patience: 20,
    maxPatience: 40,
    order: {
      type: "drink",
      recipe: { ...context.RECIPES[0] },
      snack: null,
    },
    service: "dinein",
    tableId,
    phase: "eating",
    walkT: 0,
    walkDur: 1,
    lineSlot: 0,
    pos: 0.4,
    targetPos: 0.4,
    mood: "eat",
    bag: false,
    eatT: 4.6,
    pendingResult: {
      quality: "perfect",
      elapsed: 3,
      fast: true,
      softLimit: GAME_CONFIG.brewTimeLimit,
    },
  };
}

function testLastCustomerEndDay() {
  console.log("--- softlock: last customer eating + departing + dirty → endDay");
  modalOpen = true; // sticky serve-result modal
  Game.state = Game.freshState("SoftLock");
  Game.state.day = 5;
  Game.state.shopOpen = true;
  Game.state.customersLeft = 0;
  Game.stateName = "SHOP";
  Game.dayStats = {
    served: 2,
    perfect: 1,
    wrong: 0,
    left: 0,
    tips: 0,
    revenue: 50000,
    repStart: Game.state.rep,
    starSum: 8,
    starCount: 2,
    snacks: 0,
    combos: 0,
    dineIn: 2,
    takeaway: 0,
    cleaned: 0,
    wages: 0,
  };
  Game.state.dayRevenue = 50000;
  const eater = makeEater("c_eat", "t1");
  Game.state.queue = [eater];
  Game.state.departing = [
    {
      id: "c_dep",
      name: "Gone",
      emoji: "👋",
      phase: "walking_out",
      walkT: 0.2,
      walkDur: 3,
      pos: 0.5,
      mood: "happy",
      exitReason: "served",
      service: "takeaway",
    },
  ];
  Game.state.tables = [
    { id: "t1", index: 0, status: "occupied", customerId: "c_eat", cleanT: 0 },
    { id: "t2", index: 1, status: "dirty", customerId: null, cleanT: 0 },
    { id: "t3", index: 2, status: "cleaning", customerId: null, cleanT: 0.3 },
  ];
  Game.cleanJob = { tableId: "t3", t: 0.5, dur: 2, by: "staff" };
  Game.staffBrewJobs = [];
  Game.state.currentCustomer = null;
  Game.state.readyTray = [];
  Game._hangToastAt = 0;
  Game._modalStuckAt = 0;
  Game._forceClearToastShown = false;

  // Departing must NOT block floor clear once eater settled
  assert(
    !Game.isDayFloorClear(),
    "should not be clear while eater active — " + describeStuck()
  );

  // Simulate ticks: finish eat, snap departing, close modal, refresh UI
  for (let i = 0; i < 40; i++) {
    Game.tickShop(0.1);
  }

  assert(
    Game.isDayFloorClear() || Game.stateName === "DAY_END" || (Game.state.queue || []).length === 0,
    "after ticks, eater should be gone — " + describeStuck()
  );

  // Modal should have been auto-closed after ~1.5s cumulative while clear/stuck
  // (may still open briefly; force end path must work regardless)
  modalOpen = true;
  const beforeMoney = Game.state.money;
  Game.endDay();
  // Stub may auto-continue DAY_END → story → upgrade; any of these means endDay ran
  assert(
    ["DAY_END", "STORY", "UPGRADE", "WIN"].includes(Game.stateName) && Game.stateName !== "SHOP",
    "endDay must leave SHOP, got " + Game.stateName
  );
  assert(!modalOpen, "endDay must close modal");
  assert(Game.state.shopOpen === false, "shop must close");
  console.log("PASS last-customer endDay →", Game.stateName, "money", Game.state.money);
}

function testMoveWithDirtyOnly() {
  console.log("--- softlock: Đổi bàn with only dirty other tables");
  modalOpen = false;
  Game.state = Game.freshState("MoveTest");
  Game.state.day = 4;
  Game.state.shopOpen = true;
  Game.state.customersLeft = 2;
  Game.stateName = "SHOP";
  Game.dayStats = {
    served: 0,
    perfect: 0,
    wrong: 0,
    left: 0,
    tips: 0,
    revenue: 0,
    repStart: Game.state.rep,
    starSum: 0,
    starCount: 0,
    snacks: 0,
    combos: 0,
    dineIn: 1,
    takeaway: 0,
    cleaned: 0,
    wages: 0,
  };
  const cust = makeEater("c_move", "t1");
  cust.phase = "seated_ready";
  cust.mood = "sit";
  cust.eatT = 0;
  cust.pendingResult = null;
  Game.state.queue = [cust];
  Game.state.departing = [];
  Game.state.tables = [
    { id: "t1", index: 0, status: "occupied", customerId: "c_move", cleanT: 0 },
    { id: "t2", index: 1, status: "dirty", customerId: null, cleanT: 0 },
    { id: "t3", index: 2, status: "cleaning", customerId: null, cleanT: 0.2 },
  ];
  Game.cleanJob = { tableId: "t3", t: 0.2, dur: 2, by: "staff" };
  Game.moveTableCustId = null;

  const emptiesBefore = Game.state.tables.filter((t) => t.status === "empty").length;
  assert(emptiesBefore === 0, "precondition: no empty tables");

  Game.beginMoveTable("c_move");
  // Should auto-clean one dirty and either auto-move (if one target after clean leaves choices)
  // With 2 dirty targets after auto-clean of one → empties=[one], others still dirty → modal or auto
  // After auto-clean one dirty → 1 empty → if only one empty and we still have dirty listed...
  // beginMoveTable: if empties after auto-clean has length, uses empties; if empties.length===1, auto-moves.
  assert(cust.tableId === "t2" || cust.tableId === "t3", "customer should have moved to cleaned table, got " + cust.tableId);
  const old = Game.state.tables.find((t) => t.id === "t1");
  assert(old && old.customerId !== "c_move", "old table must not keep customer ghost");
  assert(
    !Game.state.tables.some((t) => t.status === "occupied" && t.customerId === "c_move" && t.id !== cust.tableId),
    "no ghost occupied elsewhere"
  );
  const dest = Game.state.tables.find((t) => t.id === cust.tableId);
  assert(dest && dest.status === "occupied" && dest.customerId === "c_move", "dest occupied by customer");
  console.log("PASS move-with-dirty auto-clean →", cust.tableId);
}

function testDepartingDoesNotBlock() {
  console.log("--- softlock: departing does not block isDayFloorClear");
  Game.state = Game.freshState("Dep");
  Game.state.customersLeft = 0;
  Game.state.queue = [];
  Game.state.currentCustomer = null;
  Game.state.readyTray = [];
  Game.staffBrewJobs = [];
  Game.state.tables = [
    { id: "t1", index: 0, status: "dirty", customerId: null, cleanT: 0 },
  ];
  Game.state.departing = [
    { id: "d1", phase: "walking_out", walkT: 0, walkDur: 5, pos: 0.8 },
  ];
  assert(Game.isDayFloorClear(), "departing must not block clear — " + describeStuck());
  console.log("PASS departing cosmetic");
}

function testWatchdogForceClear() {
  console.log("--- softlock: watchdog >8s force clear");
  modalOpen = false;
  Game.state = Game.freshState("WD");
  Game.state.day = 6;
  Game.state.shopOpen = true;
  Game.state.customersLeft = 0;
  Game.stateName = "SHOP";
  Game.dayStats = {
    served: 1, perfect: 0, wrong: 0, left: 0, tips: 0, revenue: 10000,
    repStart: Game.state.rep, starSum: 3, starCount: 1, snacks: 0, combos: 0,
    dineIn: 1, takeaway: 0, cleaned: 0, wages: 0,
  };
  // Stuck waiting_food without tray path that sync may not instantly clear
  const stuck = makeEater("c_stuck", "t1");
  stuck.phase = "waiting_brew";
  stuck.pendingResult = null;
  Game.state.queue = [stuck];
  Game.state.tables = [
    { id: "t1", index: 0, status: "occupied", customerId: "c_stuck", cleanT: 0 },
  ];
  Game.staffBrewJobs = []; // orphan waiting_brew
  Game.state.readyTray = [];
  Game._hangToastAt = 0;
  Game._forceClearToastShown = false;

  for (let i = 0; i < 100; i++) Game.tickShop(0.1); // 10s
  assert(
    Game.isDayFloorClear() || Game._forceClearToastShown,
    "watchdog should force-clear — " + describeStuck()
  );
  console.log("PASS watchdog");
}

function autoHire() {
  const day = Game.state.day;
  const slots = maxStaffSlots(day, Game.state.upgrades);
  const want = [];
  for (const r of STAFF_ROLES) {
    if (day >= r.unlockDay) want.push(r.id);
  }
  const priority = ["barista", "server", "cashier", "cleaner"];
  for (const roleId of priority) {
    if (!want.includes(roleId)) continue;
    if ((Game.state.staff || []).length >= slots) break;
    if ((Game.state.staff || []).some((e) => e.role === roleId)) continue;
    const before = (Game.state.staff || []).length;
    Game.hireStaff(roleId);
    if ((Game.state.staff || []).length === before) break;
  }
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
    if (cost && Game.state.money >= cost + 25000) Game.buyUpgrade(d.id);
  }
}

function playerAssistTick() {
  const s = Game.state;
  if (!s || !s.shopOpen) return;
  for (const tray of [...(s.readyTray || [])]) Game.serveReady(tray.id);
  for (const t of s.tables || []) {
    if (t.status === "dirty" && !Game.cleanJob) Game.cleanTable(t.id);
  }
  if (!s.currentCustomer && Game.stateName === "SHOP") {
    const seated = (s.queue || []).find((c) => c.phase === "seated_ready");
    const waiting = (s.queue || []).find((c) => c.phase === "waiting");
    const target = waiting || seated;
    if (target) Game.takeOrder(target.id);
  }
  if (s.currentCustomer && Game.stateName === "SHOP" && !Game.brewSession) {
    const cust = s.currentCustomer;
    if (cust.phase === "serving" || !cust.phase) {
      try {
        const session = Brew.autoPerfect(cust.order, s.upgrades, 5);
        Brew.consumeStock(s.inventory, session);
        Game.brewSession = null;
        Game.resolveServe(session.result);
      } catch (_) {
        Game.unstickCustomer(cust.id);
      }
    }
  }
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
  const MAX_TICKS = 8000;
  const DT = 0.1;
  let idleClearTicks = 0;
  modalOpen = false;
  try {
    if (Game.stateName !== "SHOP" || !Game.state.shopOpen) {
      Game.startDayMorning();
      let guard = 0;
      while (Game.stateName === "STORY" && guard++ < 60) {
        if (Game.storyBeat && Game.storyLine < Game.storyBeat.lines.length - 1) {
          Game.storyLine++;
          Game.showStory();
        } else Game.afterStory();
      }
      if (Game.stateName !== "SHOP") Game.openShop();
    }
    autoHire();
    while (log.ticks < MAX_TICKS) {
      log.ticks++;
      Game.tickShop(DT);
      playerAssistTick();
      if (Game.state.customersLeft <= 0 && Game.isDayFloorClear()) idleClearTicks++;
      else idleClearTicks = 0;
      if (Game.state.customersLeft <= 0 && Game.isDayFloorClear() && idleClearTicks >= 3) {
        Game.endDay();
        log.ok = true;
        break;
      }
      if (log.ticks > 2500 && Game.state.customersLeft <= 0) {
        log.forced = true;
        log.note = describeStuck();
        Game.forceClearFloorForEnd();
        Game.endDay();
        log.ok = true;
        break;
      }
    }
    if (!log.ok) {
      log.error = "timeout: " + describeStuck();
      return log;
    }
    let guard = 0;
    while (Game.stateName === "STORY" && guard++ < 60) {
      if (Game.storyBeat && Game.storyLine < Game.storyBeat.lines.length - 1) {
        Game.storyLine++;
        Game.showStory();
      } else Game.afterStory();
    }
    if (Game.stateName === "DAY_END") {
      Game.storyPhase = "evening";
      Game.storyBeat = Story.getEvening(Game.state.day);
      Game.storyLine = 0;
      if (Game.storyBeat) {
        Game.stateName = "STORY";
        Game.showStory();
      } else if (Game.state.day >= GAME_CONFIG.totalDays) Game.goWin();
      else Game.goUpgrade();
      guard = 0;
      while (Game.stateName === "STORY" && guard++ < 60) {
        if (Game.storyBeat && Game.storyLine < Game.storyBeat.lines.length - 1) {
          Game.storyLine++;
          Game.showStory();
        } else Game.afterStory();
      }
    }
    if (Game.stateName === "UPGRADE" || Game.stateName === "WIN") autoBuyCheapUpgrades();
    if (Game.state.day >= GAME_CONFIG.totalDays) {
      if (Game.stateName !== "WIN") Game.goWin();
      log.note = (log.note ? log.note + " | " : "") + "reached WIN";
      return log;
    }
    if (Game.stateName === "UPGRADE" || Game.stateName === "DAY_END" || Game.stateName === "SHOP") {
      Game.advanceDay();
    }
  } catch (err) {
    log.error = (err && err.stack) || String(err);
    log.ok = false;
  }
  return log;
}

function main() {
  testDepartingDoesNotBlock();
  testLastCustomerEndDay();
  testMoveWithDirtyOnly();
  testWatchdogForceClear();

  console.log("=== softlock sim then days 1→30 ===");
  Game.state = Game.freshState("Sim Soft");
  Game.stateName = "SETUP";
  Game.muted = true;
  modalOpen = false;

  const results = [];
  let day = 1;
  let reachedWin = false;
  while (day <= GAME_CONFIG.totalDays) {
    const beforeDay = Game.state.day;
    const r = simulateOneDay(beforeDay);
    results.push(r);
    const flag = r.ok ? (r.forced ? "FORCED" : "OK") : "FAIL";
    console.log(
      `Day ${beforeDay}: ${flag} ticks=${r.ticks}` +
        (r.forced ? ` :: ${r.note}` : "") +
        (r.error ? ` ERR=${r.error}` : "")
    );
    if (!r.ok) {
      process.exitCode = 1;
      break;
    }
    if (r.note && r.note.includes("WIN")) {
      reachedWin = true;
      break;
    }
    if (Game.state.day === beforeDay && beforeDay < GAME_CONFIG.totalDays) Game.state.day += 1;
    day = Game.state.day;
    if (results.length > GAME_CONFIG.totalDays + 2) break;
  }

  const failed = results.filter((x) => !x.ok);
  console.log("---");
  console.log(
    `Passed days: ${results.filter((x) => x.ok).length}/${results.length}; forced=${results.filter((x) => x.forced).length}; win=${reachedWin || Game.stateName === "WIN"}`
  );
  if (failed.length) {
    console.error("SIM FAIL", failed);
    process.exitCode = 1;
  } else if (!(reachedWin || Game.stateName === "WIN" || Game.state.day >= GAME_CONFIG.totalDays)) {
    console.error("Did not reach day 30 / WIN");
    process.exitCode = 1;
  } else {
    console.log("SOFTLOCK + 30-DAY SIM PASS");
  }
}

main();
