/* ===== BREWING + SNACK PREP MINI-GAME ===== */

const Brew = {
  drinkSteps: ["base", "milk", "topping", "sugar", "ice", "method"],
  snackSteps: ["snack_pick", "snack_method"],
  stepLabels: {
    base: "Chọn trà / base",
    milk: "Chọn sữa",
    topping: "Chọn topping",
    sugar: "Mức đường",
    ice: "Mức đá",
    method: "Lắc / Xay",
    snack_pick: "Chọn món ăn nhẹ",
    snack_method: "Chế biến snack",
  },

  methodLabel(method) {
    if (method === "shake") return "Lắc tay 🥤";
    if (method === "blend") return "Xay blend 🌀";
    if (method === "oven") return "Nướng lò 🔥";
    if (method === "fry") return "Chiên 🍟";
    if (method === "plate") return "Trình bày đĩa 🍽️";
    return method || "—";
  },

  /** order: { type: 'drink'|'snack'|'combo', recipe?, snack? } */
  createSession(order, upgrades) {
    const effects = getEffects(upgrades);
    const type = order.type || "drink";
    let steps = [];
    if (type === "drink") steps = this.drinkSteps.slice();
    else if (type === "snack") steps = this.snackSteps.slice();
    else steps = this.drinkSteps.concat(this.snackSteps);

    const drinkMethod = order.recipe ? order.recipe.method : "shake";
    const speed =
      drinkMethod === "blend" ? effects.blendSpeed : effects.shakeSpeed;

    return {
      order,
      type,
      steps,
      stepIndex: 0,
      selections: {
        base: null,
        milk: null,
        topping: null,
        sugar: null,
        ice: null,
        method: null,
        extraTopping: null,
        snack_pick: null,
        snack_method: null,
      },
      methodProgress: 0,
      methodActive: false,
      methodKind: null, // drink | snack
      startTime: Date.now(),
      shakeSpeed: speed,
      blendSpeed: effects.blendSpeed,
      snackSpeed: effects.snackSpeed,
      hasExtraTopping: effects.extraTopping,
      toppingTipBonus: effects.toppingTipBonus,
      snackStarBonus: effects.snackStarBonus,
      effects,
      done: false,
      result: null,
      drinkDone: type === "snack",
      snackDone: type === "drink",
    };
  },

  currentStep(session) {
    return session.steps[session.stepIndex];
  },

  select(session, field, value) {
    if (session.done) return;
    session.selections[field] = value;
    if (field === "method" || field === "snack_method") return;
    if (session.stepIndex < session.steps.length - 1 && field !== "extraTopping") {
      const step = this.currentStep(session);
      if (field === step) session.stepIndex++;
    }
  },

  goNext(session) {
    if (session.stepIndex < session.steps.length - 1) session.stepIndex++;
  },

  goBack(session) {
    if (session.stepIndex > 0 && !session.methodActive) session.stepIndex--;
  },

  startMethod(session) {
    const step = this.currentStep(session);
    if (step === "method") {
      const needed = session.order.recipe.method;
      session.selections.method = needed;
      session.methodKind = "drink";
      session.methodActive = true;
      session.methodProgress = 0;
    } else if (step === "snack_method") {
      const needed = session.order.snack.method;
      session.selections.snack_method = needed;
      session.methodKind = "snack";
      session.methodActive = true;
      session.methodProgress = 0;
    }
  },

  activeSpeed(session) {
    if (session.methodKind === "snack") return session.snackSpeed || 1;
    if (session.order.recipe && session.order.recipe.method === "blend") {
      return session.blendSpeed || 1;
    }
    return session.shakeSpeed || 1;
  },

  tickMethod(session, dt) {
    if (!session.methodActive || session.done) return false;
    const rate = 28 * this.activeSpeed(session);
    session.methodProgress = Math.min(100, session.methodProgress + rate * dt);
    return this._finishMethodIfDone(session);
  },

  clickShake(session) {
    if (!session.methodActive || session.done) return false;
    session.methodProgress = Math.min(
      100,
      session.methodProgress + 8 * this.activeSpeed(session)
    );
    return this._finishMethodIfDone(session);
  },

  _finishMethodIfDone(session) {
    if (session.methodProgress < 100) return false;
    session.methodActive = false;
    if (session.methodKind === "drink") session.drinkDone = true;
    if (session.methodKind === "snack") session.snackDone = true;

    // If more steps remain (combo: drink method then snack steps), advance
    if (session.stepIndex < session.steps.length - 1) {
      session.stepIndex++;
      session.methodProgress = 0;
      session.methodKind = null;
      return false;
    }

    session.done = true;
    session.result = this.evaluate(session);
    return true;
  },

  evaluate(session) {
    const type = session.type;
    const s = session.selections;
    const elapsed = (Date.now() - session.startTime) / 1000;
    const softLimit = GAME_CONFIG.brewTimeLimit + (session.effects.brewTimeBonus || 0);
    const fastLimit = type === "combo" ? 32 : type === "snack" ? 14 : 20;
    const fast = elapsed <= fastLimit;

    let drinkChecks = null;
    let drinkCorrect = 0;
    let drinkPerfect = true;
    if (type === "drink" || type === "combo") {
      const r = session.order.recipe;
      drinkChecks = {
        base: s.base === r.base,
        milk: s.milk === r.milk,
        topping: s.topping === r.topping,
        sugar: s.sugar === r.sugar,
        ice: s.ice === r.ice,
        method: s.method === r.method,
      };
      drinkCorrect = Object.values(drinkChecks).filter(Boolean).length;
      drinkPerfect = drinkCorrect === 6;
    }

    let snackOk = true;
    let snackPerfect = true;
    if (type === "snack" || type === "combo") {
      const sn = session.order.snack;
      snackOk = s.snack_pick === sn.id && s.snack_method === sn.method;
      snackPerfect = snackOk;
    }

    let quality = "wrong";
    if (type === "drink") {
      if (drinkPerfect) quality = "perfect";
      else if (drinkCorrect >= 5) quality = "ok";
    } else if (type === "snack") {
      if (snackPerfect) quality = "perfect";
      else if (s.snack_pick === session.order.snack.id) quality = "ok";
    } else {
      // combo
      if (drinkPerfect && snackPerfect) quality = "perfect";
      else if (drinkCorrect >= 5 && snackOk) quality = "ok";
      else if (drinkPerfect && !snackPerfect) quality = "ok";
      else if (drinkCorrect >= 4 && snackOk) quality = "ok";
      else quality = "wrong";
    }

    const extraToppingBonus =
      session.hasExtraTopping &&
      s.extraTopping &&
      s.extraTopping !== "none" &&
      session.order.recipe &&
      s.extraTopping !== session.order.recipe.topping;

    return {
      checks: drinkChecks,
      correctCount: drinkCorrect,
      perfect: quality === "perfect",
      quality,
      elapsed,
      fast,
      softLimit,
      extraToppingBonus,
      snackPerfect,
      type,
    };
  },

  consumeStock(inventory, session) {
    const selections = session.selections;
    const type = session.type;

    if (type === "drink" || type === "combo") {
      const keys = ["base", "milk", "topping"];
      const map = { base: BASES, milk: MILKS, topping: TOPPINGS };
      for (const k of keys) {
        const id = selections[k];
        if (!id) continue;
        const item = map[k].find((x) => x.id === id);
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
    }

    if ((type === "snack" || type === "combo") && session.order.snack) {
      const sn = session.order.snack;
      // consume based on what player picked if any, else ordered snack
      const picked = SNACKS.find((x) => x.id === selections.snack_pick) || sn;
      (picked.ingredients || []).forEach((ingId) => {
        if (inventory[ingId] !== undefined) {
          inventory[ingId] = Math.max(0, inventory[ingId] - 1);
        }
      });
    }
  },

  canAffordSelection(inventory, option) {
    if (!option.ingredient) return true;
    return (inventory[option.ingredient] || 0) > 0;
  },

  canAffordSnack(inventory, snack) {
    return (snack.ingredients || []).every((id) => (inventory[id] || 0) > 0);
  },

  /**
   * Staff barista: build a perfect session result without UI.
   * Caller should Brew.consumeStock after. elapsedSec affects fast/star timing.
   */
  autoPerfect(order, upgrades, elapsedSec) {
    const session = this.createSession(order, upgrades);
    const s = session.selections;
    if (order.recipe) {
      s.base = order.recipe.base;
      s.milk = order.recipe.milk;
      s.topping = order.recipe.topping;
      s.sugar = order.recipe.sugar;
      s.ice = order.recipe.ice;
      s.method = order.recipe.method;
    }
    if (order.snack) {
      s.snack_pick = order.snack.id;
      s.snack_method = order.snack.method;
    }
    session.drinkDone = !order.recipe;
    session.snackDone = !order.snack;
    session.done = true;
    session.startTime = Date.now() - Math.max(1, elapsedSec || 5) * 1000;
    session.result = this.evaluate(session);
    if (!session.result || session.result.quality !== "perfect") {
      session.result = session.result || {};
      session.result.quality = "perfect";
      session.result.perfect = true;
      session.result.fast =
        (elapsedSec || 5) <= (order.type === "combo" ? 32 : order.type === "snack" ? 14 : 20);
      session.result.snackPerfect = !!order.snack;
    }
    return session;
  },

};
