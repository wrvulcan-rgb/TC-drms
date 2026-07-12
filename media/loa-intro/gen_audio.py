#!/usr/bin/env python3
# 產生旁白（zhtts 本地 fastspeech2 模型）＋音樂盒配樂＋閃避混音
# 輸出：out/audio_mix.wav（44.1k 立體聲）＋ out/timeline.json（逐格渲染與混音共用的時間軸）
# 用法：python3 gen_audio.py（旁白 wav 已存在則跳過合成，改字請刪 out/narr_*_raw.wav）
import os, json, math, subprocess, sys

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '3')
import numpy as np
from scipy.io import wavfile
from scipy.signal import fftconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

SR = 44100
FPS = 30
NARR_OFFSET = 0.55   # 旁白相對景首的進場延遲（秒）
TAIL = 0.9           # 旁白說完到換景的緩衝
PITCH = 1.04         # 旁白微升調（可愛化，時長用 atempo 補償）
FADE_TAIL = 0.8      # 片尾淡出長度
DESIGN = [6.5, 7.5, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0]  # 各景最短秒數（同 index.html 預設）

# 螢幕字幕為繁體；TTS 餵簡體（pypinyin 取音較穩），避免英文與阿拉伯數字
LINES = [
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


def synth_narrations():
    """zhtts 合成各景旁白 → 微升調＋重取樣至 44.1k 單聲道。回傳每段秒數。"""
    need = [i for i in range(len(LINES)) if not os.path.exists(f'{OUT}/narr_{i}_raw.wav')]
    if need:
        import zhtts
        tts = zhtts.TTS()  # FASTSPEECH2 + MB-MELGAN
        for i in need:
            tts.text2wav(LINES[i], f'{OUT}/narr_{i}_raw.wav')
            print(f'[tts] narr_{i} done')
    durs = []
    for i in range(len(LINES)):
        raw = f'{OUT}/narr_{i}_raw.wav'
        proc = f'{OUT}/narr_{i}.wav'
        sr0, _ = wavfile.read(raw)
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', raw, '-af',
                        f'asetrate={sr0}*{PITCH},aresample={SR},atempo={1/PITCH:.6f}',
                        '-ac', '1', proc], check=True)
        sr, w = wavfile.read(proc)
        assert sr == SR
        durs.append(len(w) / SR)
    return durs


def build_timeline(narr_durs):
    def grid(x):  # 對齊影格
        return math.ceil(x * FPS) / FPS
    durs = [grid(max(d, NARR_OFFSET + nd + TAIL)) for d, nd in zip(DESIGN, narr_durs)]
    starts = [0.0]
    for d in durs[:-1]:
        starts.append(round(starts[-1] + d, 6))
    fade_start = round(starts[-1] + durs[-1], 6)
    total = round(fade_start + FADE_TAIL, 6)
    return durs, starts, fade_start, total


