import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listFeedback, updateFeedback } from '@/services/feedbackService';

const TEAL = '#1a7a6e';
const DARK_TEAL = '#0f5a51';
const GRAY_BOX = '#e8e8e8';

type FeedbackItem = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status?: string;
  site?: string;
  user?: string;
  createdAt?: { seconds?: number } | Date;
};

const STATUS_OPTIONS = ['Awaiting Review', 'In Progress', 'Resolved'] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Awaiting Review': { bg: '#F9EFD9', text: '#825102' },
  'In Progress':     { bg: '#DBEAFE', text: '#1e40af' },
  'Resolved':        { bg: '#E3F2DA', text: '#205A30' },
};

function formatCreatedAt(value: FeedbackItem['createdAt']) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date((value.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortUid(uid?: string) {
  if (!uid) return '—';
  return uid.length > 10 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid;
}

export default function ReviewFeedback() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editItem, setEditItem] = useState<FeedbackItem | null>(null);
  const [draftStatus, setDraftStatus] = useState<string>('Awaiting Review');

  const load = useCallback(async () => {
    const data = (await listFeedback()) as FeedbackItem[];
    setItems(data);
  }, []);

  useEffect(() => {
    (async () => {
      try { setLoading(true); await load(); }
      catch { Alert.alert('Error', 'Could not load feedback.'); }
      finally { setLoading(false); }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try { setRefreshing(true); await load(); }
    catch { Alert.alert('Error', 'Could not refresh.'); }
    finally { setRefreshing(false); }
  }, [load]);

  const openEdit = (item: FeedbackItem) => {
    setEditItem(item);
    setDraftStatus(item.status ?? 'Awaiting Review');
  };

  const saveEdit = async () => {
    if (!editItem) return;
    try {
      setSaving(true);
      await updateFeedback(editItem.id, { status: draftStatus });
      setEditItem(null);
      await load();
    } catch {
      Alert.alert('Error', 'Could not update feedback.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>All Feedback</Text>
        <Text style={styles.subtitle}>Tap a card to update its status.</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={<Text style={styles.empty}>No feedback yet.</Text>}
        renderItem={({ item }) => {
          const colors = STATUS_COLORS[item.status ?? 'Awaiting Review'] ?? STATUS_COLORS['Awaiting Review'];
          return (
            <Pressable style={styles.card} onPress={() => openEdit(item)}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.text }]}>
                  {item.status ?? 'Awaiting Review'}
                </Text>
              </View>
              {!!item.description && (
                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
              )}
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={11} color={TEAL} />
                <Text style={styles.meta}>{item.site ?? '—'} · {item.category ?? 'general'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="person-outline" size={11} color={TEAL} />
                <Text style={styles.meta}>User {shortUid(item.user)} · {formatCreatedAt(item.createdAt)}</Text>
              </View>
              <View style={styles.tapHintRow}>
                <Ionicons name="create-outline" size={12} color={TEAL} />
                <Text style={styles.tapHint}>Tap to update status</Text>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Edit Modal */}
      <Modal visible={!!editItem} animationType="slide" transparent onRequestClose={() => setEditItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Update Feedback</Text>
            {editItem && (
              <Text style={styles.modalSubtitle} numberOfLines={2}>{editItem.title}</Text>
            )}

            <Text style={styles.label}>Status</Text>
            <View style={styles.chipWrap}>
              {STATUS_OPTIONS.map((s) => {
                const active = draftStatus === s;
                const colors = STATUS_COLORS[s];
                return (
                  <Pressable
                    key={s}
                    onPress={() => setDraftStatus(s)}
                    style={[
                      styles.chip,
                      active && { backgroundColor: colors.bg, borderColor: colors.text },
                    ]}>
                    <Text style={[styles.chipText, active && { color: colors.text, fontWeight: '800' }]}>
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalFooter}>
              <Pressable style={styles.cancelBtn} onPress={() => setEditItem(null)} disabled={saving}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={saveEdit} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: DARK_TEAL },
  subtitle: { marginTop: 4, fontSize: 13, color: TEAL, fontWeight: '500' },

  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  empty: { textAlign: 'center', color: TEAL, marginTop: 48, fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: GRAY_BOX, padding: 14, gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: DARK_TEAL },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  desc: { fontSize: 13, color: TEAL },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, color: '#999', fontWeight: '500' },
  tapHintRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  tapHint: { fontSize: 11, color: TEAL, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 32, gap: 6,
  },
  modalTitle: { fontSize: 20, fontWeight: '900', color: DARK_TEAL },
  modalSubtitle: { fontSize: 14, color: TEAL, marginTop: 2 },
  label: { fontSize: 11, fontWeight: '700', color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: {
    borderWidth: 1.5, borderColor: GRAY_BOX, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  chipText: { fontSize: 13, color: TEAL, fontWeight: '600' },

  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: GRAY_BOX,
    borderRadius: 999, alignItems: 'center', paddingVertical: 13,
  },
  cancelBtnText: { color: TEAL, fontWeight: '700' },
  saveBtn: {
    flex: 2, backgroundColor: TEAL, borderRadius: 999,
    alignItems: 'center', paddingVertical: 13,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});