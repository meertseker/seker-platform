// Tarayıcıda seçilen videonun süresi ve boyutu (spec K17). Gizli <video preload="metadata"> ile okunur;
// videoWidth/videoHeight döndürme üst verisini uygular (Chrome/Safari; eski Android TEYİTSİZ).

export type VideoProbe = { durationS: number; width: number; height: number };

/** Saf: <video> öğesinin değerlerinden sonuç; okunamazsa null. */
export function probeResult(video: { duration: number; videoWidth: number; videoHeight: number }): VideoProbe | null {
  const { duration, videoWidth, videoHeight } = video;
  if (!Number.isFinite(duration) || duration <= 0) return null;
  if (!(videoWidth > 0) || !(videoHeight > 0)) return null;
  return { durationS: duration, width: videoWidth, height: videoHeight };
}

/** Okunamazsa ya da süre dolarsa null (çağıran yüklemeyi engeller). */
export function probeVideo(file: File, timeoutMs = 4000): Promise<VideoProbe | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;
    const done = (value: VideoProbe | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(value);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => done(probeResult(video));
    video.onerror = () => done(null);
    video.src = url;
  });
}
