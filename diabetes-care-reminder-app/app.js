const KEYS = {
  waterAmount: "diabetes.waterAmount",
  waterInterval: "diabetes.waterInterval",
  waterLastDrink: "diabetes.waterLastDrink",
  waterTimerRunning: "diabetes.waterTimerRunning",
  dietTimes: "diabetes.dietTimes",
  checks: "diabetes.checks",
  dietNotified: "diabetes.dietNotifiedDate",
  strictMode: "diabetes.strictMode",
  strictState: "diabetes.strictState",
};

const el = {
  enableNotificationBtn: document.getElementById("enableNotificationBtn"),
  installAppBtn: document.getElementById("installAppBtn"),
  permissionStatus: document.getElementById("permissionStatus"),
  installStatus: document.getElementById("installStatus"),

  waterAmount: document.getElementById("waterAmount"),
  waterInterval: document.getElementById("waterInterval"),
  startWaterBtn: document.getElementById("startWaterBtn"),
  stopWaterBtn: document.getElementById("stopWaterBtn"),
  drinkNowBtn: document.getElementById("drinkNowBtn"),
  waterStatus: document.getElementById("waterStatus"),
  waterProgress: document.getElementById("waterProgress"),

  breakfastTime: document.getElementById("breakfastTime"),
  lunchTime: document.getElementById("lunchTime"),
  dinnerTime: document.getElementById("dinnerTime"),
  snackTime: document.getElementById("snackTime"),
  saveDietBtn: document.getElementById("saveDietBtn"),
  dietStatus: document.getElementById("dietStatus"),

  strictModeEnabled: document.getElementById("strictModeEnabled"),
  ackWarningBtn: document.getElementById("ackWarningBtn"),
  emergencyBtn: document.getElementById("emergencyBtn"),
  strictStatus: document.getElementById("strictStatus"),
  riskScore: document.getElementById("riskScore"),

  checkNoAlcohol: document.getElementById("checkNoAlcohol"),
  checkNoSmoking: document.getElementById("checkNoSmoking"),
  checkMeasureSugar: document.getElementById("checkMeasureSugar"),
  checkHadWater: document.getElementById("checkHadWater"),

  toast: document.getElementById("toast"),
};

let waterTimer = null;
let progressTimer = null;
let dietTimer = null;
let strictTimer = null;
let deferredPrompt = null;

function saveLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function loadLocal(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  setTimeout(() => el.toast.classList.remove("show"), 3200);
}

function canNotify() {
  return "Notification" in window;
}

function nowMs() {
  return Date.now();
}

