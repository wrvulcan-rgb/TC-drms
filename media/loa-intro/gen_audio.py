#!/usr/bin/env python3
# 產生影片音軌＋時間軸：旁白（可插拔）＋配樂（音樂盒開場→玩具鼓組輕快段）＋閃避混音
# 輸出：out/audio_mix.wav（44.1k 立體聲）＋ out/timeline.json（渲染與混音共用）
#
# 旁白來源（依序自動選擇）：
#   1. voice/narr_0.* ~ narr_8.*（Mason 提供：手機錄音或 edge-tts，wav/mp3/m4a 皆可，
#      自動裁頭尾靜音＋響度對齊；腳本見 narration_script.txt）
#   2. --zhtts：本地 zhtts 模型合成（普通話腔，備援用）
#   3. 都沒有 → 無旁白模式（各景用 DESIGN 秒數，配樂不閃避）
#
# 重建流程：python3 gen_audio.py [--zhtts]
#          FFMPEG_BIN=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())") \
#          NODE_PATH=$(npm root -g) node render.js
#          $FFMPEG_BIN -y -i out/video_silent.mp4 -i out/audio_mix.wav -c:v copy -c:a aac -b:a 160k \
#            -movflags +faststart loa_intro_video.mp4
import os, json, math, glob, subprocess, sys, argparse

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
VOICE_DIR = os.path.join(HERE, 'voice')
os.makedirs(OUT, exist_ok=True)

SR = 44100
FPS = 30
N_SCENE = 9
NARR_OFFSET = 0.55   # 旁白相對景首延遲（秒）
TAIL = 0.9           # 旁白說完到換景的緩衝
ZHTTS_PITCH = 1.04   # zhtts 備援聲微升調
FADE_TAIL = 0.8      # 片尾淡出
DESIGN = [6.5, 7.5, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0]  # 各景最短秒數（同 index.html 預設）

# zhtts 備援腳本（餵簡體取音較穩；Mason 錄音版腳本見 narration_script.txt）
ZHTTS_LINES = [
    "哈啰！我是救灾小帮手！一起来看看，我会做什么吧！",
    "灾区讯息又多又急？别担心，一支手机就搞定！任务、回报、物资、平安，通通都在手机里。",
    "功能一，一键报到！到现场点一下，马上完成报到，指挥中心立刻看见。",
    "功能二，任务卡直接送到手上！接单、婉拒，一颗按钮搞定。",
    "功能三，进度随手报！完成、受阻、拍照回传，让每一分用心，都被看见。",
    "功能四，物资三步叫料！选品项、填数量、送出，到货签收也是一键完成。",
    "功能五，一键报平安！安全点名轻松回复，紧急求救，直达干部。",
    "志工、班长、司机、香积、访视、干部，六种角色都有专属选单，长辈也好上手！",
    "快加入好友，跟我们一起守护家园。科技帮忙，温暖不减。感恩！",
]

FFMPEG = subprocess.check_output(
    [sys.executable, '-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']
).decode().strip()


# ---------- 旁白來源 ----------
def find_voice_files():
    files = []
    for i in range(N_SCENE):
        hit = sorted(glob.glob(os.path.join(VOICE_DIR, f'narr_{i}.*')))
        if not hit:
            return None
        files.append(hit[0])
    return files


def prep_clip(src, dst, trim=True, pitch=1.0):
    """任意格式 → 44.1k 單聲道 wav；可裁頭尾靜音、微移調。回傳秒數。"""
    af = []
    if pitch != 1.0:
        sr0 = 24000  # zhtts 固定 24k
        af.append(f'asetrate={sr0}*{pitch},aresample={SR},atempo={1/pitch:.6f}')
    if trim:
        af.append('silenceremove=start_periods=1:start_threshold=-45dB')
        af.append('areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse')
    af.append(f'aresample={SR}')
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', src,
                    '-af', ','.join(af), '-ac', '1', '-ar', str(SR), dst], check=True)
    sr, w = wavfile.read(dst)
    return len(w) / sr


