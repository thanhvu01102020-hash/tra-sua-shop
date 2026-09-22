/* ===== DATA: recipes, snacks, devices, NPCs, story, scaling ===== */

const GAME_CONFIG = {
  shopNameDefault: "Tiệm Trà Nhà Mình",
  startingMoney: 80000,
  startingRep: 2.5,
  maxRep: 5,
  customerPatienceBase: 45,
  brewTimeLimit: 35,
  saveKey: "trasua_shop_save_v2",
  saveKeyLegacy: "trasua_shop_save_v1",
  totalDays: 30,
  tipChance: 0.28,
  tipRate: 0.15,
  goalBonus: 10000,
};

/** Smooth day goal (~55k day1 → ~420k day30) */
function dayGoal(day) {
  const d = Math.max(1, Math.min(GAME_CONFIG.totalDays, day));
  const raw = 52000 + (d - 1) * 9500 + Math.pow(d / 30, 1.55) * 70000;
  return Math.round(raw / 1000) * 1000;
}

/** Customers per day (~4 day1 → ~12 day30) before device bonuses */
function baseCustomers(day) {
  const d = Math.max(1, Math.min(GAME_CONFIG.totalDays, day));
  return Math.min(13, Math.round(3.6 + d * 0.27));
}

/** Combo order weight 0..1 (rises with day) */
function comboWeight(day) {
  return Math.min(0.55, 0.05 + (day - 1) * 0.018);
}

/** Snack-only weight among non-drink */
function snackOnlyWeight(day) {
  if (day < 2) return 0;
  return Math.min(0.28, 0.08 + (day - 2) * 0.008);
}

const INGREDIENTS = {
  tra_den: { id: "tra_den", name: "Trà đen", emoji: "🍵", cost: 3000, stock: 14, cat: "drink" },
  tra_xanh: { id: "tra_xanh", name: "Trà xanh", emoji: "🍃", cost: 3500, stock: 10, cat: "drink" },
  tra_dao: { id: "tra_dao", name: "Trà đào", emoji: "🍑", cost: 4000, stock: 10, cat: "drink" },
  matcha: { id: "matcha", name: "Bột matcha", emoji: "🟢", cost: 5000, stock: 8, cat: "drink" },
  cacao: { id: "cacao", name: "Bột cacao", emoji: "🍫", cost: 4500, stock: 8, cat: "drink" },
  sua_tuoi: { id: "sua_tuoi", name: "Sữa tươi", emoji: "🥛", cost: 2500, stock: 18, cat: "drink" },
  kem_cheese: { id: "kem_cheese", name: "Kem cheese", emoji: "🧀", cost: 6000, stock: 6, cat: "drink" },
  khoai_mon: { id: "khoai_mon", name: "Khoai môn", emoji: "🟣", cost: 4000, stock: 8, cat: "drink" },
  tran_chau: { id: "tran_chau", name: "Trân châu", emoji: "⚫", cost: 2000, stock: 22, cat: "drink" },
  pudding: { id: "pudding", name: "Pudding", emoji: "🍮", cost: 3000, stock: 12, cat: "drink" },
  thach: { id: "thach", name: "Thạch", emoji: "🧊", cost: 2500, stock: 14, cat: "drink" },
  dao_lat: { id: "dao_lat", name: "Đào lát", emoji: "🍑", cost: 3500, stock: 10, cat: "drink" },
  // snack ingredients
  bot_mi: { id: "bot_mi", name: "Bột mì", emoji: "🌾", cost: 2000, stock: 10, cat: "snack" },
  kem_tuoi: { id: "kem_tuoi", name: "Kem tươi", emoji: "🍦", cost: 4000, stock: 8, cat: "snack" },
  banh_mi: { id: "banh_mi", name: "Bánh mì que", emoji: "🥖", cost: 2500, stock: 10, cat: "snack" },
  dau_phu: { id: "dau_phu", name: "Đậu hũ", emoji: "⬜", cost: 3000, stock: 8, cat: "snack" },
  duong_den: { id: "duong_den", name: "Đường đen", emoji: "🟤", cost: 2000, stock: 10, cat: "snack" },
  khoai_tay: { id: "khoai_tay", name: "Khoai tây", emoji: "🥔", cost: 2800, stock: 10, cat: "snack" },
  dau_an: { id: "dau_an", name: "Dầu ăn", emoji: "🛢️", cost: 1500, stock: 12, cat: "snack" },
  banh_trang: { id: "banh_trang", name: "Bánh tráng", emoji: "🫓", cost: 2200, stock: 10, cat: "snack" },
  xoai_kho: { id: "xoai_kho", name: "Xoài khô / topping", emoji: "🥭", cost: 3500, stock: 8, cat: "snack" },
  bot_matcha_banh: { id: "bot_matcha_banh", name: "Bột matcha bánh", emoji: "🍵", cost: 4500, stock: 6, cat: "snack" },
  trung: { id: "trung", name: "Trứng", emoji: "🥚", cost: 2000, stock: 10, cat: "snack" },
};

