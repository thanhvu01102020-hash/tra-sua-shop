/* ===== BREWING MINI-GAME ===== */

const Brew = {
  steps: ["base", "milk", "topping", "sugar", "ice", "method"],
  stepLabels: {
    base: "Chọn trà / base",
    milk: "Chọn sữa",
    topping: "Chọn topping",
    sugar: "Mức đường",
    ice: "Mức đá",
    method: "Lắc / Xay",
  },

  createSession(order, upgrades) {
    return {
      order,
      stepIndex: 0,
      selections: {
        base: null,
        milk: null,
        topping: null,
        sugar: null,
        ice: null,
        method: null,
        extraTopping: null,
      },
      methodProgress: 0,
      methodActive: false,
      startTime: Date.now(),
      shakeSpeed: upgrades.fast_shaker ? 1.3 : 1,
      hasExtraTopping: !!upgrades.extra_topping,
      done: false,
      result: null,
    };
  },

  currentStep(session) {
    return this.steps[session.stepIndex];
  },

  select(session, field, value) {
    if (session.done) return;
    session.selections[field] = value;
    if (field === "method") {
      // method is started via progress, not one-click
      return;
    }
    // auto-advance for discrete picks
    if (session.stepIndex < this.steps.length - 1 && field !== "extraTopping") {
      const step = this.currentStep(session);
      if (field === step) {
        session.stepIndex++;
      }
    }
  },

  goNext(session) {
    if (session.stepIndex < this.steps.length - 1) {
      session.stepIndex++;
    }
  },

  goBack(session) {
    if (session.stepIndex > 0 && !session.methodActive) {
      session.stepIndex--;
    }
  },

  startMethod(session) {
    const needed = session.order.recipe.method;
    session.selections.method = needed;
    session.methodActive = true;
    session.methodProgress = 0;
  },

  tickMethod(session, dt) {
    if (!session.methodActive || session.done) return false;
    const rate = 28 * session.shakeSpeed; // % per second
    session.methodProgress = Math.min(100, session.methodProgress + rate * dt);
    if (session.methodProgress >= 100) {
      session.methodActive = false;
      session.done = true;
      session.result = this.evaluate(session);
      return true;
    }
    return false;
  },

  clickShake(session) {
    if (!session.methodActive || session.done) return false;
    session.methodProgress = Math.min(100, session.methodProgress + 8 * session.shakeSpeed);
    if (session.methodProgress >= 100) {
      session.methodActive = false;
      session.done = true;
      session.result = this.evaluate(session);
      return true;
    }
    return false;
  },

  evaluate(session) {
    const r = session.order.recipe;
    const s = session.selections;
    const checks = {
      base: s.base === r.base,
      milk: s.milk === r.milk,
      topping: s.topping === r.topping,
      sugar: s.sugar === r.sugar,
      ice: s.ice === r.ice,
      method: s.method === r.method,
    };
    const correctCount = Object.values(checks).filter(Boolean).length;
    const perfect = correctCount === 6;
    const elapsed = (Date.now() - session.startTime) / 1000;
    const fast = elapsed <= 20;
    const ok = correctCount >= 5; // near miss allowed for partial pay

    let quality = "wrong";
    if (perfect) quality = "perfect";
    else if (ok) quality = "ok";

    return {
      checks,
      correctCount,
      perfect,
      quality,
      elapsed,
      fast,
      extraToppingBonus: session.hasExtraTopping && s.extraTopping && s.extraTopping !== "none" && s.extraTopping !== r.topping,
    };
  },

  /** Consume ingredients for the brew attempt (even if wrong). */
  consumeStock(inventory, selections) {
    const keys = ["base", "milk", "topping"];
    const map = { base: BASES, milk: MILKS, topping: TOPPINGS };
    for (const k of keys) {
      const id = selections[k];
      if (!id) continue;
      const list = map[k];
      const item = list.find((x) => x.id === id);
      if (item && item.ingredient && inventory[item.ingredient] !== undefined) {
        inventory[item.ingredient] = Math.max(0, inventory[item.ingredient] - 1);
      }
    }
    if (selections.extraTopping) {
      const item = TOPPINGS.find((x) => x.id === selections.extraTopping);
      if (item && item.ingredient && inventory[item.ingredient] !== undefined) {
        inventory[item.ingredient] = Math.max(0, inventory[item.ingredient] - 1);
      }
    }
  },

  canAffordSelection(inventory, option) {
    if (!option.ingredient) return true;
    return (inventory[option.ingredient] || 0) > 0;
  },
};
