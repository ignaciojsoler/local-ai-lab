/** The sample rate Whisper was trained on. Anything else is misread. */
export const WHISPER_SAMPLE_RATE = 16000;

/**
 * Mixes a recording down to the single channel the model expects.
 *
 * The channels are averaged rather than summed: a loud stereo clip summed
 * would leave the -1..1 range and arrive at the model as distortion.
 */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) throw new Error("No audio channels to mix");
  if (channels.length === 1) return channels[0];

  const mono = new Float32Array(channels[0].length);
  for (let i = 0; i < mono.length; i += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[i];
    mono[i] = sum / channels.length;
  }
  return mono;
}

/**
 * Decodes any audio the browser can read into the mono 16 kHz samples the
 * model wants.
 *
 * The resampling is the AudioContext's: constructing it at the target rate
 * makes `decodeAudioData` do the conversion, which is both correct and far
 * faster than anything written here.
 */
export async function decodeAudio(data: ArrayBuffer): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE });
  try {
    const buffer = await context.decodeAudioData(data);
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
      buffer.getChannelData(i),
    );
    return toMono(channels);
  } finally {
    void context.close();
  }
}