const BASES = [
  { id: "tra_den", name: "Trà đen", emoji: "🍵", ingredient: "tra_den" },
  { id: "tra_xanh", name: "Trà xanh", emoji: "🍃", ingredient: "tra_xanh" },
  { id: "tra_dao", name: "Trà đào", emoji: "🍑", ingredient: "tra_dao" },
  { id: "matcha", name: "Matcha", emoji: "🟢", ingredient: "matcha" },
  { id: "cacao", name: "Cacao", emoji: "🍫", ingredient: "cacao" },
  { id: "khoai_mon", name: "Khoai môn", emoji: "🟣", ingredient: "khoai_mon" },
];

const MILKS = [
  { id: "sua_tuoi", name: "Sữa tươi", emoji: "🥛", ingredient: "sua_tuoi" },
  { id: "kem_cheese", name: "Kem cheese", emoji: "🧀", ingredient: "kem_cheese" },
  { id: "none", name: "Không sữa", emoji: "🚫", ingredient: null },
];

const TOPPINGS = [
  { id: "tran_chau", name: "Trân châu", emoji: "⚫", ingredient: "tran_chau" },
  { id: "pudding", name: "Pudding", emoji: "🍮", ingredient: "pudding" },
  { id: "thach", name: "Thạch", emoji: "🧊", ingredient: "thach" },
  { id: "dao_lat", name: "Đào lát", emoji: "🍑", ingredient: "dao_lat" },
  { id: "none", name: "Không topping", emoji: "🚫", ingredient: null },
];

const SUGAR_LEVELS = [
  { id: "0", name: "0% đường" },
  { id: "30", name: "30% đường" },
  { id: "50", name: "50% đường" },
  { id: "70", name: "70% đường" },
  { id: "100", name: "100% đường" },
];

const ICE_LEVELS = [
  { id: "0", name: "Không đá" },
  { id: "50", name: "Ít đá" },
  { id: "100", name: "Đá bình thường" },
];

const RECIPES = [
  {
    id: "ts_truyen_thong",
    name: "Trà sữa truyền thống",
    emoji: "🧋",
    price: 35000,
    unlockDay: 1,
    base: "tra_den",
    milk: "sua_tuoi",
    topping: "tran_chau",
    sugar: "70",
    ice: "100",
    method: "shake",
    desc: "Classics không bao giờ lỗi mốt.",
  },
  {
    id: "tra_dao",
    name: "Trà đào",
    emoji: "🍑",
    price: 40000,
    unlockDay: 1,
    base: "tra_dao",
    milk: "none",
    topping: "dao_lat",
    sugar: "50",
    ice: "100",
    method: "shake",
    desc: "Thanh mát, thơm vị đào.",
  },
  {
    id: "matcha_latte",
    name: "Matcha latte",
    emoji: "🟢",
    price: 45000,
    unlockDay: 1,
    base: "matcha",
    milk: "sua_tuoi",
    topping: "none",
    sugar: "30",
    ice: "50",
    method: "blend",
    desc: "Đắng nhẹ, béo mềm.",
  },
  {
    id: "hong_tra_cheese",
    name: "Hồng trà kem cheese",
    emoji: "🧀",
    price: 50000,
    unlockDay: 2,
    base: "tra_den",
    milk: "kem_cheese",
    topping: "thach",
    sugar: "50",
    ice: "50",
    method: "shake",
    desc: "Lớp kem cheese mặn ngọt.",
  },
  {
    id: "ts_khoai_mon",
    name: "Trà sữa khoai môn",
    emoji: "🟣",
    price: 48000,
    unlockDay: 3,
    base: "khoai_mon",
    milk: "sua_tuoi",
    topping: "pudding",
    sugar: "70",
    ice: "100",
    method: "blend",
    desc: "Tím mộng mơ, thơm khoai.",
  },
  {
    id: "cacao",
    name: "Cacao sữa đá",
    emoji: "🍫",
    price: 42000,
    unlockDay: 5,
    base: "cacao",
    milk: "sua_tuoi",
    topping: "tran_chau",
    sugar: "50",
    ice: "100",
    method: "shake",
    desc: "Ngọt ấm cho ngày mệt.",
  },
];