function todayId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateTime(ms) {
  const d = new Date(ms);
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesSince(timestamp) {
  if (!timestamp) return null;
  return Math.floor((nowMs() - timestamp) / 60000);
}

function maybeVibrate(pattern) {
  if ("vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

function notify(title, body, options = {}) {
  showToast(`${title}：${body}`);

  if (options.vibrate) {
    maybeVibrate(options.vibrate);
  }

  if (!canNotify() || Notification.permission !== "granted") {
    return;
  }

  const n = new Notification(title, { body });
  setTimeout(() => n.close(), 8000);
}

function updatePermissionStatus() {
  if (!canNotify()) {
    el.permissionStatus.textContent = "当前浏览器不支持通知。";
    return;
  }

  const status = Notification.permission;
  if (status === "granted") {
    el.permissionStatus.textContent = "通知已开启。";
  } else if (status === "denied") {
    el.permissionStatus.textContent = "通知已被拒绝，请在浏览器设置中开启。";
  } else {
    el.permissionStatus.textContent = "尚未授权通知。";
  }
}

async function requestNotification() {
  if (!canNotify()) {
    showToast("当前浏览器不支持通知");
    return;
  }

  const result = await Notification.requestPermission();
  updatePermissionStatus();

  if (result === "granted") {
    showToast("通知授权成功");
  } else {
    showToast("未开启通知，提醒将仅在页面内展示");
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    el.installStatus.textContent = "当前浏览器不支持离线缓存。";
    return;
  }

  try {
    await navigator.serviceWorker.register("./service-worker.js");
  } catch {
    el.installStatus.textContent = "离线缓存注册失败，可继续使用在线版本。";
  }
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function getInstallHintText() {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);

  if (isIOS) {
    return "iPhone/iPad: 在浏览器分享菜单中选择“添加到主屏幕”。";
  }

  return "如未弹出安装框，请在浏览器菜单中选择“安装应用/添加到桌面”。";
}

async function installApp() {
  if (isStandaloneApp()) {
    showToast("已是桌面应用模式");
    return;
  }

  if (deferredPrompt) {
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      el.installStatus.textContent = "安装请求已确认，完成后可从手机桌面打开。";
    }
    deferredPrompt = null;
    return;
  }

  showToast(getInstallHintText());
  el.installStatus.textContent = getInstallHintText();
}

function initInstallFlow() {
  el.installAppBtn.disabled = false;

  if (isStandaloneApp()) {
    el.installStatus.textContent = "当前已是桌面应用模式。";
  } else {
    el.installStatus.textContent = "建议安装到手机桌面，提醒更容易看到。";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    el.installStatus.textContent = "可安装：点击“安装到手机桌面”。";
    el.installAppBtn.disabled = false;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    el.installStatus.textContent = "已安装到桌面。";
    showToast("安装完成，可从桌面打开");
  });
}

function strictDefaultState() {
  return {
    ackDate: "",
    lastAckNotifyAt: 0,
    lastMediumNotifyAt: 0,
    lastHighNotifyAt: 0,
    lastWaterRiskNotifyAt: 0,
  };
}

function loadStrictState() {
  return loadLocal(KEYS.strictState, strictDefaultState());
}

function saveStrictState(state) {
  saveLocal(KEYS.strictState, state);
}

function isStrictModeEnabled() {
  return !!el.strictModeEnabled.checked;
}

function getChecklistStatus() {
  return {
    noAlcohol: !!el.checkNoAlcohol.checked,
    noSmoking: !!el.checkNoSmoking.checked,
    measureSugar: !!el.checkMeasureSugar.checked,
    hadWater: !!el.checkHadWater.checked,
  };
}

function computeRiskScore() {
  const checks = getChecklistStatus();
  const lastDrink = loadLocal(KEYS.waterLastDrink, null);
  const elapsedDrink = minutesSince(lastDrink);

  let score = 0;
  const reasons = [];

  if (!checks.noAlcohol) {
    score += 2;
    reasons.push("未承诺禁酒");
  }

  if (!checks.noSmoking) {
    score += 2;
    reasons.push("未承诺禁烟");
  }

  if (!checks.measureSugar) {
    score += 3;
    reasons.push("未记录血糖监测");
  }

  if (!checks.hadWater) {
    score += 2;
    reasons.push("未完成喝水打卡");
  }

  if (!lastDrink) {
    score += 2;
    reasons.push("未记录最近喝水");
  } else if (elapsedDrink >= 120) {
    score += 2;
    reasons.push(`已 ${elapsedDrink} 分钟未喝水`);
  }

  const strictState = loadStrictState();
  if (strictState.ackDate !== todayId()) {
    score += 1;
    reasons.push("今日未确认阅读警醒");
  }

  return { score, reasons, elapsedDrink };
}

function updateStrictStatus() {
  if (!isStrictModeEnabled()) {
    el.strictStatus.textContent = "高风险警醒模式已关闭。";
    el.riskScore.textContent = "";
    return;
  }

  const strictState = loadStrictState();
  const { score, reasons } = computeRiskScore();
  const hasAck = strictState.ackDate === todayId();
  const level = score >= 8 ? "高" : score >= 5 ? "中" : "低";

  el.strictStatus.textContent = `今日警醒确认：${hasAck ? "已确认" : "未确认"}。`;

  if (reasons.length === 0) {
    el.riskScore.textContent = "风险评分 0（低）：今日执行较好。";
    return;
  }

  el.riskScore.textContent = `风险评分 ${score}（${level}）：${reasons.join("、")}。`;
}

function acknowledgeWarningToday() {
  const state = loadStrictState();
  state.ackDate = todayId();
  saveStrictState(state);
  updateStrictStatus();
  showToast("已确认今日警醒，请继续按提醒执行");
}

function emergencyReminder() {
  const warning = "出现恶心、呕吐、呼吸急促、嗜睡、意识异常时请立即就医，不要拖延。";
  notify("紧急就医提醒", warning, { vibrate: [240, 120, 240, 120, 360] });
}

function runStrictAlerts() {
  if (!isStrictModeEnabled()) {
    updateStrictStatus();
    return;
  }

  const state = loadStrictState();
  const now = nowMs();
  const hour = new Date().getHours();
  const { score, reasons, elapsedDrink } = computeRiskScore();

  if (state.ackDate !== todayId() && hour >= 10 && now - state.lastAckNotifyAt > 3 * 60 * 60 * 1000) {
    notify("每日警醒未确认", "请点击“我已阅读今天的警醒”，并执行禁酒、禁烟、喝水、测糖。", {
      vibrate: [160, 90, 160],
    });
    state.lastAckNotifyAt = now;
  }

  if (elapsedDrink !== null && elapsedDrink >= 120 && now - state.lastWaterRiskNotifyAt > 90 * 60 * 1000) {
    notify("高风险警醒", "已超过 2 小时未记录喝水，脱水会加重酮体风险，请立即喝水。", {
      vibrate: [180, 100, 180, 100, 180],
    });
    state.lastWaterRiskNotifyAt = now;
  }

  if (score >= 8 && now - state.lastHighNotifyAt > 45 * 60 * 1000) {
    const headline = reasons.slice(0, 3).join("、") || "多项关键行为未执行";
    notify("高风险警醒", `今天风险已偏高：${headline}。请立刻改正，必要时就医。`, {
      vibrate: [260, 120, 260, 120, 260],
    });
    state.lastHighNotifyAt = now;
  } else if (score >= 5 && now - state.lastMediumNotifyAt > 2 * 60 * 60 * 1000) {
    notify("重点提醒", "请尽快完成：喝水打卡、血糖监测、禁烟酒。", {
      vibrate: [180, 120, 180],
    });
    state.lastMediumNotifyAt = now;
  }

  saveStrictState(state);
  updateStrictStatus();
}

function startStrictReminderLoop() {
  if (strictTimer) {
    clearInterval(strictTimer);
  }

  strictTimer = setInterval(runStrictAlerts, 60 * 1000);
  runStrictAlerts();
}

function persistStrictMode() {
  saveLocal(KEYS.strictMode, isStrictModeEnabled());
  updateStrictStatus();

  if (isStrictModeEnabled()) {
    showToast("高风险警醒模式已开启");
  } else {
    showToast("高风险警醒模式已关闭");
  }
}

function loadStrictModeToUI() {
  const strictEnabled = loadLocal(KEYS.strictMode, true);
  el.strictModeEnabled.checked = strictEnabled;
  updateStrictStatus();
}

function updateWaterProgress() {
  const lastDrink = loadLocal(KEYS.waterLastDrink, null);
  const interval = Number(el.waterInterval.value) || 60;

  if (!lastDrink) {
    el.waterProgress.textContent = "尚未记录喝水。";
    return;
  }

  const elapsedMin = minutesSince(lastDrink);
  const remain = interval - elapsedMin;

  if (remain > 0) {
    el.waterProgress.textContent = `距离下次提醒还有 ${remain} 分钟（上次喝水：${formatDateTime(lastDrink)}）`;
  } else {
    el.waterProgress.textContent = `已超过提醒时间 ${Math.abs(remain)} 分钟，建议现在喝水。`;
  }
}

function stopWaterReminder(show = true) {
  if (waterTimer) {
    clearInterval(waterTimer);
    waterTimer = null;
  }

  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }

  saveLocal(KEYS.waterTimerRunning, false);
  el.waterStatus.textContent = "喝水提醒未运行。";
  if (show) showToast("已停止喝水提醒");
}

