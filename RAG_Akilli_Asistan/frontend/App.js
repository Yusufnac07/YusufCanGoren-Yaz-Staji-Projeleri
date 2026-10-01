import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Platform, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import ChatScreen from "./src/screens/ChatScreen";
import MaterialScreen from "./src/screens/MaterialScreen";
import QuizScreen from "./src/screens/QuizScreen";
import CameraScreen from "./src/screens/CameraScreen";
import { health, setProvider as apiSetProvider } from "./src/api";
import { c } from "./src/theme";

const TABS = [
  { key: "chat", label: "Sohbet", icon: "chatbubbles", Comp: ChatScreen },
  { key: "material", label: "Materyal", icon: "library", Comp: MaterialScreen },
  { key: "quiz", label: "Quiz", icon: "school", Comp: QuizScreen },
  { key: "camera", label: "Kamera", icon: "camera", Comp: CameraScreen },
];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [provider, setProvider] = useState(null); // {provider, llm} | {error}
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    health().then(setProvider).catch(() => setProvider({ error: true }));
  }, []);

  function onBadgePress() {
    if (!provider || provider.error) {
      // Baglanti yoksa tekrar dene
      health().then(setProvider).catch(() => setProvider({ error: true }));
      return;
    }
    const next = provider.provider === "cloud" ? "ollama" : "cloud";
    const desc = next === "ollama"
      ? "Yerel Ollama: internet gerekmez, veri makineden çıkmaz. Ollama'nın bilgisayarda çalışıyor olması gerekir."
      : "Bulut: Groq (sohbet) + Gemini (görme). İnternet gerekir, daha hızlı ve isabetlidir.";
    Alert.alert(`${next === "ollama" ? "Yerel (ollama)" : "Bulut (cloud)"} moduna geç?`, desc, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Geç",
        onPress: async () => {
          setSwitching(true);
          try {
            setProvider(await apiSetProvider(next));
          } catch (e) {
            Alert.alert("Geçiş başarısız", e.message);
          } finally {
            setSwitching(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={st.safe}>
      <StatusBar style="dark" />
      <View style={st.header}>
        <Text style={st.title}>Çalışma Asistanı</Text>
        {provider && (
          <TouchableOpacity
            onPress={onBadgePress}
            disabled={switching}
            activeOpacity={0.7}
            style={[st.badge, provider.error ? st.badgeErr : st.badgeOk, switching && { opacity: 0.5 }]}
          >
            <Ionicons
              name={provider.error ? "cloud-offline" : provider.provider === "ollama" ? "hardware-chip" : "cloud"}
              size={13}
              color={provider.error ? c.red : c.primaryDark}
            />
            <Text style={[st.badgeTxt, provider.error && { color: c.red }]}>
              {switching ? "geçiliyor…" : provider.error ? "bağlantı yok" : provider.provider}
            </Text>
            {!provider.error && !switching && (
              <Ionicons name="swap-horizontal" size={12} color={c.primaryDark} />
            )}
          </TouchableOpacity>
        )}
      </View>
      <View style={st.body}>
        {/* Tum ekranlar mounted kalir; aktif olmayanlar gizlenir. Boylece sekme
            degistirince suren islemler (or. Kamera'da metin cikarma) ve ekran
            state'i (quiz ilerlemesi, secilen fotograf) kaybolmaz. */}
        {TABS.map((t) => (
          <View key={t.key} style={[st.screen, tab !== t.key && st.hidden]}>
            <t.Comp provider={provider?.error ? null : provider?.provider} />
          </View>
        ))}
      </View>
      <View style={st.tabbar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={st.tab} onPress={() => setTab(t.key)} activeOpacity={0.7}>
              <Ionicons name={active ? t.icon : `${t.icon}-outline`} size={22} color={active ? c.primary : c.sub} />
              <Text style={[st.tabTxt, active && st.tabActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface, paddingTop: Platform.OS === "android" ? 32 : 0 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.surface,
  },
  title: { fontSize: 20, fontWeight: "800", color: c.text },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeOk: { backgroundColor: c.primarySoft },
  badgeErr: { backgroundColor: c.redSoft },
  badgeTxt: { fontSize: 12, fontWeight: "700", color: c.primaryDark },
  body: { flex: 1, backgroundColor: c.bg },
  screen: { flex: 1 },
  hidden: { display: "none" },
  tabbar: { flexDirection: "row", borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", gap: 2 },
  tabTxt: { fontSize: 11.5, color: c.sub, fontWeight: "600" },
  tabActive: { color: c.primary },
});
