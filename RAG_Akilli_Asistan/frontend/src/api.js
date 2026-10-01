// Backend adresi. Expo Go, dev sunucusuna bilgisayarinin LAN IP'si uzerinden baglanir;
// o IP'yi expo-constants'tan otomatik okuyup backend portuyla (8000) birlestiriyoruz.
// Boylece IP her degistiginde elle guncelleme gerekmez.
// Otomatik cozulemezse (uretim build'i, tarayici vb.) MANUAL_URL'e duser.
import Constants from "expo-constants";

const BACKEND_PORT = 8000;
const MANUAL_URL = "http://192.168.1.112:8000"; // yedek: otomatik bulunamazsa bunu kullanir

function resolveBaseUrl() {
  // Expo dev sunucusunun adresi: "192.168.1.112:8081" gibi (SDK surumune gore farkli alanlarda olabilir).
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;
  const host = hostUri?.split(":")[0];
  if (host && host !== "127.0.0.1" && host !== "localhost") {
    return `http://${host}:${BACKEND_PORT}`;
  }
  return MANUAL_URL;
}

export const BASE_URL = resolveBaseUrl();

// Hata durumunda backend'in dondurdugu Turkce "detail" mesajini kullan (varsa).
async function errMessage(r) {
  try {
    const j = await r.json();
    if (j.detail) return j.detail;
  } catch {}
  return `HTTP ${r.status}`;
}

async function postJSON(path, body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await errMessage(r));
  return r.json();
}
// Streaming sohbet (expo/fetch ReadableStream destekler; RN'in yerlesik fetch'i desteklemez).
// Ilk satir JSON meta ({"sources": [...]}), devami duz metin. onDelta(kismiMetin, meta) ile akar.
import { fetch as expoFetch } from "expo/fetch";
export async function streamChat(message, useContext, onDelta) {
  const r = await expoFetch(`${BASE_URL}/chat-stream`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, use_context: useContext }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", meta = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    if (meta === null) {
      const nl = buf.indexOf("\n");
      if (nl === -1) continue;
      meta = JSON.parse(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
    if (buf) { text += buf; buf = ""; onDelta(text, meta); }
  }
  return { text, meta: meta || { sources: [] } };
}

export function sendChat(message) { return postJSON("/chat", { message }); }
export function askMaterial(message) { return postJSON("/ask", { message }); }
export function runAgent(message) { return postJSON("/agent", { message }); }
export function makeQuiz(konu, adet = 3) { return postJSON("/quiz", { konu, adet }); }
export function gradeAnswer(soru, cevap) { return postJSON("/grade", { soru, cevap }); }
export async function health() { return (await fetch(`${BASE_URL}/health`)).json(); }
export async function getMaterials() { return (await fetch(`${BASE_URL}/materials`)).json(); }
export function resetAll() { return postJSON("/reset", {}); }
export function setProvider(provider) { return postJSON("/provider", { provider }); }

export async function uploadDocument(asset) {
  const form = new FormData();
  form.append("file", { uri: asset.uri, name: asset.name || "belge.pdf", type: asset.mimeType || "application/pdf" });
  const r = await fetch(`${BASE_URL}/upload`, { method: "POST", body: form });
  if (!r.ok) throw new Error(await errMessage(r));
  return r.json();
}
export async function uploadPhoto(asset) {
  const form = new FormData();
  form.append("file", { uri: asset.uri, name: asset.fileName || "foto.jpg", type: asset.mimeType || "image/jpeg" });
  const r = await fetch(`${BASE_URL}/upload-image`, { method: "POST", body: form });
  if (!r.ok) throw new Error(await errMessage(r));
  return r.json();
}