function startWaterReminder(show = true) {
  const amount = Number(el.waterAmount.value);
  const interval = Number(el.waterInterval.value);

  if (!amount || amount < 50) {
    showToast("请设置合理的喝水量（至少 50ml）");
    return;
  }

  if (!interval || interval < 15) {
    showToast("提醒间隔建议不少于 15 分钟");
    return;
  }

  stopWaterReminder(false);

  waterTimer = setInterval(() => {
    notify("喝水提醒", `请喝约 ${amount} ml 温水，并记录。`);
  }, interval * 60 * 1000);

  progressTimer = setInterval(updateWaterProgress, 30 * 1000);

  saveLocal(KEYS.waterAmount, amount);
  saveLocal(KEYS.waterInterval, interval);
  saveLocal(KEYS.waterTimerRunning, true);

  el.waterStatus.textContent = `喝水提醒已启动：每 ${interval} 分钟提醒一次，每次约 ${amount} ml。`;
  updateWaterProgress();
  if (show) showToast("已启动喝水提醒");
}

function drinkNow() {
  const time = nowMs();
  saveLocal(KEYS.waterLastDrink, time);
  el.checkHadWater.checked = true;
  persistChecks();
  updateWaterProgress();
  updateStrictStatus();
  showToast("已记录本次喝水");
}

function getDietTimes() {
  return {
    breakfast: el.breakfastTime.value,
    lunch: el.lunchTime.value,
    dinner: el.dinnerTime.value,
    snack: el.snackTime.value,
  };
}

function saveDietTimes() {
  const dietTimes = getDietTimes();
  saveLocal(KEYS.dietTimes, dietTimes);
  el.dietStatus.textContent = `已保存：早餐 ${dietTimes.breakfast}，午餐 ${dietTimes.lunch}，晚餐 ${dietTimes.dinner}，加餐 ${dietTimes.snack}`;
  showToast("饮食提醒时间已保存");
}

