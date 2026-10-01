// Ortak UI bilesenleri: Button, Card, Chip, EmptyState.
import React from "react";
import { TouchableOpacity, Text, View, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { c, sp, radius, shadow } from "./theme";

export function Button({ title, onPress, variant = "primary", icon, loading, disabled, style }) {
  const solid = variant === "primary" || variant === "amber";
  const bg = variant === "primary" ? c.primary : variant === "amber" ? c.amber : "transparent";
  const fg = solid ? "#fff" : variant === "danger" ? c.red : c.primary;
  const borderColor = variant === "danger" ? c.red : c.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        st.btn,
        solid ? { backgroundColor: bg } : { borderWidth: 1.5, borderColor },
        (disabled || loading) && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {icon && <Ionicons name={icon} size={17} color={fg} />}
          <Text style={{ color: fg, fontWeight: "700", fontSize: 15 }}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children, style }) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function Chip({ label, tone = "primary", icon }) {
  const map = {
    primary: { bg: c.primarySoft, fg: c.primaryDark },
    amber: { bg: c.amberSoft, fg: c.amber },
    green: { bg: c.greenSoft, fg: c.green },
    red: { bg: c.redSoft, fg: c.red },
    gray: { bg: c.border, fg: c.sub },
  };
  const t = map[tone] || map.primary;
  return (
    <View style={[st.chip, { backgroundColor: t.bg }]}>
      {icon && <Ionicons name={icon} size={12} color={t.fg} style={{ marginRight: 4 }} />}
      <Text style={{ color: t.fg, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <View style={st.empty}>
      <Ionicons name={icon} size={44} color={c.faint} />
      <Text style={st.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={st.emptySub}>{subtitle}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  btn: {
    borderRadius: radius.m,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.l,
    padding: sp.l,
    borderWidth: 1,
    borderColor: c.border,
    ...shadow,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: c.sub, marginTop: 12 },
  emptySub: { fontSize: 13.5, color: c.faint, marginTop: 6, textAlign: "center", lineHeight: 19 },
});
