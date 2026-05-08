import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  addFeedback,
  deleteFeedback,
  listUsersFeedback,
  listUsersFeedbackOldestFirst,
} from '@/services/feedbackService';

const TEAL = '#1a7a6e';
const DARK_TEAL = '#0f5a51';
const YELLOW = '#f9e84e';
const GRAY_BOX = '#e8e8e8';

type FeedbackItem = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status?: string;
  site?: string;
  createdAt?: { seconds?: number } | Date;
};

const FEEDBACK_CATEGORIES = ['general', 'maintenance', 'safety'] as const;

const STATUS_FILTERS: { key: 'all' | string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'Awaiting Review', label: 'Awaiting' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'Resolved', label: 'Resolved' },
];

type SortOrder = 'newest' | 'oldest';

function formatCreatedAt(value: FeedbackItem['createdAt']) {
  if (!value) return 'Just now';
  const date = value instanceof Date ? value : new Date((value.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Feedback() {
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [statusFilter, setStatusFilter] = useState<string | 'all'>('Awaiting Review');
  const isFirstRun = useRef(true);

  const [title, setTitle] = useState('');
  const [site, setSite] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<(typeof FEEDBACK_CATEGORIES)[number]>('general');

  const loadFeedback = useCallback(async () => {
    if (isFirstRun.current) {
      setInitialLoad(true);
    } else {
      setRefreshing(true);
    }
    try {
      let data: FeedbackItem[];
      if (sortOrder === 'newest') {
        data = (await listUsersFeedback()) as FeedbackItem[];
      } else {
        data = (await listUsersFeedbackOldestFirst()) as FeedbackItem[];
      }
      if (statusFilter !== 'all') {
        data = data.filter((item) => (item.status ?? 'Awaiting Review') === statusFilter);
      }
      setFeedbackItems(data);
    } catch {
      Alert.alert('Error', 'Unable to load feedback.');
    } finally {
      if (isFirstRun.current) {
        setInitialLoad(false);
        isFirstRun.current = false;
      } else {
        setRefreshing(false);
      }
    }
  }, [sortOrder, statusFilter]);

  useEffect(() => { void loadFeedback(); }, [loadFeedback]);

  const onPullRefresh = useCallback(() => { void loadFeedback(); }, [loadFeedback]);

  const openModal = () => {
    setTitle(''); setSite(''); setDescription(''); setCategory('general');
    setModalVisible(true);
  };
  const closeModal = () => setModalVisible(false);

  const submitFeedback = async () => {
    if (!title.trim() || !site.trim()) {
      Alert.alert('Required', 'Please enter a title and site.');
      return;
    }
    try {
      setSubmitting(true);
      await addFeedback({ title: title.trim(), description: description.trim(), category, site: site.trim() });
      closeModal();
      void loadFeedback();
    } catch {
      Alert.alert('Error', 'Unable to submit feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (item: FeedbackItem) => {
    Alert.alert('Delete feedback', `Remove "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteFeedback(item.id);
            void loadFeedback();
          } catch {
            Alert.alert('Error', 'Could not delete feedback.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Feedback</Text>
          <Text style={styles.subtitle}>Share requests or report issues.</Text>
        </View>
        <Pressable style={styles.newButton} onPress={openModal}>
          <Text style={styles.newButtonText}>+ New</Text>
        </Pressable>
      </View>

      {/* Sort */}
      <View style={styles.sortRow}>
        <Text style={styles.sectionLabel}>Sort</Text>
        <View style={styles.chipRow}>
          {(['newest', 'oldest'] as SortOrder[]).map((s) => (
            <Pressable
              key={s}
              style={[styles.chip, sortOrder === s && styles.chipActive]}
              onPress={() => setSortOrder(s)}>
              <Text style={[styles.chipText, sortOrder === s && styles.chipTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Status filter */}
      <View style={styles.filterBlock}>
        <Text style={styles.sectionLabel}>Status</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setStatusFilter(f.key)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* List */}
      {initialLoad ? (
        <ActivityIndicator style={styles.loader} color={TEAL} />
      ) : (
        <FlatList
          data={feedbackItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onRefresh={onPullRefresh}
          refreshing={refreshing}
          ListEmptyComponent={<Text style={styles.emptyText}>No feedback here.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <View style={styles.cardActions}>
                  <Text style={styles.statusBadge}>{item.status ?? 'Awaiting Review'}</Text>
                  <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={15} color="#b91c1c" />
                  </Pressable>
                </View>
              </View>
              {!!item.description && (
                <Text style={styles.cardDescription}>{item.description}</Text>
              )}
              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{item.category ?? 'general'}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{item.site ?? 'General'}</Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.metaText}>{formatCreatedAt(item.createdAt)}</Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Submit Feedback</Text>

            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="Title"
              placeholderTextColor="#aaa"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={styles.fieldLabel}>Site *</Text>
            <TextInput
              style={styles.input}
              placeholder="Site"
              placeholderTextColor="#aaa"
              value={site}
              onChangeText={setSite}
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputLarge]}
              placeholder="Description"
              placeholderTextColor="#aaa"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {FEEDBACK_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[styles.chip, category === cat && styles.chipActive]}>
                  <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.footer}>
              <Pressable style={styles.cancelBtn} onPress={closeModal} disabled={submitting}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.submitBtn} onPress={submitFeedback} disabled={submitting}>
                <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
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

  header: {
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  title: { fontSize: 26, fontWeight: '900', color: DARK_TEAL },
  subtitle: { marginTop: 4, color: TEAL, fontSize: 13, fontWeight: '500' },
  newButton: {
    backgroundColor: TEAL, borderRadius: 999,
    paddingVertical: 10, paddingHorizontal: 18,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  newButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },

  sortRow: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, gap: 8 },
  filterBlock: { paddingLeft: 20, paddingBottom: 10, gap: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEAL, textTransform: 'uppercase', letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', gap: 8 },
  filterScroll: { flexDirection: 'row', gap: 8, paddingRight: 20 },

  chip: {
    borderWidth: 1.5, borderColor: GRAY_BOX, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: TEAL, borderColor: TEAL },
  chipText: { fontSize: 13, color: TEAL, fontWeight: '600' },
  chipTextActive: { color: '#fff', fontWeight: '800' },

  loader: { marginTop: 40 },
  listContent: { padding: 20, gap: 10, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: TEAL, marginTop: 48, fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: GRAY_BOX, padding: 14, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: DARK_TEAL },
  cardActions: { alignItems: 'flex-end', gap: 8 },
  statusBadge: {
    fontSize: 11, fontWeight: '700', color: '#205A30',
    backgroundColor: '#E3F2DA', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  cardDescription: { color: TEAL, fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  metaDot: { color: GRAY_BOX },
  metaText: { color: '#999', fontSize: 12, fontWeight: '500' },

  // modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  modal: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 8 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: DARK_TEAL, marginBottom: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  input: {
    borderWidth: 1.5, borderColor: GRAY_BOX, borderRadius: 14,
    padding: 12, fontSize: 14, color: DARK_TEAL, backgroundColor: '#fafafa', fontWeight: '600',
  },
  inputLarge: { minHeight: 90, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  footer: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: GRAY_BOX,
    borderRadius: 999, alignItems: 'center', paddingVertical: 13,
  },
  cancelBtnText: { color: TEAL, fontWeight: '700' },
  submitBtn: {
    flex: 2, borderRadius: 999, alignItems: 'center', paddingVertical: 13,
    backgroundColor: TEAL, shadowColor: TEAL,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  submitBtnText: { color: '#fff', fontWeight: '800' },
});