/** Light snacks — prep via oven / fry / plate */
const SNACKS = [
  {
    id: "banh_mi_que",
    name: "Bánh mì que",
    emoji: "🥖",
    price: 18000,
    unlockDay: 2,
    method: "oven",
    ingredients: ["banh_mi"],
    desc: "Giòn nóng, ăn kèm trà rất hợp.",
  },
  {
    id: "tau_hu",
    name: "Tàu hủ đường đen",
    emoji: "🍮",
    price: 22000,
    unlockDay: 3,
    method: "plate",
    ingredients: ["dau_phu", "duong_den"],
    desc: "Mềm mịn, ngọt thanh.",
  },
  {
    id: "banh_su",
    name: "Bánh su kem",
    emoji: "🧁",
    price: 28000,
    unlockDay: 5,
    method: "oven",
    ingredients: ["bot_mi", "kem_tuoi", "trung"],
    desc: "Vỏ giòn, nhân kem béo.",
  },
  {
    id: "khoai_chien",
    name: "Khoai tây chiên",
    emoji: "🍟",
    price: 25000,
    unlockDay: 7,
    method: "fry",
    ingredients: ["khoai_tay", "dau_an"],
    desc: "Vàng giòn, ăn chơi tuyệt.",
  },
  {
    id: "banh_trang_tron",
    name: "Bánh tráng trộn",
    emoji: "🥗",
    price: 30000,
    unlockDay: 10,
    method: "plate",
    ingredients: ["banh_trang", "xoai_kho"],
    desc: "Chua cay mặn ngọt đủ vị.",
  },
  {
    id: "cookie_matcha",
    name: "Cookie matcha",
    emoji: "🍪",
    price: 32000,
    unlockDay: 14,
    method: "oven",
    ingredients: ["bot_mi", "bot_matcha_banh", "trung"],
    desc: "Thơm matcha, chà bánh với latte.",
  },
];

/**
 * Devices: level 0 (base) → 4 paid upgrades.
 * UI shows "Cấp X/4" where X is current paid level.
 * costs[0] = price to reach level 1, ..., costs[3] = price to reach level 4.
 */
