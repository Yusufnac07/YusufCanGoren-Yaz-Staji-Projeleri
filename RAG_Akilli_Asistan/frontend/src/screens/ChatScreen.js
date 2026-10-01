// Sohbet: baloncuklu kalici gecmis (AsyncStorage) + streaming cevap + iki mod.
// Her mod (genel / materyalden) KENDI konusmasini tutar — mod anahtari sohbetler
// arasinda gecis yapar. Streaming basarisiz olursa eski /chat ve /ask uclarina duser.
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Alert,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { sendChat, askMaterial, streamChat } from "../api";
import { loadJSON, saveJSON, KEYS } from "../storage";
import { c, sp, radius } from "../theme";
import { Chip, EmptyState } from "../components";

let nextId = 1;

// Cevap metnindeki [kaynak N] atiflarini bulup SADECE atif yapilan kaynaklari birak.
// Model 6 kaynaktan 2'sini kullandiysa yalnizca o 2'sini listeleriz.
// Hic atif yoksa (or. "bulamadim") kaynak gosterilmez.
function citedSources(answer, sources) {
  if (!sources || !sources.length) return [];
  const cited = new Set();
  const re = /kaynak\s*(\d+)/gi;
  let mm;
  while ((mm = re.exec(answer || "")) !== null) cited.add(parseInt(mm[1], 10));
  return sources.filter((s) => cited.has(s.n));
}

