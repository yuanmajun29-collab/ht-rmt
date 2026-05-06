class Scheduler {
  constructor(db, onTrigger) {
    this.db = db;
    this.onTrigger = onTrigger;
    this.timer = null;
  }

  start() {
    // 对齐到下一个整分钟再开始
    const now = new Date();
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    setTimeout(() => {
      this.tick();
      this.timer = setInterval(() => this.tick(), 60000);
    }, delay);
    console.log(`[调度器] 已启动，将在 ${Math.ceil(delay / 1000)}s 后首次检查`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  tick() {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const date = now.toISOString().slice(0, 10);
    const dow = now.getDay(); // 0=周日

    const active = this.db.prepare(
      "SELECT * FROM schedules WHERE status = 'active' AND scheduled_time = ?"
    ).all(time);

    for (const s of active) {
      const fire =
        s.repeat_type === 'once'     ? s.scheduled_date === date :
        s.repeat_type === 'daily'    ? true :
        s.repeat_type === 'workdays' ? (dow >= 1 && dow <= 5) :
        s.repeat_type === 'weekly'   ? JSON.parse(s.days_of_week || '[]').includes(dow) : false;

      if (!fire) continue;

      try {
        this.onTrigger(s);
        if (s.repeat_type === 'once') {
          this.db.prepare("UPDATE schedules SET status = 'completed', updated_at = ? WHERE id = ?")
            .run(new Date().toISOString(), s.id);
        }
        console.log(`[调度器] ✓ 触发计划: ${s.name}`);
      } catch (err) {
        console.error(`[调度器] ✗ 计划执行失败 ${s.name}:`, err.message);
      }
    }
  }
}

module.exports = Scheduler;