const DEVICES = [
  {
    id: "shaker",
    name: "Máy lắc",
    emoji: "⚡",
    maxLevel: 4,
    costs: [22000, 38000, 58000, 85000],
    blurb: "Tăng tốc lắc tay.",
    effectLine: (lv) => (lv ? `Tốc độ lắc ×${(1 + lv * 0.18).toFixed(2)}` : "Tốc độ lắc cơ bản"),
  },
  {
    id: "blender",
    name: "Máy xay",
    emoji: "🌀",
    maxLevel: 4,
    costs: [24000, 40000, 62000, 90000],
    blurb: "Tăng tốc xay blend.",
    effectLine: (lv) => (lv ? `Tốc độ xay ×${(1 + lv * 0.18).toFixed(2)}` : "Tốc độ xay cơ bản"),
  },
  {
    id: "cooler",
    name: "Tủ lạnh",
    emoji: "🧊",
    maxLevel: 4,
    costs: [20000, 35000, 55000, 80000],
    blurb: "Tăng sức chứa kho khi nhập hàng.",
    effectLine: (lv) => (lv ? `+${lv * 2} suất mỗi lần nhập +5` : "Sức chứa kho cơ bản"),
  },
  {
    id: "tea_brewer",
    name: "Máy pha trà",
    emoji: "🫖",
    maxLevel: 4,
    costs: [28000, 45000, 68000, 95000],
    blurb: "Giảm thời gian pha, khách kiên nhẫn hơn một chút.",
    effectLine: (lv) => (lv ? `Giới hạn pha +${lv * 3}s · kiên nhẫn +${lv * 2}s` : "Pha cơ bản"),
  },
  {
    id: "topping_rack",
    name: "Quầy topping",
    emoji: "➕",
    maxLevel: 4,
    costs: [18000, 32000, 50000, 72000],
    blurb: "Topping thêm & thưởng nhỏ.",
    effectLine: (lv) => {
      if (!lv) return "1 topping / ly";
      if (lv === 1) return "Cho phép topping thêm";
      return `Topping thêm · tip +${(lv - 1) * 1500}đ`;
    },
  },
  {
    id: "sign",
    name: "Bảng hiệu",
    emoji: "🪧",
    maxLevel: 4,
    costs: [30000, 50000, 75000, 110000],
    blurb: "Marketing — thêm khách mỗi ngày.",
    effectLine: (lv) => (lv ? `+${lv} khách / ngày` : "Không bonus khách"),
  },
  {
    id: "seating",
    name: "Hệ thống ghế",
    emoji: "🪑",
    maxLevel: 4,
    costs: [25000, 42000, 65000, 92000],
    blurb: "Khách chờ lâu hơn; chỗ ngồi ấm cúng.",
    effectLine: (lv) => (lv ? `Kiên nhẫn +${lv * 5}s · +${Math.floor(lv / 2)} khách` : "Chỗ đứng cơ bản"),
  },
  {
    id: "pos",
    name: "Máy tính tiền",
    emoji: "💳",
    maxLevel: 4,
    costs: [22000, 38000, 58000, 82000],
    blurb: "Tăng tỉ lệ tip.",
    effectLine: (lv) => (lv ? `Tip +${lv * 8}%` : "Tip cơ bản"),
  },
  {
    id: "oven",
    name: "Lò nướng nhỏ",
    emoji: "🔥",
    maxLevel: 4,
    costs: [26000, 44000, 66000, 96000],
    blurb: "Nhanh hơn & sao món ăn nhẹ cao hơn.",
    effectLine: (lv) =>
      lv ? `Tốc độ snack ×${(1 + lv * 0.2).toFixed(2)} · sao +${lv >= 3 ? 1 : 0}` : "Snack cơ bản",
  },
  {
    id: "display",
    name: "Kệ trưng bày",
    emoji: "🪞",
    maxLevel: 4,
    costs: [20000, 36000, 56000, 78000],
    blurb: "Combo đẹp mắt — tip combo & uy tín nhẹ.",
    effectLine: (lv) => (lv ? `Tip combo +${lv * 2000}đ · uy tín nhẹ` : "Chưa trưng bày"),
  },
];

/** Aggregate gameplay effects from device levels (0–4 each). */
function getEffects(upgrades) {
  const u = upgrades || {};
  const lv = (id) => Math.max(0, Math.min(4, u[id] | 0));
  const sh = lv("shaker");
  const bl = lv("blender");
  const cool = lv("cooler");
  const tea = lv("tea_brewer");
  const top = lv("topping_rack");
  const sign = lv("sign");
  const seat = lv("seating");
  const pos = lv("pos");
  const oven = lv("oven");
  const disp = lv("display");

  return {
    shakeSpeed: 1 + sh * 0.18,
    blendSpeed: 1 + bl * 0.18,
    snackSpeed: 1 + oven * 0.2,
    snackStarBonus: oven >= 3 ? 1 : oven >= 1 ? 0 : 0,
    ovenQualitySoft: oven * 0.08, // soften wrong → ok chance conceptually via stars
    extraTopping: top >= 1,
    toppingTipBonus: top >= 2 ? (top - 1) * 1500 : 0,
    extraCustomers: sign + Math.floor(seat / 2),
    patienceBonus: seat * 5 + tea * 2,
    brewTimeBonus: tea * 3,
    tipChanceBonus: pos * 0.08,
    stockDiscount: cool >= 2 ? 0.05 * (cool - 1) : 0, // lv2–4: 5–15%
    stockBonusQty: cool * 2, // extra units when buying +5
    displayComboTip: disp * 2000,
    displayRepNudge: disp >= 2 ? 0.03 : 0,
  };
}

