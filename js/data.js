/* ===== DATA: recipes, ingredients, NPCs, story, upgrades ===== */

const GAME_CONFIG = {
  shopNameDefault: "Tiệm Trà Nhà Mình",
  startingMoney: 80000,
  startingRep: 2.5,
  maxRep: 5,
  customerPatienceBase: 45, // seconds
  brewTimeLimit: 35, // seconds soft limit
  saveKey: "trasua_shop_save_v1",
  dayGoals: [60000, 100000, 150000], // Day 1–3
  customersPerDay: [4, 5, 6],
  tipChance: 0.35,
  tipRate: 0.15,
};

const INGREDIENTS = {
  tra_den: { id: "tra_den", name: "Trà đen", emoji: "🍵", cost: 3000, stock: 12 },
  tra_xanh: { id: "tra_xanh", name: "Trà xanh", emoji: "🍃", cost: 3500, stock: 8 },
  tra_dao: { id: "tra_dao", name: "Trà đào", emoji: "🍑", cost: 4000, stock: 8 },
  matcha: { id: "matcha", name: "Bột matcha", emoji: "🟢", cost: 5000, stock: 6 },
  cacao: { id: "cacao", name: "Bột cacao", emoji: "🍫", cost: 4500, stock: 6 },
  sua_tuoi: { id: "sua_tuoi", name: "Sữa tươi", emoji: "🥛", cost: 2500, stock: 15 },
  kem_cheese: { id: "kem_cheese", name: "Kem cheese", emoji: "🧀", cost: 6000, stock: 5 },
  khoai_mon: { id: "khoai_mon", name: "Khoai môn", emoji: "🟣", cost: 4000, stock: 6 },
  tran_chau: { id: "tran_chau", name: "Trân châu", emoji: "⚫", cost: 2000, stock: 20 },
  pudding: { id: "pudding", name: "Pudding", emoji: "🍮", cost: 3000, stock: 10 },
  thach: { id: "thach", name: "Thạch", emoji: "🧊", cost: 2500, stock: 12 },
  dao_lat: { id: "dao_lat", name: "Đào lát", emoji: "🍑", cost: 3500, stock: 8 },
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
    unlockDay: 2,
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
    unlockDay: 3,
    base: "cacao",
    milk: "sua_tuoi",
    topping: "tran_chau",
    sugar: "50",
    ice: "100",
    method: "shake",
    desc: "Ngọt ấm cho ngày mệt.",
  },
];

const UPGRADES = [
  {
    id: "fast_shaker",
    name: "Máy lắc nhanh",
    emoji: "⚡",
    cost: 40000,
    desc: "Thanh lắc/blend nhanh hơn 30%.",
    effect: { shakeSpeed: 1.3 },
  },
  {
    id: "extra_topping",
    name: "Kệ topping thêm",
    emoji: "➕",
    cost: 35000,
    desc: "Cho phép chọn thêm 1 topping (điểm thưởng).",
    effect: { extraTopping: true },
  },
  {
    id: "better_sign",
    name: "Bảng hiệu đẹp",
    emoji: "🪧",
    cost: 50000,
    desc: "+1 khách mỗi ngày.",
    effect: { extraCustomer: 1 },
  },
  {
    id: "restock_discount",
    name: "Thẻ thành viên kho",
    emoji: "💳",
    cost: 30000,
    desc: "Giảm 20% giá nhập nguyên liệu.",
    effect: { stockDiscount: 0.2 },
  },
];

const NPCS = {
  linh: {
    id: "linh",
    name: "Linh",
    role: "Sinh viên",
    emoji: "📚",
    mood: "vui",
  },
  anh: {
    id: "anh",
    name: "Anh Hoàng",
    role: "Nhân viên văn phòng",
    emoji: "💼",
    mood: "vội",
  },
  mai: {
    id: "mai",
    name: "Chị Mai",
    role: "Chủ quán hàng xóm",
    emoji: "🌸",
    mood: "thân thiện",
  },
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
  day2_morning: {
    id: "day2_morning",
    title: "Khách quen đầu tiên",
    lines: [
      { speaker: "narrator", text: "Ngày thứ hai. Bạn nhận ra mùi trà quen thuộc hơn rồi." },
      { speaker: "linh", text: "Ê... hôm qua mình uống trà sữa ở đây ngon quá! Mình là Linh, hay học gần đây." },
      { speaker: "you", text: "Chào Linh! Hôm nay muốn gì nào?" },
      { speaker: "linh", text: "Matcha latte ít đường nhé — mình sẽ thành khách quen luôn!" },
    ],
    choice: null,
  },
  day2_evening: {
    id: "day2_evening",
    title: "Kết thúc ngày 2",
    lines: [
      { speaker: "anh", text: "Cảm ơn bạn. Công việc mệt, có ly trà đúng gu là ấm cả ngày." },
      { speaker: "narrator", text: "Bạn cảm thấy quán bắt đầu có 'không khí nhà'." },
    ],
    choice: null,
  },
  day3_morning: {
    id: "day3_morning",
    title: "Một chút cạnh tranh vui",
    lines: [
      { speaker: "mai", text: "Hôm nay chị mở khuyến mãi bên quán chị... đừng lo, hàng xóm cạnh tranh lành mạnh thôi!" },
      { speaker: "you", text: "Được thôi! Trà Nhà Mình cũng có bí quyết riêng." },
      { speaker: "linh", text: "Mình mang bạn cùng lớp tới đây nha! Các bạn thích cacao lắm." },
    ],
    choice: null,
  },
  day3_evening: {
    id: "day3_evening",
    title: "Ba ngày đầu",
    lines: [
      { speaker: "narrator", text: "Ba ngày đã qua. Quán nhỏ vẫn ấm, và bạn đã khác — tự tin hơn." },
      { speaker: "mai", text: "Nhìn bạn vậy là ổn rồi. Cứ giữ nhịp này nhé." },
      { speaker: "you", text: "Trà Nhà Mình... sẽ còn mở lâu dài!" },
    ],
    choice: null,
  },
};

/** Customer name pools */
const CUSTOMER_NAMES = [
  "Minh", "Hà", "Tuấn", "Lan", "Đức", "Vy", "Phúc", "Nhung", "Khoa", "Trang",
  "Huy", "My", "Quân", "Ngọc", "Bảo", "Thảo", "Dũng", "Chi", "Long", "An",
];

const CUSTOMER_EMOJIS = ["😊", "🙂", "😎", "🤓", "😌", "🤗", "😺", "🧑", "👩", "👨"];

/** Star rating flavor (1–5) */
const STAR_FLAVOR = {
  5: ["Xuất sắc! Sẽ quay lại ngay!", "Đỉnh của chóp ✨", "Trà ngon đúng gu!"],
  4: ["Rất ổn, cảm ơn quán!", "Ngon và nhanh!", "Sẽ giới thiệu bạn bè."],
  3: ["Cũng được…", "Tạm ổn trong ngày bận.", "Lần sau nhanh hơn chút nhé."],
  2: ["Không đúng món mình đặt…", "Hơi thất vọng.", "Cần cải thiện công thức."],
  1: ["Tệ quá…", "Mình sẽ không quay lại sớm.", "Phục vụ chưa ổn."],
};

const WALK_CONFIG = {
  inMin: 1.2,
  inMax: 2.5,
  outMin: 1.0,
  outMax: 1.8,
  maxOnFloor: 4,
};
