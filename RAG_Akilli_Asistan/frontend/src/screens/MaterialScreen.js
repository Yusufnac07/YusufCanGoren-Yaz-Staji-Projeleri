// Materyal yonetimi: PDF/metin yukle, yuklu materyalleri listele, sifirla.
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { uploadDocument, getMaterials, resetAll } from "../api";
import { c, sp } from "../theme";
import { Button, Card, Chip, EmptyState } from "../components";

export default function MaterialScreen() {
  const [materials, setMaterials] = useState([]);
  const [status, setStatus] = useState(null); // {tone, text}
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await getMaterials();
      setMaterials(r.materials || []);
    } catch {
      setStatus({ tone: "red", text: "Materyaller alınamadı — backend çalışıyor mu?" });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function onPick() {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/plain"] });
    if (res.canceled) return;
    setUploading(true);
    setStatus({ tone: "gray", text: "Yükleniyor ve indeksleniyor…" });
    try {
      const r = await uploadDocument(res.assets[0]);
      setStatus({ tone: "green", text: `${r.source}: ${r.indexed_chunks} parça indekslendi` });
      refresh();
    } catch (e) {
      setStatus({ tone: "red", text: "Hata: " + e.message });
    } finally {
      setUploading(false);
    }
  }

  function onReset() {
    Alert.alert(
      "Tüm materyali sil?",
      "Yüklenen tüm PDF, metin ve fotoğraf içerikleri indeksten kaldırılacak. Bu işlem geri alınamaz.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil", style: "destructive",
          onPress: async () => {
            try {
              await resetAll();
              setMaterials([]);
              setStatus({ tone: "gray", text: "İndeks sıfırlandı." });
            } catch (e) {
              setStatus({ tone: "red", text: "Hata: " + e.message });
            }
          },
        },
      ]
    );
  }

  const totalChunks = materials.reduce((a, m) => a + m.chunks, 0);

  return (
    <ScrollView
      contentContainerStyle={{ padding: sp.l, gap: sp.m, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} />}
    >
      <Card>
        <Text style={st.cardTitle}>Materyal yükle</Text>
        <Text style={st.cardSub}>PDF veya düz metin dosyası seç; parçalanıp arama indeksine eklenir. Sohbet sekmesindeki “Materyalden” modu bu içerikten cevap verir.</Text>
        <Button title="PDF / metin seç" icon="cloud-upload" onPress={onPick} loading={uploading} style={{ marginTop: sp.m }} />
        {status && (
          <View style={{ marginTop: sp.m }}>
            <Chip label={status.text} tone={status.tone} />
          </View>
        )}
      </Card>

      <Card>
        <View style={st.rowBetween}>
          <Text style={st.cardTitle}>Yüklü materyaller</Text>
          {materials.length > 0 && <Chip label={`${totalChunks} parça`} tone="primary" icon="layers" />}
        </View>
        {materials.length === 0 ? (
          <EmptyState icon="folder-open-outline" title="Henüz materyal yok" subtitle="PDF yükle ya da Kamera sekmesinden not fotoğrafı çek." />
        ) : (
          materials.map((m) => (
            <View key={m.source} style={st.matRow}>
              <Ionicons
                name={(m.source.startsWith("📷") || m.source.startsWith("foto-")) ? "image" : "document-text"}
                size={20}
                color={c.primary}
              />
              <Text style={st.matName} numberOfLines={1}>{m.source.replace(/^📷\s*/, "")}</Text>
              <Text style={st.matChunks}>{m.chunks} parça</Text>
            </View>
          ))
        )}
      </Card>

      {materials.length > 0 && (
        <Button title="Tüm materyali sıfırla" icon="trash" variant="danger" onPress={onReset} />
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  cardTitle: { fontSize: 16.5, fontWeight: "800", color: c.text },
  cardSub: { fontSize: 13.5, color: c.sub, marginTop: 6, lineHeight: 19 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  matRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderColor: c.border,
  },
  matName: { flex: 1, fontSize: 14.5, color: c.text, fontWeight: "600" },
  matChunks: { fontSize: 12.5, color: c.sub },
});
