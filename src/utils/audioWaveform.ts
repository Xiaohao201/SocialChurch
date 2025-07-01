export interface WaveformData {
  peaks: number[];
  duration: number;
}

export const generateWaveformData = async (audioBuffer: AudioBuffer, samples = 200): Promise<WaveformData> => {
  const rawData = audioBuffer.getChannelData(0); // Use first channel
  const blockSize = Math.floor(rawData.length / samples);
  const peaks: number[] = [];

  for (let i = 0; i < samples; i++) {
    const start = blockSize * i;
    let sum = 0;
    let max = 0;

    for (let j = 0; j < blockSize; j++) {
      const sample = Math.abs(rawData[start + j] || 0);
      sum += sample;
      max = Math.max(max, sample);
    }

    // Use RMS (root mean square) for better visualization
    const rms = Math.sqrt(sum / blockSize);
    peaks.push(rms);
  }

  // Normalize peaks to 0-1 range
  const maxPeak = Math.max(...peaks);
  const normalizedPeaks = peaks.map(peak => peak / maxPeak);

  return {
    peaks: normalizedPeaks,
    duration: audioBuffer.duration
  };
};

export const loadAudioBuffer = async (src: string): Promise<AudioBuffer> => {
  try {
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.error('Failed to load audio buffer:', error);
    throw error;
  }
};

// Fallback waveform for when audio analysis fails
export const generateFallbackWaveform = (duration: number, samples = 200): WaveformData => {
  const peaks: number[] = [];
  
  for (let i = 0; i < samples; i++) {
    // Generate semi-realistic waveform pattern
    const progress = i / samples;
    const base = 0.3 + 0.4 * Math.sin(progress * Math.PI * 4);
    const noise = (Math.random() - 0.5) * 0.3;
    const envelope = Math.sin(progress * Math.PI); // Natural audio envelope
    
    peaks.push(Math.max(0.05, Math.min(1, base + noise * envelope)));
  }
  
  return { peaks, duration };
}; 