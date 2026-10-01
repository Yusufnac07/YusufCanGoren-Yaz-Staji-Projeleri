// AsyncStorage sarmalayicilari: JSON yukle/kaydet (hata durumunda sessizce fallback).
import AsyncStorage from "@react-native-async-storage/async-storage";

export async function loadJSON(key, fallback) {
  try {
    const v = await AsyncStorage.getItem(key);
    return v != null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const KEYS = {
  chat: "chat_history_v1",
  quiz: "quiz_history_v1",
};
