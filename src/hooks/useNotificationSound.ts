import { useCallback, useRef } from "react";

export type NotificationSoundType = "trade" | "payment" | "message" | "system" | "kyc";

// Create different notification sounds based on type
const createNotificationSound = (audioContext: AudioContext, type: NotificationSoundType) => {
  const currentTime = audioContext.currentTime;
  
  switch (type) {
    case "trade":
      // Two-tone alert (higher urgency)
      playTwoTone(audioContext, currentTime, 880, 660, 0.15, 0.3);
      break;
    case "payment":
      // Cash register "cha-ching" sound
      playCashSound(audioContext, currentTime);
      break;
    case "message":
      // Soft ping
      playSoftPing(audioContext, currentTime, 600);
      break;
    case "kyc":
      // Success chime (ascending)
      playChime(audioContext, currentTime, [523, 659, 784], 0.12);
      break;
    default:
      // Default notification
      playSoftPing(audioContext, currentTime, 800);
  }
};

// Two-tone alert for trades
const playTwoTone = (ctx: AudioContext, time: number, freq1: number, freq2: number, duration: number, totalDuration: number) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.frequency.setValueAtTime(freq1, time);
  osc.frequency.setValueAtTime(freq2, time + duration);
  osc.frequency.setValueAtTime(freq1, time + duration * 2);
  
  gain.gain.setValueAtTime(0.25, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + totalDuration);
  
  osc.start(time);
  osc.stop(time + totalDuration);
};

// Cash register sound for payments
const playCashSound = (ctx: AudioContext, time: number) => {
  // High sparkle
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.frequency.setValueAtTime(1200, time);
  osc1.frequency.setValueAtTime(1800, time + 0.05);
  gain1.gain.setValueAtTime(0.2, time);
  gain1.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
  osc1.start(time);
  osc1.stop(time + 0.15);
  
  // Lower confirmation tone
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.frequency.setValueAtTime(880, time + 0.08);
  gain2.gain.setValueAtTime(0.15, time + 0.08);
  gain2.gain.exponentialRampToValueAtTime(0.01, time + 0.25);
  osc2.start(time + 0.08);
  osc2.stop(time + 0.25);
};

// Soft ping for messages
const playSoftPing = (ctx: AudioContext, time: number, freq: number) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.frequency.setValueAtTime(freq, time);
  gain.gain.setValueAtTime(0.2, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
  
  osc.start(time);
  osc.stop(time + 0.2);
};

// Ascending chime for success events
const playChime = (ctx: AudioContext, time: number, frequencies: number[], noteDuration: number) => {
  frequencies.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const noteTime = time + i * noteDuration;
    osc.frequency.setValueAtTime(freq, noteTime);
    gain.gain.setValueAtTime(0.18, noteTime);
    gain.gain.exponentialRampToValueAtTime(0.01, noteTime + noteDuration * 1.5);
    
    osc.start(noteTime);
    osc.stop(noteTime + noteDuration * 1.5);
  });
};

export const useNotificationSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastPlayedRef = useRef<number>(0);

  const playNotificationSound = useCallback((type: NotificationSoundType = "system") => {
    // Prevent playing multiple sounds in quick succession (debounce 500ms)
    const now = Date.now();
    if (now - lastPlayedRef.current < 500) {
      return;
    }
    lastPlayedRef.current = now;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      
      if (audioContextRef.current.state === "suspended") {
        audioContextRef.current.resume();
      }
      
      createNotificationSound(audioContextRef.current, type);
    } catch (error) {
      console.error("Error playing notification sound:", error);
    }
  }, []);

  return { playNotificationSound };
};
