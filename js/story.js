/* ===== STORY / DIALOGUE ===== */

const Story = {
  getMorning(day, flags) {
    const key = `day${day}_morning`;
    const beat = STORY[key];
    if (!beat) return null;
    // lightly mutate lines based on flags
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
    if (day === 3 && flags.mai_help) {
      lines.push({
        speaker: "mai",
        text: "Khách chị giới thiệu hôm qua khen quán bạn lắm đó.",
      });
    }
    return { ...beat, lines };
  },

  getEvening(day) {
    return STORY[`day${day}_evening`] || null;
  },

  speakerLabel(speaker) {
    if (speaker === "narrator") return "📖";
    if (speaker === "you") return "🧑‍🍳 Bạn";
    const npc = NPCS[speaker];
    if (npc) return `${npc.emoji} ${npc.name}`;
    return speaker;
  },
};
