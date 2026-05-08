import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { logoutResident } from '@/services/authService';
import { useAuth } from '@/state/auth';
import { addAnnouncement, listAnnouncements } from '@/services/announcementService';
import { listFeedback } from '@/services/feedbackService';

const TEAL = '#1a7a6e';
const GRAY_BOX = '#e8e8e8';

type Announcement = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  dueDate?: { seconds?: number } | Date;
};

type FeedbackItem = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  status?: string;
  site?: string;
  isCompleted?: boolean;
  createdAt?: { seconds?: number } | Date;
};

const toDate = (value?: { seconds?: number } | Date): Date => {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  return new Date((value.seconds ?? 0) * 1000);
};

function formatCreatedAt(value: FeedbackItem['createdAt']) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date((value.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Gray bubbly section box
function SectionBox({
  title,
  children,
  empty,
  onAdd,
}: {
  title: string;
  children?: React.ReactNode;
  empty?: boolean;
  onAdd?: () => void;
}) {
  return (
    <View style={styles.sectionBox}>
      <View style={styles.sectionBoxHeader}>
        <Text style={styles.sectionBoxTitle}>{title}</Text>
        {onAdd && (
          <Pressable style={styles.addBtn} onPress={onAdd}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        )}
      </View>
      {empty ? (
        <View style={[styles.sectionBoxBody, { gap: 0 }]}>
          <View style={styles.emptyCard} />
        </View>
      ) : (
        <ScrollView
          style={styles.sectionBoxBody}
          contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      )}
    </View>
  );
}

// White card inside a section
function ItemCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.itemCard}>{children}</View>;
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newSite, setNewSite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const fetchHomeData = useCallback(async () => {
    const [announcementData, feedbackData] = await Promise.all([
      listAnnouncements(),
      listFeedback(),
    ]);
    setAnnouncements(announcementData as Announcement[]);
    setFeedbackList(feedbackData as FeedbackItem[]);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await fetchHomeData();
      } finally {
        setLoading(false);
      }
    })();
  }, [fetchHomeData]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchHomeData();
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await logoutResident();
    router.replace('/');
  };

  const openModal = () => {
    setNewTitle('');
    setNewDescription('');
    setNewCategory('');
    setNewSite('');
    setShowModal(true);
  };

  const handleAddAnnouncement = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Title required', 'Please enter a title for the announcement.');
      return;
    }
    try {
      setSubmitting(true);
      await addAnnouncement({
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory.trim() || 'general',
        site: newSite.trim() || 'TVS',
        releaseDate: new Date(),
      });
      setShowModal(false);
      await fetchHomeData();
    } catch {
      Alert.alert('Error', 'Failed to add announcement. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.outerScroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={TEAL} />
        }
        showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>
            Welcome, <Text style={styles.welcomeBold}>{profile?.name ?? 'Admin'}!</Text>
          </Text>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>

        {/* Public Calendar */}
        <SectionBox title="Announcements" empty={announcements.length === 0} onAdd={openModal}>
          {announcements.map((a) => (
            <ItemCard key={a.id}>
              <Text style={styles.cardTitle} numberOfLines={1}>{a.title}</Text>
              {!!a.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>{a.description}</Text>
              )}
              <Text style={styles.cardMeta}>
                {(a.category ?? 'general').toUpperCase()} • Due{' '}
                {toDate(a.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </ItemCard>
          ))}
        </SectionBox>

        {/* New Feedback / Requests */}
        <SectionBox title="New Feedback/Requests" empty={feedbackList.length === 0}>
          {feedbackList.map((f) => (
            <ItemCard key={f.id}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle} numberOfLines={1}>{f.title}</Text>
                <Text style={[styles.badge, f.isCompleted ? styles.badgeDone : styles.badgeOpen]}>
                  {f.isCompleted ? 'Done' : f.status ?? 'Pending'}
                </Text>
              </View>
              {!!f.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>{f.description}</Text>
              )}
              <Text style={styles.cardMeta}>
                {f.site ?? '—'} • {f.category ?? 'general'} • {formatCreatedAt(f.createdAt)}
              </Text>
            </ItemCard>
          ))}
        </SectionBox>

      </ScrollView>

      {/* Add Announcement Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalSheet}>
          <Text style={styles.modalTitle}>New Announcement</Text>

          <TextInput
            style={styles.modalInput}
            placeholder="Title *"
            placeholderTextColor="#aaa"
            value={newTitle}
            onChangeText={setNewTitle}
            editable={!submitting}
          />
          <TextInput
            style={[styles.modalInput, styles.modalInputMulti]}
            placeholder="Description (optional)"
            placeholderTextColor="#aaa"
            value={newDescription}
            onChangeText={setNewDescription}
            multiline
            editable={!submitting}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Category (default: general)"
            placeholderTextColor="#aaa"
            value={newCategory}
            onChangeText={setNewCategory}
            editable={!submitting}
          />
          <TextInput
            style={styles.modalInput}
            placeholder="Site (default: TVS)"
            placeholderTextColor="#aaa"
            value={newSite}
            onChangeText={setNewSite}
            editable={!submitting}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancel} onPress={() => setShowModal(false)} disabled={submitting}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.modalSubmit} onPress={handleAddAnnouncement} disabled={submitting}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.modalSubmitText}>Post</Text>
              }
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  center: { justifyContent: 'center', alignItems: 'center' },
  outerScroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 32,
    gap: 20,
  },

  // header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 22,
    color: TEAL,
    flexShrink: 1,
  },
  welcomeBold: {
    fontWeight: '800',
    color: TEAL,
  },

  // logout
  logoutBtn: {
    backgroundColor: TEAL,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // gray bubbly section box
  sectionBox: {
    backgroundColor: GRAY_BOX,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sectionBoxTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sectionBoxBody: {
    padding: 10,
    gap: 8,
    maxHeight: 3 * 110,
  },
  emptyCard: {
    height: 80,
  },

  // white item card
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  cardDesc: {
    fontSize: 13,
    color: '#555',
  },
  cardMeta: {
    fontSize: 11,
    color: '#999',
    fontWeight: '500',
  },

  // badges
  badge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
  },
  badgeOpen: {
    color: '#825102',
    backgroundColor: '#F9EFD9',
  },
  badgeDone: {
    color: '#205A30',
    backgroundColor: '#E3F2DA',
  },

  // section box header row
  sectionBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addBtn: {
    backgroundColor: TEAL,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },

  // modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEAL,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#f3f3f3',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1a1a1a',
  },
  modalInputMulti: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: TEAL,
    alignItems: 'center',
  },
  modalCancelText: {
    color: TEAL,
    fontWeight: '700',
    fontSize: 14,
  },
  modalSubmit: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 999,
    backgroundColor: TEAL,
    alignItems: 'center',
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});