function loadDietTimesToUI() {
  const saved = loadLocal(KEYS.dietTimes, null);
  if (!saved) return;

  if (saved.breakfast) el.breakfastTime.value = saved.breakfast;
  if (saved.lunch) el.lunchTime.value = saved.lunch;
  if (saved.dinner) el.dinnerTime.value = saved.dinner;
  if (saved.snack) el.snackTime.value = saved.snack;
}

function persistChecks() {
  saveLocal(KEYS.checks, {
    noAlcohol: el.checkNoAlcohol.checked,
    noSmoking: el.checkNoSmoking.checked,
    measureSugar: el.checkMeasureSugar.checked,
    hadWater: el.checkHadWater.checked,
    date: new Date().toDateString(),
  });

  updateStrictStatus();
}

function loadChecks() {
  const checks = loadLocal(KEYS.checks, null);
  if (!checks) return;

  // 仅恢复当天记录，避免跨天误导
  if (checks.date !== new Date().toDateString()) return;

  el.checkNoAlcohol.checked = !!checks.noAlcohol;
  el.checkNoSmoking.checked = !!checks.noSmoking;
  el.checkMeasureSugar.checked = !!checks.measureSugar;
  el.checkHadWater.checked = !!checks.hadWater;
}

function notifyDietReminder(title, advice) {
  notify(title, advice);
}

function checkDietReminders() {
  const times = getDietTimes();
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const todayKey = todayId();
  const notified = loadLocal(KEYS.dietNotified, {});

  const rules = [
    {
      key: "breakfast",
      label: "早餐提醒",
      advice: "优先全谷物+鸡蛋/豆制品，避免油条和甜饮。",
    },
    {
      key: "lunch",
      label: "午餐提醒",
      advice: "半盘蔬菜、四分之一蛋白质、四分之一主食，少盐少油。",
    },
    {
      key: "dinner",
      label: "晚餐提醒",
      advice: "七分饱，主食定量，避免夜宵和酒精。",
    },
    {
      key: "snack",
      label: "加餐提醒",
      advice: "可选择无糖酸奶、少量坚果或低糖水果。",
    },
  ];

  for (const rule of rules) {
    if (!times[rule.key]) continue;
    const notifyKey = `${todayKey}-${rule.key}`;

    if (hhmm === times[rule.key] && !notified[notifyKey]) {
      notifyDietReminder(rule.label, rule.advice);
      notified[notifyKey] = true;
      saveLocal(KEYS.dietNotified, notified);
    }
  }
}

function startDietReminderLoop() {
  if (dietTimer) clearInterval(dietTimer);

  dietTimer = setInterval(checkDietReminders, 30000);
  checkDietReminders();
}

function loadWaterSettings() {
  const waterAmount = loadLocal(KEYS.waterAmount, 250);
  const waterInterval = loadLocal(KEYS.waterInterval, 60);
  const waterLastDrink = loadLocal(KEYS.waterLastDrink, null);

  el.waterAmount.value = waterAmount;
  el.waterInterval.value = waterInterval;

  if (waterLastDrink) {
    el.waterProgress.textContent = `上次喝水：${formatDateTime(waterLastDrink)}`;
  }

  if (loadLocal(KEYS.waterTimerRunning, false)) {
    startWaterReminder(false);
  } else {
    el.waterStatus.textContent = "喝水提醒未运行。";
    updateWaterProgress();
  }
}

function bindEvents() {
  el.enableNotificationBtn.addEventListener("click", requestNotification);
  el.installAppBtn.addEventListener("click", installApp);

  el.startWaterBtn.addEventListener("click", () => startWaterReminder(true));
  el.stopWaterBtn.addEventListener("click", () => stopWaterReminder(true));
  el.drinkNowBtn.addEventListener("click", drinkNow);

  el.saveDietBtn.addEventListener("click", saveDietTimes);

  el.strictModeEnabled.addEventListener("change", persistStrictMode);
  el.ackWarningBtn.addEventListener("click", acknowledgeWarningToday);
  el.emergencyBtn.addEventListener("click", emergencyReminder);

  [
    el.checkNoAlcohol,
    el.checkNoSmoking,
    el.checkMeasureSugar,
    el.checkHadWater,
  ].forEach((node) => node.addEventListener("change", persistChecks));
}

function init() {
  updatePermissionStatus();
  loadWaterSettings();
  loadDietTimesToUI();
  loadChecks();
  loadStrictModeToUI();
  bindEvents();
  initInstallFlow();
  registerServiceWorker();
  startDietReminderLoop();
  startStrictReminderLoop();
}

init();