function deviceUpgradeCost(device, currentLevel) {
  if (currentLevel >= device.maxLevel) return null;
  return device.costs[currentLevel];
}

const NPCS = {
  linh: { id: "linh", name: "Linh", role: "Sinh viên", emoji: "📚", mood: "vui" },
  anh: { id: "anh", name: "Anh Hoàng", role: "Nhân viên văn phòng", emoji: "💼", mood: "vội" },
  mai: { id: "mai", name: "Chị Mai", role: "Chủ quán hàng xóm", emoji: "🌸", mood: "thân thiện" },
};

const STORY = {
  day1_morning: {
    id: "day1_morning",
    title: "Ngày khai trương",
    lines: [
      { speaker: "narrator", text: "Buổi sáng đầu tiên. Cửa kính còn hơi mờ hơi nước." },
      { speaker: "you", text: "Mình... mình làm được chứ? Trà Nhà Mình, mở cửa thôi!" },
      { speaker: "mai", text: "Chào hàng xóm mới! Chị Mai đây — quán trà bên kia đường. Có gì khó cứ ghé chị nhé." },
      { speaker: "you", text: "Cảm ơn chị! Hôm nay mình sẽ cố hết sức." },
    ],
    choice: null,
  },
  day1_evening: {
    id: "day1_evening",
    title: "Kết thúc ngày 1",
    lines: [
      { speaker: "narrator", text: "Đèn quán tắt dần. Tim bạn vẫn đập nhanh vì lần phục vụ đầu." },
      { speaker: "mai", text: "Không tệ đâu! Ngày đầu ai cũng run. Ngày mai nhớ nhập thêm nguyên liệu nhé." },
    ],
    choice: {
      id: "day1_choice",
      prompt: "Chị Mai hỏi: Mai bạn muốn chị giới thiệu thêm khách không?",
      options: [
        { id: "accept_help", label: "Có ạ, cảm ơn chị!", effect: { flag: "mai_help", bonusCustomers: 1 } },
        { id: "solo", label: "Mình muốn tự làm quen khách.", effect: { flag: "solo_pride", repBonus: 0.2 } },
      ],
    },
  },
  day3_morning: {
    id: "day3_morning",
    title: "Món ăn nhẹ đầu tiên",
    lines: [
      { speaker: "narrator", text: "Ngày thứ ba. Bạn nghĩ quán nên có gì nhâm nhi ngoài trà." },
      { speaker: "mai", text: "Thử tàu hủ hoặc bánh mì que đi — khách hay hỏi lắm!" },
      { speaker: "you", text: "Được! Mình sẽ học cách chuẩn bị món ăn nhẹ." },
    ],
    choice: null,
  },
  day3_evening: {
    id: "day3_evening",
    title: "Ba ngày đầu",
    lines: [
      { speaker: "narrator", text: "Ba ngày đã qua. Quán nhỏ vẫn ấm, và bạn đã khác — tự tin hơn." },
      { speaker: "linh", text: "Mình sẽ kéo bạn học tới đây nhiều hơn nha!" },
    ],
    choice: {
      id: "day3_choice",
      prompt: "Cuối tuần gần tới — bạn muốn tập trung gì?",
      options: [
        { id: "focus_drink", label: "Mài tay nghề pha trà.", effect: { flag: "focus_drink", repBonus: 0.1 } },
        { id: "focus_snack", label: "Đầu tư món ăn nhẹ.", effect: { flag: "focus_snack", bonusMoney: 8000 } },
      ],
    },
  },
  day7_morning: {
    id: "day7_morning",
    title: "Một tuần rồi!",
    lines: [
      { speaker: "narrator", text: "Đã được một tuần. Mùi trà và chút dầu nóng từ lò quen thuộc lắm." },
      { speaker: "anh", text: "Mỗi chiều ghé quán bạn thành thói quen rồi. Combo trà + snack là chân ái." },
      { speaker: "you", text: "Cảm ơn anh! Hôm nay khoai chiên lên menu chính thức đó." },
    ],
    choice: null,
  },
  day7_evening: {
    id: "day7_evening",
    title: "Kết thúc tuần 1",
    lines: [
      { speaker: "mai", text: "Nhìn bảng hiệu với ghế mới là thấy quán lớn lên thật." },
      { speaker: "narrator", text: "Bạn ghi sổ: còn 23 ngày nữa trong hành trình tháng đầu." },
    ],
    choice: {
      id: "day7_choice",
      prompt: "Chị Mai rủ hợp tác khuyến mãi chung tuần sau?",
      options: [
        { id: "collab_yes", label: "Làm chung! Win-win.", effect: { flag: "mai_collab", bonusCustomers: 2 } },
        { id: "collab_no", label: "Cảm ơn, mình giữ nhịp riêng.", effect: { flag: "own_pace", repBonus: 0.15 } },
      ],
    },
  },
  day14_morning: {
    id: "day14_morning",
    title: "Nửa tháng",
    lines: [
      { speaker: "narrator", text: "Ngày 14. Cookie matcha thơm phức cạnh máy pha trà." },
      { speaker: "linh", text: "Ê quán nhà mình giờ nhìn 'pro' ghê! Có cả kệ trưng bày nữa." },
      { speaker: "you", text: "Còn nửa tháng nữa — mình muốn giữ chất ấm cúng này." },
    ],
    choice: null,
  },
  day14_evening: {
    id: "day14_evening",
    title: "Giữa chặng đường",
    lines: [
      { speaker: "anh", text: "Công ty hay order trà chiều. Nếu bạn nhận ship nội bộ, anh giới thiệu thêm." },
      { speaker: "narrator", text: "Bạn cân nhắc: mở rộng nhanh hay giữ chất lượng từng ly." },
    ],
    choice: {
      id: "day14_choice",
      prompt: "Nhận đơn văn phòng qua anh Hoàng?",
      options: [
        { id: "office_yes", label: "Nhận! Thêm khách ổn định.", effect: { flag: "office_orders", bonusCustomers: 2, repBonus: 0.1 } },
        { id: "office_no", label: "Chưa — sợ không kịp pha.", effect: { flag: "quality_first", repBonus: 0.2 } },
      ],
    },
  },
  day21_morning: {
    id: "day21_morning",
    title: "Tuần thứ ba",
    lines: [
      { speaker: "narrator", text: "Ngày 21. Quán đã có nhịp riêng — sáng pha trà, chiều nóng lò snack." },
      { speaker: "mai", text: "Hàng xóm bảo khu phố vui hơn nhờ hai quán mình." },
      { speaker: "you", text: "Chín ngày nữa là tròn tháng. Mình hơi hồi hộp..." },
    ],
    choice: null,
  },
  day21_evening: {
    id: "day21_evening",
    title: "Gần về đích",
    lines: [
      { speaker: "linh", text: "Cuối tháng mình tổ chức học nhóm ở đây được không? Tip sẽ hậu hĩnh!" },
      { speaker: "narrator", text: "Ánh đèn vàng trên ghế gỗ — cảm giác như nhà." },
    ],
    choice: {
      id: "day21_choice",
      prompt: "Cho Linh học nhóm cuối tháng?",
      options: [
        { id: "study_yes", label: "Được! Chuẩn bị chỗ ngồi.", effect: { flag: "study_group", bonusCustomers: 2, tipBonusFlag: true } },
        { id: "study_quiet", label: "Giữ không gian yên cho khách lẻ.", effect: { flag: "quiet_shop", patienceFlag: true, repBonus: 0.1 } },
      ],
    },
  },
  day30_morning: {
    id: "day30_morning",
    title: "Ngày thứ ba mươi",
    lines: [
      { speaker: "narrator", text: "Ba mươi ngày. Bạn đứng trước cửa — bảng hiệu đã quen mắt khu phố." },
      { speaker: "mai", text: "Hôm nay là ngày đặc biệt. Chị tự hào về hàng xóm nhỏ này." },
      { speaker: "linh", text: "Trà Nhà Mình mãi đỉnh! Mình mang cả hội tới." },
      { speaker: "anh", text: "Một tháng rồi... cảm ơn vì những ly trà đúng gu." },
      { speaker: "you", text: "Mở cửa ngày cuối của tháng đầu tiên nào!" },
    ],
    choice: null,
  },
  day30_evening: {
    id: "day30_evening",
    title: "Khép lại tháng đầu",
    lines: [
      { speaker: "narrator", text: "Đèn tắt. Bạn nhìn sổ thu chi — không chỉ là số, mà là từng khuôn mặt khách." },
      { speaker: "mai", text: "Tháng sau còn dài. Nhưng tháng này, bạn đã chứng minh Trà Nhà Mình thuộc về nơi này." },
      { speaker: "you", text: "Cảm ơn mọi người. Hẹn tháng sau… và nhiều ly trà nữa." },
    ],
    choice: null,
  },
};

