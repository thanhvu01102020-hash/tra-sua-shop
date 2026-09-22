/* ===== STORY / DIALOGUE ===== */

const Story = {
  getMorning(day, flags) {
    const key = `day${day}_morning`;
    let beat = STORY[key];

    if (!beat && KEY_STORY_DAYS.indexOf(day) === -1) {
      // light filler ~40% of non-key days, else skip straight to shop
      if (day % 4 === 0 || day % 5 === 1) {
        const pool = STORY_FILLER.morning;
        const pick = pool[(day + (flags._storySalt || 0)) % pool.length];
        beat = {
          id: `day${day}_morning_fill`,
          title: `Ngày ${day} · ${pick.title}`,
          lines: pick.lines.map((l) => ({ ...l })),
          choice: null,
        };
      } else {
        return null;
      }
    }
    if (!beat) return null;

    const lines = beat.lines.map((l) => ({ ...l }));
    if (day === 2 && flags.mai_help) {
      lines.push({
        speaker: "mai",
        text: "Chị đã nhắc vài người ghé quán bạn hôm nay đấy!",
      });
    }
    if (day === 2 && flags.solo_pride) {
      lines.push({
        speaker: "narrator",
        text: "Bạn tự hào vì đã chọn tự mình làm quen khách.",
      });
    }
    if (day === 4 && flags.focus_snack) {
      lines.push({
        speaker: "narrator",
        text: "Bạn nhìn kệ snack — quyết định hôm trước đang đơm hoa.",
      });
    }
    if (day === 8 && flags.mai_collab) {
      lines.push({
        speaker: "mai",
        text: "Khuyến mãi chung bắt đầu! Chị gửi khách qua bên bạn vài suất.",
      });
    }
    if (day === 15 && flags.office_orders) {
      lines.push({
        speaker: "anh",
        text: "Team anh order trà chiều hôm nay — khoảng vài suất ổn định.",
      });
    }
    if (day === 22 && flags.study_group) {
      lines.push({
        speaker: "linh",
        text: "Cuối tuần học nhóm mình sẽ ghé đông hơn nha!",
      });
    }

    return { ...beat, lines };
  },

  getEvening(day) {
    const key = `day${day}_evening`;
    if (STORY[key]) return STORY[key];
    if (KEY_STORY_DAYS.indexOf(day) === -1 && (day % 4 === 2 || day === GAME_CONFIG.totalDays - 1)) {
      const pool = STORY_FILLER.evening;
      const pick = pool[day % pool.length];
      return {
        id: `day${day}_evening_fill`,
        title: `Ngày ${day} · ${pick.title}`,
        lines: pick.lines.map((l) => ({ ...l })),
        choice: null,
      };
    }
    return null;
  },

  speakerLabel(speaker) {
    if (speaker === "narrator") return "📖";
    if (speaker === "you") return "🧑‍🍳 Bạn";
    const npc = NPCS[speaker];
    if (npc) return `${npc.emoji} ${npc.name}`;
    return speaker;
  },
};