export default function ChatScreen() {
  // Mod basina ayri konusma: { chat: [...], ask: [...] }
  const [convos, setConvos] = useState({ chat: [], ask: [] });
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("chat"); // "chat" | "ask"
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const listRef = useRef(null);
  // Klavye offset'i: ekranin pencere icindeki GERCEK y konumu (header + status bar).
  // Sabit deger cihaza gore yanlis kaliyordu (centikli iPhone'da input klavye altinda kaliyordu).
  const wrapRef = useRef(null);
  const [kavOffset, setKavOffset] = useState(0);

  const messages = convos[mode];

  // Gecmisi yukle (bir kez). Eski format (tek dizi) yeni formata tasinir.
  useEffect(() => {
    loadJSON(KEYS.chat, null).then((saved) => {
      let init = { chat: [], ask: [] };
      if (Array.isArray(saved)) init = { chat: saved, ask: [] }; // eski format
      else if (saved && typeof saved === "object") init = { chat: saved.chat || [], ask: saved.ask || [] };
      setConvos(init);
      nextId = [...init.chat, ...init.ask].reduce((a, m) => Math.max(a, m.id), 0) + 1;
      setReady(true);
    });
  }, []);

  // Gecmisi kaydet (streaming bittiginde; her delta'da yazmamak icin loading'e bagli)
  useEffect(() => {
    if (ready && !loading) {
      saveJSON(KEYS.chat, { chat: convos.chat.slice(-100), ask: convos.ask.slice(-100) });
    }
  }, [convos, loading, ready]);

  // Yardimcilar: her zaman mesajin GONDERILDIGI modun konusmasina yazar
  // (streaming surerken kullanici mod degistirse bile dogru sohbete islenir).
  function pushTo(modeKey, items) {
    setConvos((cv) => ({ ...cv, [modeKey]: [...cv[modeKey], ...items] }));
  }
  function patchIn(modeKey, id, patch) {
    setConvos((cv) => ({
      ...cv,
      [modeKey]: cv[modeKey].map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }
  function replaceWithError(modeKey, removeId, item) {
    setConvos((cv) => ({
      ...cv,
      [modeKey]: [...cv[modeKey].filter((x) => x.id !== removeId), item],
    }));
  }

  async function onSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const m = mode; // gonderim anindaki modu sabitle
    const userId = nextId++;
    const botId = nextId++;
    pushTo(m, [
      { id: userId, role: "user", text },
      { id: botId, role: "bot", text: "", streaming: true },
    ]);
    setLoading(true);
    try {
      // 1. tercih: streaming
      const { text: full, meta } = await streamChat(text, m === "ask", (partial) => {
        patchIn(m, botId, { text: partial });
      });
      patchIn(m, botId, {
        text: full || "(boş cevap)",
        sources: citedSources(full, meta.sources),
        streaming: false,
      });
    } catch {
      // 2. tercih: eski (yapisal) uclara geri dus
      try {
        if (m === "ask") {
          const r = await askMaterial(text);
          const ans = r.answer?.cevap || "(boş cevap)";
          patchIn(m, botId, {
            text: ans, guven: r.answer?.guven,
            sources: citedSources(ans, r.sources), streaming: false,
          });
        } else {
          const r = await sendChat(text);
          patchIn(m, botId, { text: r.cevap || "(boş cevap)", guven: r.guven, streaming: false });
        }
      } catch (e) {
        replaceWithError(m, botId, {
          id: nextId++, role: "error",
          text: `Bağlantı hatası: ${e.message}\nBASE_URL LAN IP mi? Backend çalışıyor mu?`,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function onClear() {
    const label = mode === "ask" ? "Materyalden sohbet" : "Genel sohbet";
    Alert.alert(`${label} temizlensin mi?`, "Sadece bu moddaki mesaj geçmişi silinecek.", [
      { text: "Vazgeç", style: "cancel" },
      { text: "Temizle", style: "destructive", onPress: () => setConvos((cv) => ({ ...cv, [mode]: [] })) },
    ]);
  }

  function renderItem({ item }) {
    if (item.role === "error") {
      return (
        <View style={[st.bubble, st.bubbleErr]}>
          <Text style={{ color: c.red, fontSize: 14 }}>{item.text}</Text>
        </View>
      );
    }
    const mine = item.role === "user";
    return (
      <View style={[st.bubble, mine ? st.bubbleUser : st.bubbleBot]}>
        <Text style={[st.msgTxt, mine && { color: "#fff" }]}>
          {item.text || (item.streaming ? "…" : "")}
        </Text>
        {!mine && !item.streaming && (item.guven != null || item.sources?.length > 0) && (
          <View style={st.metaRow}>
            {item.guven != null && <Chip label={`güven ${Math.round(item.guven * 100)}%`} tone="gray" icon="analytics" />}
            {item.sources?.map((x) => (
              <Chip key={x.n} label={`[${x.n}] ${x.source}`} tone="primary" icon="document-text" />
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <View
      ref={wrapRef}
      style={{ flex: 1 }}
      onLayout={() => wrapRef.current?.measureInWindow((_x, y) => setKavOffset(y))}
    >
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? kavOffset : 0}
    >
      <View style={st.modeRow}>
        {[
          { key: "chat", label: "Genel sohbet", icon: "chatbubble-ellipses" },
          { key: "ask", label: "Materyalden (kaynaklı)", icon: "library" },
        ].map((m) => {
          const active = mode === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              style={[st.modeBtn, active && st.modeBtnActive]}
              onPress={() => setMode(m.key)}
              activeOpacity={0.7}
            >
              <Ionicons name={m.icon} size={14} color={active ? "#fff" : c.sub} />
              <Text style={[st.modeTxt, active && { color: "#fff" }]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
        <View style={{ flex: 1 }} />
        {messages.length > 0 && (
          <TouchableOpacity onPress={onClear} style={st.clearBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={18} color={c.sub} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(x) => String(x.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: sp.l, gap: sp.m, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <EmptyState
            icon="chatbubbles-outline"
            title="Sohbete başla"
            subtitle={mode === "ask"
              ? "Yüklediğin materyalden kaynak göstererek cevaplar."
              : "Genel bilgiyle sohbet eder. Materyalden sormak için üstteki modu değiştir."}
          />
        }
      />

      {loading && (
        <View style={st.typing}>
          <ActivityIndicator size="small" color={c.primary} />
          <Text style={{ color: c.sub, fontSize: 13 }}>yazıyor…</Text>
        </View>
      )}

      <View style={st.inputRow}>
        <TextInput
          style={st.input}
          value={input}
          onChangeText={setInput}
          placeholder={mode === "ask" ? "Materyalden sor…" : "Bir şey sor…"}
          placeholderTextColor={c.faint}
          multiline
        />
        <TouchableOpacity style={st.sendBtn} onPress={onSend} disabled={loading} activeOpacity={0.8}>
          <Ionicons name="send" size={19} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  modeRow: { flexDirection: "row", alignItems: "center", gap: sp.s, padding: sp.l, paddingBottom: 0 },
  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.pill, backgroundColor: c.surface,
    borderWidth: 1, borderColor: c.border,
  },
  modeBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  modeTxt: { fontSize: 13, fontWeight: "600", color: c.sub },
  clearBtn: { padding: 8 },
  bubble: { maxWidth: "85%", borderRadius: radius.l, padding: 12 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: c.bubbleUser, borderBottomRightRadius: 4 },
  bubbleBot: {
    alignSelf: "flex-start", backgroundColor: c.bubbleBot,
    borderWidth: 1, borderColor: c.border, borderBottomLeftRadius: 4,
  },
  bubbleErr: { alignSelf: "center", backgroundColor: c.redSoft, maxWidth: "95%" },
  msgTxt: { fontSize: 15, lineHeight: 21.5, color: c.text },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  typing: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: sp.l, paddingBottom: 6 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", gap: sp.s,
    padding: sp.m, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: radius.l,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: c.text,
    maxHeight: 110, backgroundColor: c.bg,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary,
    alignItems: "center", justifyContent: "center",
  },
});