/** Soft morning/evening lines for non-key days (optional flavor) */
const STORY_FILLER = {
  morning: [
    { title: "Buổi sáng mới", lines: [{ speaker: "narrator", text: "Nắng nhẹ. Bạn mở cửa, máy pha trà ấm dần." }] },
    { title: "Chuẩn bị trong ngày", lines: [{ speaker: "you", text: "Kiểm tra kho, lau quầy — sẵn sàng đón khách!" }] },
    { title: "Một ngày bình yên", lines: [{ speaker: "narrator", text: "Phố bắt đầu ồn. Quán nhỏ của bạn cũng thức dậy." }] },
  ],
  evening: [
    { title: "Đóng cửa", lines: [{ speaker: "narrator", text: "Bạn ghi doanh thu, mỉm cười với một ngày đã qua." }] },
    { title: "Tối yên", lines: [{ speaker: "you", text: "Mai lại cố hơn… và nhớ nhập hàng." }] },
  ],
};

const KEY_STORY_DAYS = [1, 3, 7, 14, 21, 30];

const CUSTOMER_NAMES = [
  "Minh", "Hà", "Tuấn", "Lan", "Đức", "Vy", "Phúc", "Nhung", "Khoa", "Trang",
  "Huy", "My", "Quân", "Ngọc", "Bảo", "Thảo", "Dũng", "Chi", "Long", "An",
  "Yến", "Phát", "Hằng", "Tâm", "Quỳnh",
];