def load_narrations(force_zhtts):
    """回傳 (每段秒數, 波形 list) 或 None（無旁白模式）。各段響度對齊 RMS 0.08。"""
    ext = find_voice_files()
    if ext:
        print('[voice] 使用 voice/ 外部旁白（Mason 提供）')
        durs = [prep_clip(f, f'{OUT}/narr_{i}.wav', trim=True) for i, f in enumerate(ext)]
    elif force_zhtts:
        print('[voice] 使用 zhtts 本地合成（普通話腔備援）')
        need = [i for i in range(N_SCENE) if not os.path.exists(f'{OUT}/narr_{i}_raw.wav')]
        if need:
            import zhtts
            tts = zhtts.TTS()
            for i in need:
                tts.text2wav(ZHTTS_LINES[i], f'{OUT}/narr_{i}_raw.wav')
        durs = [prep_clip(f'{OUT}/narr_{i}_raw.wav', f'{OUT}/narr_{i}.wav',
                          trim=False, pitch=ZHTTS_PITCH) for i in range(N_SCENE)]
    else:
        return None
    waves = []
    for i in range(N_SCENE):
        _, w = wavfile.read(f'{OUT}/narr_{i}.wav')
        w = w.astype(np.float32) / 32768.0
        r = float(np.sqrt((w ** 2).mean()))
        if r > 1e-4:
            w *= 0.08 / r          # 各段響度對齊
        waves.append(np.clip(w, -1, 1))
    return durs, waves


def build_timeline(narr_durs):
    def grid(x):
        return math.ceil(x * FPS) / FPS
    if narr_durs is None:
        durs = [grid(d) for d in DESIGN]
    else:
        durs = [grid(max(d, NARR_OFFSET + nd + TAIL)) for d, nd in zip(DESIGN, narr_durs)]
    starts = [0.0]
    for d in durs[:-1]:
        starts.append(round(starts[-1] + d, 6))
    fade_start = round(starts[-1] + durs[-1], 6)
    total = round(fade_start + FADE_TAIL, 6)
    return durs, starts, fade_start, total


