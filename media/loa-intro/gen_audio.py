#!/usr/bin/env python3
# 產生影片音軌＋時間軸：全音樂版（節奏與換頁咬合，臺灣吧式頁面重音）＋可插拔旁白
# 輸出：out/audio_mix.wav（44.1k 立體聲）＋ out/timeline.json（渲染與混音共用）
#
# 音樂設計（120 BPM、4/4、bar=2s；各景長度＝整小節數 → 換頁必落小節線）：
#   - 每景和弦循環 C→Am→F→G：頁尾停屬和弦（推力）、新頁回主和弦（到位感）
#   - 換頁瞬間：crash＋kick＋和弦重擊；頁尾最後半拍：鼓 fill＋riser
#   - 輕搖擺（swing 8ths ~58%）、玩具鼓組、音樂盒主旋律 A/B 樂句逐頁輪替
#
# 旁白來源（自動選擇；全音樂版兩者皆無即可）：
#   1. voice/narr_0.*~narr_8.*（外部音檔）  2. --zhtts（本地合成備援）  3. 無 → 全音樂
#
# 重建：python3 gen_audio.py && FFMPEG_BIN=$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())") \
#       NODE_PATH=$(npm root -g) node render.js && $FFMPEG_BIN -y -i out/video_silent.mp4 -i out/audio_mix.wav \
#       -c:v copy -c:a aac -b:a 160k -movflags +faststart loa_intro_video.mp4
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
NARR_OFFSET = 0.55
TAIL = 0.9
ZHTTS_PITCH = 1.04
FADE_TAIL = 0.8
BPM = 120.0
BEAT = 60.0 / BPM          # 0.5s
BAR = 4 * BEAT             # 2.0s
SWING = 0.58               # 8 分音符搖擺比例（直拍=0.5）
DESIGN = [6.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0, 8.0]  # 3+4×8 小節（同 index.html 預設）

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


# ---------- 旁白（插拔） ----------
def find_voice_files():
    files = []
    for i in range(N_SCENE):
        hit = sorted(glob.glob(os.path.join(VOICE_DIR, f'narr_{i}.*')))
        if not hit:
            return None
        files.append(hit[0])
    return files


def prep_clip(src, dst, trim=True, pitch=1.0):
    af = []
    if pitch != 1.0:
        af.append(f'asetrate=24000*{pitch},aresample={SR},atempo={1/pitch:.6f}')
    if trim:
        af.append('silenceremove=start_periods=1:start_threshold=-45dB')
        af.append('areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse')
    af.append(f'aresample={SR}')
    subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', src,
                    '-af', ','.join(af), '-ac', '1', '-ar', str(SR), dst], check=True)
    sr, w = wavfile.read(dst)
    return len(w) / sr


def load_narrations(force_zhtts):
    ext = find_voice_files()
    if ext:
        print('[voice] 使用 voice/ 外部旁白')
        durs = [prep_clip(f, f'{OUT}/narr_{i}.wav', trim=True) for i, f in enumerate(ext)]
    elif force_zhtts:
        print('[voice] 使用 zhtts 本地合成（備援）')
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
            w *= 0.08 / r
        waves.append(np.clip(w, -1, 1))
    return durs, waves


def build_timeline(narr_durs):
    def bar_grid(x):  # 對齊「整小節」再對齊影格（BAR=2s 是 1/30 的倍數，兩者相容）
        return math.ceil(x / BAR) * BAR
    if narr_durs is None:
        durs = [bar_grid(d) for d in DESIGN]
    else:
        durs = [bar_grid(max(d, NARR_OFFSET + nd + TAIL)) for d, nd in zip(DESIGN, narr_durs)]
    starts = [0.0]
    for d in durs[:-1]:
        starts.append(round(starts[-1] + d, 6))
    fade_start = round(starts[-1] + durs[-1], 6)
    total = round(fade_start + FADE_TAIL, 6)
    for s in starts:
        assert abs(s / BAR - round(s / BAR)) < 1e-6, f'scene start {s} 未落在小節線'
    return durs, starts, fade_start, total