# ---------- 音樂盒配樂（C 大調，92 BPM，C–Am–F–G） ----------
def synth_music(T):
    n = int(T * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    beat = 60 / 92.0
    bar = 4 * beat

    def f(m):
        return 440.0 * 2 ** ((m - 69) / 12)

    def box(midi, t0, amp):  # 音樂盒單音：微失諧泛音＋指數衰減
        if t0 >= T - 0.06:
            return
        dur = min(2.0, T - t0)
        N = int(dur * SR)
        t = np.arange(N) / SR
        env = np.exp(-t / 0.42) * np.minimum(1, t / 0.004)
        fr = f(midi)
        w = (np.sin(2 * np.pi * fr * t)
             + 0.26 * np.sin(2 * np.pi * fr * 3.01 * t)
             + 0.09 * np.sin(2 * np.pi * fr * 5.4 * t))
        s = amp * env * w
        i = int(t0 * SR)
        j = min(n, i + N)
        L[i:j] += s[:j - i] * 0.60
        R[i:j] += s[:j - i] * 0.80

    def pad(midis, t0, amp=0.040):  # 柔和和弦墊
        dur = min(bar * 1.02, T - t0)
        if dur <= 0.1:
            return
        N = int(dur * SR)
        t = np.arange(N) / SR
        a = np.minimum(1, t / 0.10) * np.minimum(1, np.maximum(0.0, (dur - t) / 0.30))
        s = sum(np.sin(2 * np.pi * f(m) * t) + 0.22 * np.sin(2 * np.pi * f(m) * 2 * t) for m in midis)
        s = amp * a * s / len(midis)
        i = int(t0 * SR)
        j = min(n, i + N)
        L[i:j] += s[:j - i]
        R[i:j] += s[:j - i]

    def bass(midi, t0, amp=0.085):
        if t0 >= T - 0.06:
            return
        N = int(min(beat * 0.95, T - t0) * SR)
        t = np.arange(N) / SR
        s = amp * np.exp(-t / 0.30) * np.minimum(1, t / 0.006) * np.sin(2 * np.pi * f(midi) * t)
        i = int(t0 * SR)
        j = min(n, i + N)
        L[i:j] += s[:j - i]
        R[i:j] += s[:j - i]

    # 8 小節固定旋律（音符, 拍長），配 C Am F G ×2
    chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
    roots = [36, 33, 29, 31]
    melody = [
        [(76, 1), (79, 1), (84, 1), (79, 1)],          # C:  E5 G5 C6 G5
        [(81, 1), (76, 1), (72, 1), (76, 1)],          # Am: A5 E5 C5→C5 E5
        [(77, 1), (81, 1), (84, 1), (81, 1)],          # F:  F5 A5 C6 A5
        [(79, 1), (83, 1), (86, 1), (83, 1)],          # G:  G5 B5 D6 B5
        [(84, 1), (79, 1), (76, 1), (79, 1)],          # C
        [(81, 1), (84, 1), (88, 1), (84, 1)],          # Am
        [(77, 1), (81, 1), (84, 1), (86, 1)],          # F
        [(86, 1), (83, 1), (79, 1), (76, 1)],          # G（收回 C）
    ]
    t0 = 0.15
    bar_i = 0
    while t0 < T - 1.0:
        ci = bar_i % 4
        pad(chords[ci], t0)
        bass(roots[ci], t0)
        bass(roots[ci], t0 + 2 * beat, amp=0.06)
        phrase = melody[bar_i % 8]
        tt = t0
        second_pass = (bar_i // 8) % 2 == 1
        for (m, b) in phrase:
            box(m, tt, 0.150)
            if second_pass:  # 第二輪加高八度回聲，增加閃爍感
                box(m + 12, tt + beat * 0.5, 0.045)
            tt += b * beat
        bar_i += 1
        t0 += bar

    # 乒乓延遲
    D = int(0.31 * SR)
    Ld, Rd = L.copy(), R.copy()
    g = 0.24
    for r in range(1, 4):
        gl = g ** r
        if D * r >= n:
            break
        src_l, src_r = (Rd, Ld) if r % 2 else (Ld, Rd)
        L[D * r:] += src_l[:n - D * r] * gl
        R[D * r:] += src_r[:n - D * r] * gl

    # 淡入淡出
    fi = int(0.8 * SR)
    L[:fi] *= np.linspace(0, 1, fi)
    R[:fi] *= np.linspace(0, 1, fi)
    fo = int(2.5 * SR)
    L[-fo:] *= np.linspace(1, 0, fo)
    R[-fo:] *= np.linspace(1, 0, fo)

    peak = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
    return L / peak * 0.30, R / peak * 0.30


def main():
    narr_durs = synth_narrations()
    durs, starts, fade_start, total = build_timeline(narr_durs)
    n = int(total * SR)

    # 旁白軌（單聲道置中）
    V = np.zeros(n)
    for i, st in enumerate(starts):
        _, w = wavfile.read(f'{OUT}/narr_{i}.wav')
        w = w.astype(np.float32) / 32768.0
        p = int((st + NARR_OFFSET) * SR)
        V[p:p + len(w)] += w[:max(0, n - p)]
    vp = np.abs(V).max()
    if vp > 0:
        V *= 0.90 / vp

    Lm, Rm = synth_music(total)

    # 閃避：旁白包絡壓低配樂
    env = fftconvolve(np.abs(V), np.hanning(int(0.25 * SR)), mode='same')
    env /= max(env.max(), 1e-9)
    duck = 1.0 - 0.58 * np.clip(env * 1.5, 0, 1)
    Lm *= duck
    Rm *= duck

    L = V * 0.97 + Lm
    R = V * 0.97 + Rm
    peak = max(np.abs(L).max(), np.abs(R).max())
    if peak > 0.95:
        L *= 0.95 / peak
        R *= 0.95 / peak
    mix = (np.stack([L, R], 1) * 32767).astype(np.int16)
    wavfile.write(f'{OUT}/audio_mix.wav', SR, mix)

    tl = {'fps': FPS, 'total': total, 'fadeStart': fade_start,
          'starts': starts, 'durs': durs,
          'narrOffsets': [round(s + NARR_OFFSET, 6) for s in starts],
          'narrDurs': [round(d, 3) for d in narr_durs]}
    with open(f'{OUT}/timeline.json', 'w') as fp:
        json.dump(tl, fp, indent=1)
    print('narr_durs:', [round(d, 2) for d in narr_durs])
    print('scene_durs:', durs)
    print('total: %.2fs  fade_start: %.2fs' % (total, fade_start))
    print('WROTE out/audio_mix.wav, out/timeline.json')


if __name__ == '__main__':
    main()
