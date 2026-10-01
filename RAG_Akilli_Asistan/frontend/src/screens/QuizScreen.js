// Quiz + Flashcard: /quiz ile soru uret; quiz modunda /grade ile puanla,
// flashcard modunda kart cevirerek ezber calis. Skor gecmisi AsyncStorage'da tutulur,
// dusuk puanli sorular tekrar sorulabilir.
import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeQuiz, gradeAnswer } from "../api";
import { loadJSON, saveJSON, KEYS } from "../storage";
import { c, sp, radius } from "../theme";
import { Button, Card, Chip, EmptyState } from "../components";

const RETRY_THRESHOLD = 40; // bu puanin altindaki sorular "yanlis" sayilir

export default function QuizScreen() {
  const [phase, setPhase] = useState("setup"); // setup | active | done | flash | flashDone
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(3);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [grades, setGrades] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [flashResult, setFlashResult] = useState(null); // {known, unknown: [cards]}

  useEffect(() => {
    loadJSON(KEYS.quiz, []).then(setHistory);
  }, []);

  async function fetchQuestions() {
    const r = await makeQuiz(topic.trim(), count);
    const qs = r.sorular || [];
    if (!qs.length) throw new Error(r.not || "Soru üretilemedi — önce materyal yüklediğinden emin ol.");
    return qs;
  }

  async function onStart(target) {
    setLoading(true); setError("");
    try {
      const qs = await fetchQuestions();
      setQuestions(qs); setIdx(0); setGrades([]); setFeedback(null); setAnswer("");
      setFlashResult(null);
      setPhase(target);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onGrade() {
    if (!answer.trim() || loading) return;
    setLoading(true); setError("");
    try {
      const g = await gradeAnswer(questions[idx].soru, answer.trim());
      setFeedback(g);
      setGrades((gs) => [...gs, g]);
    } catch (e) {
      setError("Değerlendirme hatası: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  function saveRecord(allGrades, qCount) {
    const scored = allGrades.filter((g) => g.puan != null);
    const avg = scored.length ? Math.round(scored.reduce((a, g) => a + g.puan, 0) / scored.length) : null;
    if (avg == null) return;
    const rec = { t: Date.now(), topic: topic.trim() || "genel", n: qCount, avg };
    setHistory((h) => {
      const next = [...h, rec].slice(-30);
      saveJSON(KEYS.quiz, next);
      return next;
    });
  }

  function onNext() {
    setFeedback(null); setAnswer("");
    if (idx + 1 < questions.length) {
      setIdx(idx + 1);
    } else {
      saveRecord(grades, questions.length);
      setPhase("done");
    }
  }

  function retryWrong() {
    const wrong = questions.filter((_, i) => grades[i]?.puan == null || grades[i].puan < RETRY_THRESHOLD);
    setQuestions(wrong); setIdx(0); setGrades([]); setFeedback(null); setAnswer("");
    setPhase("active");
  }

  function restart() {
    setPhase("setup"); setQuestions([]); setGrades([]); setFeedback(null); setAnswer(""); setError("");
    setFlashResult(null);
  }

  const scoreTone = (p) => (p == null ? "gray" : p >= 70 ? "green" : p >= RETRY_THRESHOLD ? "amber" : "red");

  // ---- SETUP ----
  if (phase === "setup") {
    return (
      <ScrollView contentContainerStyle={{ padding: sp.l, gap: sp.m, paddingBottom: 40 }}>
        <Card>
          <Text style={st.title}>Çalışma oluştur</Text>
          <Text style={st.sub}>Materyalinden sorular üretilir. Quiz modunda cevapların puanlanır; flashcard modunda kart çevirerek ezber yaparsın.</Text>
          <TextInput
            style={st.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="Konu (boş bırakılırsa genel)"
            placeholderTextColor={c.faint}
          />
          <View style={st.countRow}>
            {[3, 5, 7].map((n) => (
              <TouchableOpacity
                key={n}
                style={[st.countBtn, count === n && st.countBtnActive]}
                onPress={() => setCount(n)}
                activeOpacity={0.7}
              >
                <Text style={[st.countTxt, count === n && { color: "#fff" }]}>{n} soru</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button title="Quizi başlat" icon="play" onPress={() => onStart("active")} loading={loading} style={{ marginTop: sp.m }} />
          <Button title="Flashcard çalış" icon="albums" variant="outline" onPress={() => onStart("flash")} loading={loading} style={{ marginTop: sp.s }} />
          {error ? <Text style={st.err}>{error}</Text> : null}
        </Card>

        {history.length > 0 ? (
          <Card>
            <View style={st.rowBetween}>
              <Text style={st.title}>Gelişimin</Text>
              <Chip label={`${history.length} quiz`} tone="primary" icon="stats-chart" />
            </View>
            {history.slice(-7).reverse().map((h, i) => (
              <View key={h.t + "-" + i} style={st.histRow}>
                <View style={{ flex: 1 }}>
                  <Text style={st.histTopic} numberOfLines={1}>{h.topic}</Text>
                  <Text style={st.histDate}>
                    {new Date(h.t).toLocaleDateString("tr-TR")} · {h.n} soru
                  </Text>
                  <View style={st.barTrack}>
                    <View style={[st.barFill, {
                      width: `${h.avg}%`,
                      backgroundColor: h.avg >= 70 ? c.green : h.avg >= RETRY_THRESHOLD ? c.amber : c.red,
                    }]} />
                  </View>
                </View>
                <Text style={[st.histScore, { color: h.avg >= 70 ? c.green : h.avg >= RETRY_THRESHOLD ? c.amber : c.red }]}>
                  {h.avg}
                </Text>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyState icon="school-outline" title="Kendini sına" subtitle="İlk quizini çözdüğünde skor geçmişin burada birikecek." />
        )}
      </ScrollView>
    );
  }

  // ---- FLASHCARD ----
  if (phase === "flash") {
    return (
      <Flashcards
        cards={questions}
        onDone={(known, unknown) => { setFlashResult({ known, unknown }); setPhase("flashDone"); }}
        onExit={restart}
      />
    );
  }

  if (phase === "flashDone") {
    const total = questions.length;
    return (
      <ScrollView contentContainerStyle={{ padding: sp.l, gap: sp.m, paddingBottom: 40 }}>
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <Ionicons name={flashResult.known === total ? "trophy" : "albums"} size={44} color={c.amber} />
          <Text style={[st.title, { marginTop: 10 }]}>Tur bitti!</Text>
          <Text style={st.bigScore}>
            {flashResult.known}<Text style={{ fontSize: 18, color: c.sub }}> / {total} bildin</Text>
          </Text>
        </Card>
        {flashResult.unknown.length > 0 && (
          <Button
            title={`Bilemediklerini tekrar et (${flashResult.unknown.length})`}
            icon="refresh"
            variant="amber"
            onPress={() => {
              setQuestions(flashResult.unknown);
              setFlashResult(null);
              setPhase("flash");
            }}
          />
        )}
        <Button title="Yeni çalışma" icon="add-circle" onPress={restart} />
      </ScrollView>
    );
  }

  // ---- DONE ----
  if (phase === "done") {
    const scored = grades.filter((g) => g.puan != null);
    const avg = scored.length ? Math.round(scored.reduce((a, g) => a + g.puan, 0) / scored.length) : null;
    const wrongCount = questions.filter((_, i) => grades[i]?.puan == null || grades[i].puan < RETRY_THRESHOLD).length;
    return (
      <ScrollView contentContainerStyle={{ padding: sp.l, gap: sp.m, paddingBottom: 40 }}>
        <Card style={{ alignItems: "center", paddingVertical: 28 }}>
          <Ionicons name={avg != null && avg >= 70 ? "trophy" : "ribbon"} size={44} color={c.amber} />
          <Text style={[st.title, { marginTop: 10 }]}>Quiz bitti!</Text>
          {avg != null && <Text style={st.bigScore}>{avg}<Text style={{ fontSize: 18, color: c.sub }}> / 100</Text></Text>}
        </Card>
        {wrongCount > 0 && (
          <Button title={`Yanlışları tekrar çöz (${wrongCount})`} icon="refresh" variant="amber" onPress={retryWrong} />
        )}
        {questions.map((q, i) => (
          <Card key={i}>
            <Text style={st.qNo}>Soru {i + 1}</Text>
            <Text style={st.qText}>{q.soru}</Text>
            {grades[i] && (
              <>
                <View style={{ marginTop: 8 }}>
                  <Chip label={grades[i].puan != null ? `${grades[i].puan} puan` : "puanlanamadı"} tone={scoreTone(grades[i].puan)} />
                </View>
                <Text style={st.fbTxt}>{grades[i].geri_bildirim}</Text>
              </>
            )}
            <Text style={st.modelAns}>Örnek cevap: {q.cevap}</Text>
          </Card>
        ))}
        <Button title="Yeni quiz" icon="add-circle" onPress={restart} />
      </ScrollView>
    );
  }

  // ---- ACTIVE (quiz) ----
  const q = questions[idx];
  return (
    <ScrollView contentContainerStyle={{ padding: sp.l, gap: sp.m, paddingBottom: 40 }}>
      <View style={st.progressRow}>
        {questions.map((_, i) => (
          <View key={i} style={[st.progressDot, i < idx && st.dotDone, i === idx && st.dotActive]} />
        ))}
      </View>
      <Card>
        <Text style={st.qNo}>Soru {idx + 1} / {questions.length}</Text>
        <Text style={st.qText}>{q.soru}</Text>
      </Card>

      {!feedback ? (
        <Card>
          <TextInput
            style={[st.input, { minHeight: 80, textAlignVertical: "top" }]}
            value={answer}
            onChangeText={setAnswer}
            placeholder="Cevabını yaz…"
            placeholderTextColor={c.faint}
            multiline
          />
          <Button title="Cevabı değerlendir" icon="checkmark-circle" onPress={onGrade} loading={loading} disabled={!answer.trim()} style={{ marginTop: sp.m }} />
          {error ? <Text style={st.err}>{error}</Text> : null}
        </Card>
      ) : (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Chip label={feedback.puan != null ? `${feedback.puan} puan` : "puanlanamadı"} tone={scoreTone(feedback.puan)} icon="star" />
          </View>
          <Text style={st.fbTxt}>{feedback.geri_bildirim}</Text>
          <Text style={st.modelAns}>Örnek cevap: {q.cevap}</Text>
          <Button
            title={idx + 1 < questions.length ? "Sonraki soru" : "Sonuçları gör"}
            icon="arrow-forward"
            onPress={onNext}
            style={{ marginTop: sp.m }}
          />
        </Card>
      )}
    </ScrollView>
  );
}

// Kart cevirme animasyonlu flashcard destesi.
function Flashcards({ cards, onDone, onExit }) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [unknown, setUnknown] = useState([]);
  const flipAnim = useRef(new Animated.Value(0)).current;

  function flip() {
    Animated.timing(flipAnim, { toValue: flipped ? 0 : 1, duration: 280, useNativeDriver: true }).start();
    setFlipped(!flipped);
  }

  function next(knewIt) {
    const newKnown = knewIt ? known + 1 : known;
    const newUnknown = knewIt ? unknown : [...unknown, cards[idx]];
    if (idx + 1 < cards.length) {
      setKnown(newKnown); setUnknown(newUnknown);
      flipAnim.setValue(0); setFlipped(false);
      setIdx(idx + 1);
    } else {
      onDone(newKnown, newUnknown);
    }
  }

  const frontRot = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRot = flipAnim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });

  return (
    <View style={{ flex: 1, padding: sp.l }}>
      <View style={fst.topRow}>
        <TouchableOpacity onPress={onExit} style={{ padding: 6 }} activeOpacity={0.7}>
          <Ionicons name="close" size={22} color={c.sub} />
        </TouchableOpacity>
        <Text style={fst.counter}>{idx + 1} / {cards.length}</Text>
        <View style={{ width: 34 }} />
      </View>

      <TouchableOpacity style={fst.cardWrap} onPress={flip} activeOpacity={0.9}>
        <Animated.View style={[fst.card, { transform: [{ perspective: 1000 }, { rotateY: frontRot }] }]}>
          <Text style={fst.cardLabel}>SORU</Text>
          <Text style={fst.cardTxt}>{cards[idx].soru}</Text>
          <View style={fst.tapHint}>
            <Ionicons name="sync" size={14} color={c.faint} />
            <Text style={{ color: c.faint, fontSize: 12.5 }}>çevirmek için dokun</Text>
          </View>
        </Animated.View>
        <Animated.View style={[fst.card, fst.cardBack, { transform: [{ perspective: 1000 }, { rotateY: backRot }] }]}>
          <Text style={[fst.cardLabel, { color: c.primarySoft }]}>CEVAP</Text>
          <Text style={[fst.cardTxt, { color: "#fff" }]}>{cards[idx].cevap}</Text>
        </Animated.View>
      </TouchableOpacity>

      {flipped ? (
        <View style={fst.answerRow}>
          <TouchableOpacity style={[fst.assessBtn, { borderColor: c.red }]} onPress={() => next(false)} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={18} color={c.red} />
            <Text style={[fst.assessTxt, { color: c.red }]}>Bilemedim</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[fst.assessBtn, { backgroundColor: c.green, borderColor: c.green }]} onPress={() => next(true)} activeOpacity={0.8}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={[fst.assessTxt, { color: "#fff" }]}>Bildim</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ height: 64 }} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  title: { fontSize: 17, fontWeight: "800", color: c.text },
  sub: { fontSize: 13.5, color: c.sub, marginTop: 6, lineHeight: 19 },
  input: {
    borderWidth: 1, borderColor: c.border, borderRadius: radius.m,
    padding: 12, marginTop: sp.m, fontSize: 15, color: c.text, backgroundColor: c.bg,
  },
  countRow: { flexDirection: "row", gap: sp.s, marginTop: sp.m },
  countBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill,
    borderWidth: 1, borderColor: c.border, backgroundColor: c.surface,
  },
  countBtnActive: { backgroundColor: c.primary, borderColor: c.primary },
  countTxt: { fontSize: 13.5, fontWeight: "700", color: c.sub },
  err: { color: c.red, marginTop: sp.m, fontSize: 13.5 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: c.border },
  histTopic: { fontSize: 14, fontWeight: "700", color: c.text },
  histDate: { fontSize: 12, color: c.faint, marginTop: 2 },
  barTrack: { height: 6, backgroundColor: c.border, borderRadius: 3, marginTop: 6, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  histScore: { fontSize: 20, fontWeight: "900", width: 40, textAlign: "right" },
  progressRow: { flexDirection: "row", gap: 6, justifyContent: "center" },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.border },
  dotDone: { backgroundColor: c.primarySoft },
  dotActive: { backgroundColor: c.primary, width: 20 },
  qNo: { fontSize: 12.5, fontWeight: "700", color: c.primary, textTransform: "uppercase", letterSpacing: 0.5 },
  qText: { fontSize: 16.5, fontWeight: "600", color: c.text, marginTop: 6, lineHeight: 23 },
  fbTxt: { fontSize: 14.5, color: c.text, marginTop: 10, lineHeight: 21 },
  modelAns: { fontSize: 13, color: c.sub, marginTop: 10, fontStyle: "italic", lineHeight: 18 },
  bigScore: { fontSize: 42, fontWeight: "900", color: c.primary, marginTop: 6 },
});

const fst = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: sp.m },
  counter: { fontSize: 14, fontWeight: "700", color: c.sub },
  cardWrap: { flex: 1, maxHeight: 420 },
  card: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border,
    alignItems: "center", justifyContent: "center", padding: 28,
    backfaceVisibility: "hidden",
  },
  cardBack: { backgroundColor: c.primary, borderColor: c.primaryDark },
  cardLabel: { fontSize: 12, fontWeight: "800", color: c.faint, letterSpacing: 1.5, marginBottom: 14 },
  cardTxt: { fontSize: 19, fontWeight: "600", color: c.text, textAlign: "center", lineHeight: 27 },
  tapHint: { position: "absolute", bottom: 18, flexDirection: "row", alignItems: "center", gap: 5 },
  answerRow: { flexDirection: "row", gap: sp.m, marginTop: sp.l },
  assessBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 14, borderRadius: radius.m, borderWidth: 1.5, backgroundColor: c.surface,
  },
  assessTxt: { fontSize: 15.5, fontWeight: "800" },
});
