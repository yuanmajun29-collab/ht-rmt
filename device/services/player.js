const { spawn } = require('child_process');
const EventEmitter = require('events');
const config = require('./config');

// 音频播放状态
const State = { IDLE: 'idle', PLAYING: 'playing', PAUSED: 'paused' };

class AudioPlayer extends EventEmitter {
  constructor() {
    super();
    this.state = State.IDLE;
    this.currentProc = null;
    this.currentPriority = 99;
    this.queue = [];
  }

  // 播放请求入口
  // opts: { audioTone, content, type, priority, duration, ipName }
  play(opts) {
    const priority = opts.priority ?? 5;

    // 当前播放优先级更高（数值更小）→ 排队
    if (this.state === State.PLAYING && priority >= this.currentPriority) {
      this.queue.push(opts);
      console.log(`[播放器] 排队: ${this._desc(opts)} (当前优先级 ${this.currentPriority})`);
      return;
    }

    // 打断当前播放
    if (this.currentProc) {
      console.log(`[播放器] 中断当前播放 (优先级 ${this.currentPriority} → ${priority})`);
      this.currentProc.kill('SIGTERM');
      this.currentProc = null;
    }

    this._startPlay(opts);
  }

  stop() {
    if (this.currentProc) {
      this.currentProc.kill('SIGTERM');
      this.currentProc = null;
    }
    this.queue = [];
    this.state = State.IDLE;
    this.currentPriority = 99;
    console.log('[播放器] 已停止');
  }

  _startPlay(opts) {
    const { audioTone, content, type, priority = 5, duration = 5, ipName } = opts;
    this.currentPriority = priority;
    this.state = State.PLAYING;

    const label = this._desc(opts);
    console.log(`[播放器] 开始播放: ${label}`);

    let proc = null;

    if (type === 'announce' && content) {
      proc = this._tts(content);
    } else if (audioTone) {
      proc = this._tone(audioTone, duration);
    } else if (content) {
      proc = this._tts(content);
    }

    if (!proc) {
      // 无可用后端，模拟播放（打印 + 延时）
      console.log(`[播放器][模拟] ${label}，持续 ${duration}s`);
      const timer = setTimeout(() => this._onPlayEnd(), duration * 1000);
      // 提供伪 kill 接口，与真实进程接口一致
      this.currentProc = { kill: () => clearTimeout(timer) };
      return;
    }

    this.currentProc = proc;

    proc.on('error', (err) => {
      console.error(`[播放器] 进程错误: ${err.message}`);
      this._onPlayEnd();
    });

    proc.on('close', (code) => {
      if (code !== null && code !== 0 && code !== 143 /* SIGTERM */) {
        console.warn(`[播放器] 进程退出码: ${code}`);
      }
      this._onPlayEnd();
    });
  }

  _onPlayEnd() {
    this.currentProc = null;
    this.state = State.IDLE;
    this.currentPriority = 99;
    this.emit('end');

    // 取出优先级最高的排队项播放
    if (this.queue.length > 0) {
      this.queue.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));
      const next = this.queue.shift();
      this._startPlay(next);
    }
  }

  // ── 音频后端 ──────────────────────────────────

  _tone(frequency, duration) {
    const backend = config.audioBackend;
    console.log(`[播放器] 音调 ${frequency}Hz，${duration}s，后端: ${backend}`);

    if (backend === 'sox') {
      // SoX: sudo apt install sox
      return spawn('play', ['-n', 'synth', String(duration), 'sine', String(frequency)],
        { stdio: ['ignore', 'ignore', 'pipe'] });
    }

    if (backend === 'aplay') {
      // 用 ffmpeg 生成 WAV 再经 aplay 播放: sudo apt install ffmpeg alsa-utils
      const ffmpeg = spawn('ffmpeg', [
        '-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=${duration}`,
        '-f', 'wav', '-',
      ], { stdio: ['ignore', 'pipe', 'ignore'] });
      const aplay = spawn('aplay', ['-q', '-f', 'cd'], { stdio: ['pipe', 'ignore', 'ignore'] });
      ffmpeg.stdout.pipe(aplay.stdin);
      ffmpeg.on('close', () => aplay.stdin.end());
      return aplay;
    }

    if (backend === 'beep') {
      // sudo apt install beep (需要 /dev/pcspkr)
      return spawn('beep', ['-f', String(frequency), '-l', String(duration * 1000)],
        { stdio: 'ignore' });
    }

    return null;
  }

  _tts(text) {
    const engine = config.ttsEngine;
    console.log(`[播放器] TTS "${text.slice(0, 30)}..."，引擎: ${engine}`);

    if (engine === 'espeak-ng') {
      // sudo apt install espeak-ng
      return spawn('espeak-ng', ['-v', 'zh', '-s', '150', text],
        { stdio: ['ignore', 'ignore', 'pipe'] });
    }

    if (engine === 'espeak') {
      return spawn('espeak', ['-v', 'zh', text],
        { stdio: ['ignore', 'ignore', 'pipe'] });
    }

    if (engine === 'festival') {
      return spawn('sh', ['-c', `echo "${text.replace(/"/g, '')}" | festival --tts`],
        { stdio: 'ignore' });
    }

    return null;
  }

  _desc({ audioTone, content, type, ipName }) {
    if (type === 'announce') return `口播: "${(content || '').slice(0, 20)}"`;
    if (audioTone) return `${ipName || '音柱'} (${audioTone}Hz)`;
    if (content) return `插播: "${(content || '').slice(0, 20)}"`;
    return type || '未知';
  }

  getStatus() {
    return {
      state: this.state,
      currentPriority: this.currentPriority,
      queueLength: this.queue.length,
    };
  }
}

module.exports = new AudioPlayer();