# ---------- 配樂：C 大調 100 BPM，開場音樂盒 → lift 起玩具鼓組輕快段 ----------
def synth_music(T, lift_t):
    n = int(T * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    Lp = np.zeros(n)   # 打擊樂 bus：不進延遲，保持 transient 乾淨
    Rp = np.zeros(n)
    beat = 60 / 100.0
    bar = 4 * beat
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(int(0.6 * SR)).astype(np.float64)

    def f(m):
        return 440.0 * 2 ** ((m - 69) / 12)

    def add(sig, t0, gl, gr, perc=False):
        i = int(t0 * SR)
        if i >= n:
            return
        j = min(n, i + len(sig))
        (Lp if perc else L)[i:j] += sig[:j - i] * gl
        (Rp if perc else R)[i:j] += sig[:j - i] * gr

    def box(midi, t0, amp, tau=0.40, staccato=False):
        if t0 >= T - 0.06:
            return
        dur = min(0.35 if staccato else 1.8, T - t0)
        N = int(dur * SR)
        t = np.arange(N) / SR
        env = np.exp(-t / (0.12 if staccato else tau)) * np.minimum(1, t / 0.004)
        fr = f(midi)
        w = (np.sin(2 * np.pi * fr * t)
             + 0.26 * np.sin(2 * np.pi * fr * 3.01 * t)
             + 0.09 * np.sin(2 * np.pi * fr * 5.4 * t))
        add(amp * env * w, t0, 0.60, 0.80)

    def pad(midis, t0, dur, amp=0.038):
        dur = min(dur, T - t0)
        if dur <= 0.1:
            return
        N = int(dur * SR)
        t = np.arange(N) / SR
        a = np.minimum(1, t / 0.10) * np.minimum(1, np.maximum(0.0, (dur - t) / 0.30))
        s = sum(np.sin(2 * np.pi * f(m) * t) + 0.22 * np.sin(2 * np.pi * f(m) * 2 * t) for m in midis)
        add(amp * a * s / len(midis), t0, 1.0, 1.0)

    def bass(midi, t0, amp=0.10, tau=0.22):
        if t0 >= T - 0.06:
            return
        N = int(min(beat * 0.9, T - t0) * SR)
        t = np.arange(N) / SR
        s = amp * np.exp(-t / tau) * np.minimum(1, t / 0.006) * np.sin(2 * np.pi * f(midi) * t)
        add(s, t0, 1.0, 1.0)

    def stab(midis, t0, amp=0.050):  # 切分伴奏（ukulele 感短促和弦）
        if t0 >= T - 0.06:
            return
        N = int(0.10 * SR)
        t = np.arange(N) / SR
        env = np.exp(-t / 0.045) * np.minimum(1, t / 0.003)
        s = sum(np.sin(2 * np.pi * f(m) * t) for m in midis) * amp * env / len(midis)
        add(s, t0, 0.85, 0.60)

    def kick(t0, amp=0.20):
        N = int(0.10 * SR)
        t = np.arange(N) / SR
        fr = 110 * np.exp(-t / 0.03) + 48
        s = amp * np.exp(-t / 0.045) * np.sin(2 * np.pi * np.cumsum(fr) / SR)
        add(s, t0, 1.0, 1.0, perc=True)

    def hat(t0, amp=0.040):
        N = int(0.030 * SR)
        s = np.diff(noise[:N + 1]) * amp * np.exp(-np.arange(N) / (0.008 * SR))
        add(s, t0, 0.5, 0.7, perc=True)

    def clap(t0, amp=0.095):
        N = int(0.070 * SR)
        t = np.arange(N) / SR
        s = noise[100:100 + N] * amp * np.exp(-t / 0.028) * np.sin(2 * np.pi * 1800 * t) ** 2
        add(s, t0, 0.8, 0.8, perc=True)

    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]  # C Am F G
    roots = [48, 45, 41, 43]
    fifth = [55, 52, 48, 50]
    melody = [
        [76, 79, 84, 79], [81, 76, 72, 76], [77, 81, 84, 81], [79, 83, 86, 83],
        [84, 79, 76, 79], [81, 84, 88, 84], [77, 81, 84, 86], [86, 83, 79, 76],
    ]
    passing = {76: 77, 79: 81, 84: 86, 81: 83, 72: 74, 77: 79, 83: 84, 86: 88, 88: 89}

    lift_bar = max(1, round(lift_t / bar))
    end_calm_t = T - 2 * bar  # 最後兩小節收尾
    t0 = 0.15
    bar_i = 0
    while t0 < T - 0.6:
        ci = bar_i % 4
        upbeat = (bar_i >= lift_bar) and (t0 < end_calm_t)
        phrase = melody[bar_i % 8]
        if not upbeat:
            pad(chords[ci], t0, bar * 1.02)
            bass(roots[ci] - 12, t0, amp=0.085, tau=0.30)
            bass(roots[ci] - 12, t0 + 2 * beat, amp=0.06, tau=0.30)
            for k, m in enumerate(phrase):
                box(m, t0 + k * beat, 0.15)
                if bar_i >= 2 and k % 2 == 1:
                    box(m + 12, t0 + k * beat + beat * 0.5, 0.04)
        else:
            pad(chords[ci], t0, bar * 1.02, amp=0.028)
            for k in range(4):
                bass(roots[ci] if k % 2 == 0 else fifth[ci], t0 + k * beat, amp=0.115, tau=0.15)
                kick(t0 + k * beat) if k in (0, 2) else clap(t0 + k * beat)
                hat(t0 + k * beat, 0.045)
                hat(t0 + (k + 0.5) * beat, 0.068)
                if k in (1, 3):
                    stab([m + 12 for m in chords[ci]], t0 + (k + 0.5) * beat, amp=0.058)
            for k, m in enumerate(phrase):  # 旋律加密：正拍主音＋後半拍經過音
                box(m, t0 + k * beat, 0.155, staccato=False)
                nxt = phrase[(k + 1) % 4]
                mid = passing.get(m, m + 2 if nxt > m else m - 1)
                box(mid, t0 + (k + 0.5) * beat, 0.075, staccato=True)
            if bar_i % 2 == 1:
                box(phrase[0] + 12, t0 + 3.5 * beat, 0.045, staccato=True)
        bar_i += 1
        t0 += bar

    # 收尾：琶音上行＋主和弦鐘聲
    ct = max(end_calm_t, t0 - bar)
    pad([60, 64, 67, 72], ct, T - ct, amp=0.05)
    for k, m in enumerate([72, 76, 79, 84]):
        box(m, ct + k * beat * 0.5, 0.12)
    box(88, ct + 2.4 * beat, 0.10, tau=0.9)

    # 乒乓延遲
    D = int(0.30 * SR)
    Ld, Rd = L.copy(), R.copy()
    g = 0.22
    for r in range(1, 4):
        gl = g ** r
        if D * r >= n:
            break
        src_l, src_r = (Rd, Ld) if r % 2 else (Ld, Rd)
        L[D * r:] += src_l[:n - D * r] * gl
        R[D * r:] += src_r[:n - D * r] * gl

    L += Lp
    R += Rp
    fi = int(0.8 * SR)
    L[:fi] *= np.linspace(0, 1, fi)
    R[:fi] *= np.linspace(0, 1, fi)
    fo = int(2.0 * SR)
    L[-fo:] *= np.linspace(1, 0, fo)
    R[-fo:] *= np.linspace(1, 0, fo)

    peak = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
    k = 0.34 / peak
    return L * k, R * k


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zhtts', action='store_true', help='無 voice/ 檔時強制用 zhtts 合成旁白')
    args = ap.parse_args()

    narr = load_narrations(args.zhtts)
    narr_durs = narr[0] if narr else None
    durs, starts, fade_start, total = build_timeline(narr_durs)
    n = int(total * SR)

    Lm, Rm = synth_music(total, lift_t=starts[2])

    if narr:
        V = np.zeros(n)
        for st, w in zip(starts, narr[1]):
            p = int((st + NARR_OFFSET) * SR)
            V[p:p + len(w)] += w[:max(0, n - p)]
        vp = np.abs(V).max()
        if vp > 0:
            V *= 0.90 / vp
        env = fftconvolve(np.abs(V), np.hanning(int(0.25 * SR)), mode='same')
        env /= max(env.max(), 1e-9)
        duck = 1.0 - 0.58 * np.clip(env * 1.5, 0, 1)
        L = V * 0.97 + Lm * duck
        R = V * 0.97 + Rm * duck
    else:
        L, R = Lm / 0.34 * 0.85, Rm / 0.34 * 0.85  # 無旁白：配樂當主角，峰值 -1.4dB

    peak = max(np.abs(L).max(), np.abs(R).max())
    if peak > 0.95:
        L *= 0.95 / peak
        R *= 0.95 / peak
    wavfile.write(f'{OUT}/audio_mix.wav', SR, (np.stack([L, R], 1) * 32767).astype(np.int16))

    tl = {'fps': FPS, 'total': total, 'fadeStart': fade_start, 'starts': starts, 'durs': durs,
          'narrOffsets': [round(s + NARR_OFFSET, 6) for s in starts] if narr else [],
          'narrDurs': [round(d, 3) for d in narr_durs] if narr else [],
          'voice': ('external' if find_voice_files() else 'zhtts') if narr else 'none'}
    with open(f'{OUT}/timeline.json', 'w') as fp:
        json.dump(tl, fp, indent=1)
    if narr:
        print('narr_durs:', [round(d, 2) for d in narr_durs])
    print('voice:', tl['voice'], ' scene_durs:', durs)
    print('total: %.2fs  lift@%.1fs' % (total, starts[2]))
    print('WROTE out/audio_mix.wav, out/timeline.json')


if __name__ == '__main__':
    main()
