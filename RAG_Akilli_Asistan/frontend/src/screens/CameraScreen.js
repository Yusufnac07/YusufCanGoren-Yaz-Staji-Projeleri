// Kamera: not/kitap fotografini VLM ile metne cevirip indekse ekler.
import React, { useState } from "react";
import { View, Text, ScrollView, Image, StyleSheet, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadPhoto } from "../api";
import { c, sp, radius } from "../theme";
import { Button, Card, Chip, EmptyState } from "../components";

export default function CameraScreen({ provider }) {
  const isOllama = provider === "ollama"; // "yavaş olabilir" uyarisi yalnizca yerel modda
  const [img, setImg] = useState(null);
  const [asset, setAsset] = useState(null); // secili foto — "tekrar dene" icin saklanir
  const [result, setResult] = useState(null);
  // Hangi kaynaktan yukleme suruyor: "camera" | "library" | "retry" | null.
  // Boylece spinner dogru butonun uzerinde doner (hangi butona basildiysa).
  const [busy, setBusy] = useState(null);
  const loading = busy !== null;

  // Secilen fotografi backend'e gonderir. Ayni asset ile tekrar cagrilabilir (retry).
  async function runUpload(a, source) {
    setBusy(source);
    setResult(null);
    try {
      setResult(await uploadPhoto(a));
    } catch (e) {
      setResult({ error: e.message, retry: true });
    } finally {
      setBusy(null);
    }
  }

  async function pick(useCamera) {
    // Galeri icin izin GEREKMEZ (sistem secicisi kullanilir); sadece kamera izin ister.
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        setResult({ error: "Kamera izni verilmedi.", permission: true });
        return;
      }
    }
    const res = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (res.canceled) return;
    const a = res.assets[0];
    setAsset(a);
    setImg(a.uri);
    runUpload(a, useCamera ? "camera" : "library");
  }

  return (
    <ScrollView contentContainerStyle={{ padding: sp.l, gap: sp.m, paddingBottom: 40 }}>
      <Card>
        <Text style={st.title}>Fotoğraftan materyal</Text>
        <Text style={st.sub}>Ders notu veya kitap sayfası fotoğrafı çek; içindeki metin çıkarılıp arama indeksine eklenir.</Text>
        <Button title="Fotoğraf çek" icon="camera" onPress={() => pick(true)} loading={busy === "camera"} disabled={loading} style={{ marginTop: sp.m }} />
        <Button title="Galeriden seç" icon="images" variant="outline" onPress={() => pick(false)} loading={busy === "library"} disabled={loading} style={{ marginTop: sp.s }} />
      </Card>

      {img && (
        <Card>
          <Image source={{ uri: img }} style={st.preview} resizeMode="cover" />
          {loading && (
            <Text style={st.processing}>
              Metin çıkarılıyor…{isOllama ? " (yerel modelde ilk deneme yavaş olabilir)" : ""}
            </Text>
          )}
        </Card>
      )}

      {result?.error && (
        <Card style={{ borderColor: c.redSoft, backgroundColor: c.redSoft }}>
          <Text style={{ color: c.red, fontSize: 14 }}>Hata: {result.error}</Text>
          {result.retry && asset && (
            <>
              <Text style={st.retryHint}>
                {isOllama
                  ? "Yerel (ollama) modeli belleğe ilk yüklenirken zaman aşımına uğramış olabilir. Aynı fotoğrafla tekrar dene — ikinci denemede genelde çalışır."
                  : "Görme servisi geçici olarak yanıt vermemiş olabilir. Aynı fotoğrafla birkaç saniye sonra tekrar dene."}
              </Text>
              <Button
                title="Aynı fotoğrafı tekrar dene"
                icon="refresh"
                onPress={() => runUpload(asset, "retry")}
                loading={busy === "retry"}
                disabled={loading}
                style={{ marginTop: sp.m }}
              />
            </>
          )}
          {result.permission && (
            <Button
              title="Ayarları aç"
              icon="settings"
              variant="danger"
              onPress={() => Linking.openSettings()}
              style={{ marginTop: sp.m }}
            />
          )}
        </Card>
      )}

      {result?.preview && (
        <Card>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
            <Chip label={`${result.extracted_chars} karakter`} tone="green" icon="text" />
            <Chip label={`${result.indexed_chunks} parça indekslendi`} tone="primary" icon="layers" />
          </View>
          <Text style={st.previewLabel}>Çıkarılan metin (önizleme)</Text>
          <Text style={st.previewTxt}>{result.preview}…</Text>
        </Card>
      )}

      {!img && !result && (
        <EmptyState
          icon="camera-outline"
          title="Henüz fotoğraf yok"
          subtitle="El yazısı notlar da desteklenir; okunamayan yerler [?] ile işaretlenir."
        />
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 16.5, fontWeight: "800", color: c.text },
  sub: { fontSize: 13.5, color: c.sub, marginTop: 6, lineHeight: 19 },
  preview: { width: "100%", height: 220, borderRadius: radius.m },
  processing: { marginTop: sp.m, color: c.sub, fontSize: 13.5, textAlign: "center" },
  retryHint: { color: c.red, fontSize: 12.5, marginTop: 8, lineHeight: 17, opacity: 0.85 },
  previewLabel: { fontSize: 12.5, fontWeight: "700", color: c.sub, marginTop: sp.m, textTransform: "uppercase", letterSpacing: 0.5 },
  previewTxt: { fontSize: 14, color: c.text, marginTop: 6, lineHeight: 20 },
});