const CUSTOMER_EMOJIS = ["😊", "🙂", "😎", "🤓", "😌", "🤗", "😺", "🧑", "👩", "👨", "🧔", "👱"];

const STAR_FLAVOR = {
  5: ["Xuất sắc! Sẽ quay lại ngay!", "Đỉnh của chóp ✨", "Đúng gu quá!"],
  4: ["Rất ổn, cảm ơn quán!", "Ngon và nhanh!", "Sẽ giới thiệu bạn bè."],
  3: ["Cũng được…", "Tạm ổn trong ngày bận.", "Lần sau nhanh hơn chút nhé."],
  2: ["Không đúng món mình đặt…", "Hơi thất vọng.", "Cần cải thiện."],
  1: ["Tệ quá…", "Mình sẽ không quay lại sớm.", "Phục vụ chưa ổn."],
};

const WALK_CONFIG = {
  inMin: 1.2,
  inMax: 2.5,
  outMin: 1.0,
  outMax: 1.8,
  maxOnFloor: 4,
};

/** Legacy boolean upgrades → new device levels (migration). */
const LEGACY_UPGRADE_MAP = {
  fast_shaker: { id: "shaker", level: 2 },
  extra_topping: { id: "topping_rack", level: 1 },
  better_sign: { id: "sign", level: 1 },
  restock_discount: { id: "cooler", level: 2 },
};