# ---------- 全音樂引擎 ----------
def synth_music(T, starts):
    n = int(T * SR)
    L = np.zeros(n); R = np.zeros(n)      # 音高 bus（進延遲）
    Lp = np.zeros(n); Rp = np.zeros(n)    # 打擊 bus（乾）
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(int(1.2 * SR)).astype(np.float64)

    def f(m): return 440.0 * 2 ** ((m - 69) / 12)

    def add(sig, t0, gl, gr, perc=False):
        i = int(t0 * SR)
        if i >= n or i < 0: return
        j = min(n, i + len(sig))
        (Lp if perc else L)[i:j] += sig[:j - i] * gl
        (Rp if perc else R)[i:j] += sig[:j - i] * gr

    def box(midi, t0, amp, tau=0.35, staccato=False):
        if midi is None or t0 >= T - 0.05: return
        dur = min(0.30 if staccato else 1.5, T - t0)
        t = np.arange(int(dur * SR)) / SR
        env = np.exp(-t / (0.10 if staccato else tau)) * np.minimum(1, t / 0.004)
        fr = f(midi)
        w = (np.sin(2*np.pi*fr*t) + 0.26*np.sin(2*np.pi*fr*3.01*t) + 0.09*np.sin(2*np.pi*fr*5.4*t))
        add(amp * env * w, t0, 0.60, 0.80)

    def pad(midis, t0, dur, amp=0.032):
        dur = min(dur, T - t0)
        if dur <= 0.1: return
        t = np.arange(int(dur * SR)) / SR
        a = np.minimum(1, t / 0.08) * np.minimum(1, np.maximum(0.0, (dur - t) / 0.25))
        s = sum(np.sin(2*np.pi*f(m)*t) + 0.22*np.sin(2*np.pi*f(m)*2*t) for m in midis)
        add(amp * a * s / len(midis), t0, 1.0, 1.0)

    def bass(midi, t0, amp=0.115, tau=0.13):
        if t0 >= T - 0.05: return
        t = np.arange(int(min(BEAT * 0.9, T - t0) * SR)) / SR
        s = amp * np.exp(-t / tau) * np.minimum(1, t / 0.006) * np.sin(2*np.pi*f(midi)*t)
        add(s, t0, 1.0, 1.0)

    def stab(midis, t0, amp=0.058):
        if t0 >= T - 0.05: return
        t = np.arange(int(0.09 * SR)) / SR
        env = np.exp(-t / 0.04) * np.minimum(1, t / 0.003)
        s = sum(np.sin(2*np.pi*f(m)*t) for m in midis) * amp * env / len(midis)
        add(s, t0, 0.85, 0.60)

    def kick(t0, amp=0.20):
        t = np.arange(int(0.10 * SR)) / SR
        fr = 110 * np.exp(-t / 0.03) + 48
        add(amp * np.exp(-t / 0.045) * np.sin(2*np.pi*np.cumsum(fr)/SR), t0, 1.0, 1.0, perc=True)

    def hat(t0, amp=0.05):
        N = int(0.030 * SR)
        add(np.diff(noise[:N+1]) * amp * np.exp(-np.arange(N)/(0.008*SR)), t0, 0.5, 0.7, perc=True)

    def clap(t0, amp=0.095):
        N = int(0.070 * SR)
        t = np.arange(N) / SR
        add(noise[100:100+N] * amp * np.exp(-t/0.028) * np.sin(2*np.pi*1800*t)**2, t0, 0.8, 0.8, perc=True)

    def crash(t0, amp=0.075):  # 換頁重音的亮鈸
        N = int(0.7 * SR)
        s = np.diff(noise[200:200+N+1]) * amp * np.exp(-np.arange(N)/(0.18*SR))
        add(s, t0, 0.9, 0.7, perc=True)

    def riser(t_end, amp=0.035, dur=0.35):  # 進頁前的上行氣音
        N = int(dur * SR)
        t = np.arange(N) / SR
        add(noise[400:400+N] * amp * (t/dur)**2, t_end - dur, 0.6, 0.6, perc=True)

    # 和弦（每景內循環：主→…→屬，屬和弦把聽感推向下一頁）
    C, Am, F, G = [60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]
    CH_INTRO = [C, F, G]                # S0（3 小節）
    CH_LOOP  = [C, Am, F, G]            # 4 小節景
    CH_OUT   = [C, F, C, C]             # S8 收尾回家
    ROOT = {tuple(C): 48, tuple(Am): 45, tuple(F): 41, tuple(G): 43}
    FIFTH = {tuple(C): 55, tuple(Am): 52, tuple(F): 48, tuple(G): 50}
    # 主旋律：4 小節樂句 A/B 逐頁輪替（每小節 4 個四分音符）
    PA = [[76,79,84,79],[81,84,88,84],[77,81,84,81],[79,83,86,83]]
    PB = [[84,79,76,79],[88,84,81,84],[81,84,89,86],[86,83,79,77]]
    MEL_INTRO = [[72,76,79,84],[77,81,84,81],[79,83,86,None]]
    MEL_OUT   = [[88,86,84,79],[84,79,76,74],[72,76,79,84],[84,None,None,None]]

    sw = SWING * BEAT  # 搖擺後半拍偏移
    total_bars = int(round((starts[-1] + (T - FADE_TAIL - starts[-1])) / BAR))  # 到 fade_start
    fade_start = T - FADE_TAIL

    b = 0
    t0 = 0.0
    while t0 < fade_start - 1e-6:
        # 此小節屬於哪一景、景內第幾小節
        k = max(i for i, s in enumerate(starts) if t0 >= s - 1e-6)
        bin_scene = int(round((t0 - starts[k]) / BAR))
        n_bars = 3 if k == 0 else 4
        chords = CH_INTRO if k == 0 else (CH_OUT if k == 8 else CH_LOOP)
        ch = chords[bin_scene % len(chords)]
        root, fifth = ROOT[tuple(ch)], FIFTH[tuple(ch)]
        page_turn = (bin_scene == 0 and k >= 1)
        last_bar = (bin_scene == n_bars - 1 and k < N_SCENE - 1)
        mel = (MEL_INTRO if k == 0 else MEL_OUT if k == 8 else (PA if k % 2 == 1 else PB))[bin_scene % n_bars]

        # 換頁重音：crash＋kick＋和弦重擊＋低音
        if page_turn:
            crash(t0)
            kick(t0, 0.24)
            stab([m + 12 for m in ch], t0, 0.10)
            stab(ch, t0 + 0.02, 0.07)
            bass(root - 12, t0, amp=0.15, tau=0.22)

        if k == 0:  # 開場：音樂盒＋柔和墊，無鼓
            pad(ch, t0, BAR * 1.02, amp=0.036)
            bass(root, t0, amp=0.07, tau=0.28)
            for q, m in enumerate(mel):
                box(m, t0 + q * BEAT, 0.15)
        elif k == 8:  # 收尾：重音進場後逐步收
            pad(ch + ([72] if bin_scene >= 2 else []), t0, BAR * 1.02, amp=0.042)
            if bin_scene < 2:
                kick(t0)
                hat(t0 + 2 * BEAT + sw, 0.04)
                bass(root, t0, amp=0.10)
                bass(fifth, t0 + 2 * BEAT, amp=0.08)
            for q, m in enumerate(mel):
                box(m, t0 + q * BEAT, 0.15, tau=0.5)
            if bin_scene == 2:  # 琶音上行
                for q, m in enumerate([72, 76, 79, 84]):
                    box(m, t0 + q * BEAT * 0.5, 0.10, staccato=True)
            if bin_scene == 3:  # 終止鐘聲
                box(84, t0, 0.13, tau=0.9)
                box(88, t0 + BEAT, 0.10, tau=0.9)
        else:  # 功能頁：全律動（輕搖擺玩具鼓組）
            pad(ch, t0, BAR * 1.02, amp=0.026)
            for q in range(4):
                bt = t0 + q * BEAT
                if q in (0, 2):
                    if not (q == 0 and page_turn):
                        kick(bt)
                else:
                    clap(bt)
                hat(bt, 0.040)
                hat(bt + sw, 0.062)                        # 搖擺反拍
                bass(root if q % 2 == 0 else fifth, bt)
                if q in (1, 3):
                    stab([m + 12 for m in ch], bt + sw)     # 反拍切分
            if k == 7:  # 角色頁＝能量頂點：加密 hat
                hat(t0 + 0.5 * BEAT, 0.035)
                hat(t0 + 2.5 * BEAT, 0.035)
            for q, m in enumerate(mel):
                box(m, t0 + q * BEAT, 0.15)
                if k >= 4 and q in (1, 3):
                    box(m + 12, t0 + q * BEAT + sw, 0.045, staccato=True)  # 高八度回聲
            if last_bar:  # 頁尾 fill＋riser
                clap(t0 + 3 * BEAT + 0.5 * BEAT, 0.06)
                clap(t0 + 3 * BEAT + 0.75 * BEAT, 0.085)
                riser(t0 + BAR)
        b += 1
        t0 += BAR

    # 延遲只掛音高 bus（0.25s＝八分音符，節奏內）
    D = int(0.25 * SR)
    Ld, Rd = L.copy(), R.copy()
    g = 0.20
    for r in range(1, 4):
        gl = g ** r
        if D * r >= n: break
        src_l, src_r = (Rd, Ld) if r % 2 else (Ld, Rd)
        L[D*r:] += src_l[:n - D*r] * gl
        R[D*r:] += src_r[:n - D*r] * gl

    L += Lp; R += Rp
    fi = int(0.15 * SR)
    L[:fi] *= np.linspace(0, 1, fi); R[:fi] *= np.linspace(0, 1, fi)
    fo = int(1.6 * SR)
    L[-fo:] *= np.linspace(1, 0, fo); R[-fo:] *= np.linspace(1, 0, fo)
    peak = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
    k = 0.34 / peak
    return L * k, R * k


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--zhtts', action='store_true')
    args = ap.parse_args()

    narr = load_narrations(args.zhtts)
    narr_durs = narr[0] if narr else None
    durs, starts, fade_start, total = build_timeline(narr_durs)
    n = int(total * SR)

    Lm, Rm = synth_music(total, starts)

    if narr:
        V = np.zeros(n)
        for st, w in zip(starts, narr[1]):
            p = int((st + NARR_OFFSET) * SR)
            V[p:p + len(w)] += w[:max(0, n - p)]
        vp = np.abs(V).max()
        if vp > 0: V *= 0.90 / vp
        env = fftconvolve(np.abs(V), np.hanning(int(0.25 * SR)), mode='same')
        env /= max(env.max(), 1e-9)
        duck = 1.0 - 0.58 * np.clip(env * 1.5, 0, 1)
        L = V * 0.97 + Lm * duck
        R = V * 0.97 + Rm * duck
    else:
        L, R = Lm / 0.34 * 0.85, Rm / 0.34 * 0.85

    peak = max(np.abs(L).max(), np.abs(R).max())
    if peak > 0.95:
        L *= 0.95 / peak; R *= 0.95 / peak
    wavfile.write(f'{OUT}/audio_mix.wav', SR, (np.stack([L, R], 1) * 32767).astype(np.int16))

    tl = {'fps': FPS, 'total': total, 'fadeStart': fade_start, 'starts': starts, 'durs': durs,
          'bpm': BPM, 'bar': BAR,
          'narrOffsets': [round(s + NARR_OFFSET, 6) for s in starts] if narr else [],
          'narrDurs': [round(d, 3) for d in narr_durs] if narr else [],
          'voice': ('external' if find_voice_files() else 'zhtts') if narr else 'none'}
    with open(f'{OUT}/timeline.json', 'w') as fp:
        json.dump(tl, fp, indent=1)
    print('voice:', tl['voice'], ' durs:', durs)
    print('total: %.2fs  bpm=%d bar=%.1fs  換頁點=' % (total, BPM, BAR), starts[1:])
    print('WROTE out/audio_mix.wav, out/timeline.json')


if __name__ == '__main__':
    main()
