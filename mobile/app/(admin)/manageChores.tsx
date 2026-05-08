import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import {
  addChore,
  assignChore,
  deleteChore,
  listAllChores,
  listResidentsBySite,
  rotateChores,
  unassignChore,
  updateChore,
  type ChoreInput,
} from '@/services/choreService';

const TEAL = '#1a7a6e';
const DARK_TEAL = '#0f5a51';
const YELLOW = '#f9e84e';
const GRAY_BOX = '#e8e8e8';

// ─── Types ────────────────────────────────────────────────────────────────────

type ChoreRow = {
  id: string;
  title: string;
  description?: string;
  assignedTo?: string | null;
  assignedName?: string | null;
  site?: string;
  dueDate?: Timestamp | { seconds?: number } | Date;
  isCompleted?: boolean;
};

type Resident = {
  uid: string;
  name: string;
  email: string;
  unitNumber: string;
  site: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(val: ChoreRow['dueDate']): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  return new Date(0);
}

function parseInputDate(str: string): Date | null {
  const parts = str.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

function fmtDate(date: Date): string {
  if (date.getTime() === 0) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function dateToInput(val: ChoreRow['dueDate']): string {
  const d = toDate(val);
  if (d.getTime() === 0) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${d.getFullYear()}`;
}

// ─── Chore Form Modal ─────────────────────────────────────────────────────────

function ChoreFormModal({ visible, onClose, onSaved, editing }: {
  visible: boolean; onClose: () => void; onSaved: () => void; editing?: ChoreRow | null;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [site, setSite] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title ?? '');
      setDescription(editing.description ?? '');
      setSite(editing.site ?? '');
      setDueDate(dateToInput(editing.dueDate));
    } else {
      setTitle(''); setDescription(''); setSite(''); setDueDate('');
    }
  }, [editing, visible]);

  const save = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a title.');
    if (!site.trim()) return Alert.alert('Required', 'Please enter a site.');
    const parsedDate = parseInputDate(dueDate);
    if (!parsedDate) return Alert.alert('Invalid date', 'Enter due date as MM/DD/YYYY.');
    try {
      setSaving(true);
      if (editing) {
        await updateChore(editing.id, { title: title.trim(), description: description.trim(), site: site.trim(), dueDate: parsedDate });
      } else {
        const input: ChoreInput = { title: title.trim(), description: description.trim(), site: site.trim(), dueDate: parsedDate };
        await addChore(input);
      }
      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not save chore.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.header}>
          <Text style={modal.title}>{editing ? 'Edit Chore' : 'New Chore'}</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={24} color={DARK_TEAL} />
          </Pressable>
        </View>
        <ScrollView style={modal.body} keyboardShouldPersistTaps="handled">
          <Text style={modal.label}>Title *</Text>
          <TextInput style={modal.input} value={title} onChangeText={setTitle} placeholder="Clean common area" placeholderTextColor="#aaa" />

          <Text style={modal.label}>Description</Text>
          <TextInput style={[modal.input, modal.textarea]} value={description} onChangeText={setDescription} placeholder="Details about this chore…" placeholderTextColor="#aaa" multiline numberOfLines={3} />

          <Text style={modal.label}>Site *</Text>
          <TextInput style={modal.input} value={site} onChangeText={setSite} placeholder="Building A, Pool, etc." placeholderTextColor="#aaa" />

          <Text style={modal.label}>Due Date (MM/DD/YYYY) *</Text>
          <TextInput style={modal.input} value={dueDate} onChangeText={setDueDate} placeholder="06/15/2025" placeholderTextColor="#aaa" keyboardType="numbers-and-punctuation" />
        </ScrollView>
        <View style={modal.footer}>
          <Pressable style={[modal.saveBtn, saving && modal.disabled]} onPress={save} disabled={saving}>
            <Text style={modal.saveBtnText}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Chore'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Assign Picker Modal ──────────────────────────────────────────────────────

function AssignModal({ visible, onClose, onAssigned, chore }: {
  visible: boolean; onClose: () => void; onAssigned: () => void; chore: ChoreRow | null;
}) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !chore?.site) return;
    (async () => {
      try {
        setLoading(true);
        const data = await listResidentsBySite(chore.site!);
        setResidents(data);
      } catch {
        Alert.alert('Error', 'Could not load residents.');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, chore?.site]);

  const assign = async (resident: Resident) => {
    if (!chore) return;
    try {
      setActingId(resident.uid);
      await assignChore(chore.id, resident.uid, resident.name);
      onAssigned(); onClose();
    } catch {
      Alert.alert('Error', 'Could not assign chore.');
    } finally {
      setActingId(null);
    }
  };

  const unassign = async () => {
    if (!chore) return;
    try {
      setActingId('unassign');
      await unassignChore(chore.id);
      onAssigned(); onClose();
    } catch {
      Alert.alert('Error', 'Could not unassign chore.');
    } finally {
      setActingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.header}>
          <Text style={modal.title}>Assign Resident</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={24} color={DARK_TEAL} />
          </Pressable>
        </View>

        {loading ? (
          <View style={assign_.centered}>
            <ActivityIndicator color={TEAL} />
          </View>
        ) : (
          <ScrollView style={modal.body}>
            {!!chore?.assignedTo && (
              <Pressable style={assign_.unassignBtn} onPress={unassign} disabled={actingId === 'unassign'}>
                <Ionicons name="person-remove-outline" size={16} color="#b91c1c" />
                <Text style={assign_.unassignText}>
                  {actingId === 'unassign' ? 'Removing…' : 'Remove current assignment'}
                </Text>
              </Pressable>
            )}

            {residents.length === 0 ? (
              <View style={assign_.emptyWrap}>
                <Ionicons name="people-outline" size={36} color={GRAY_BOX} />
                <Text style={assign_.empty}>No residents found.</Text>
              </View>
            ) : (
              residents.map((r) => {
                const isCurrentlyAssigned = chore?.assignedTo === r.uid;
                const busy = actingId === r.uid;
                return (
                  <Pressable
                    key={r.uid}
                    style={[assign_.card, isCurrentlyAssigned && assign_.cardActive]}
                    onPress={() => assign(r)}
                    disabled={!!actingId}>
                    <View style={assign_.cardLeft}>
                      <View style={assign_.avatar}>
                        <Text style={assign_.avatarText}>
                          {(r.name ?? r.email ?? '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <Text style={assign_.name}>{r.name ?? r.email ?? r.uid}</Text>
                        <Text style={assign_.meta}>{r.unitNumber ? `Unit ${r.unitNumber} · ` : ''}{r.email ?? r.uid}</Text>
                      </View>
                    </View>
                    {isCurrentlyAssigned && <Ionicons name="checkmark-circle" size={20} color="#205A30" />}
                    {busy && !isCurrentlyAssigned && <ActivityIndicator size="small" color={TEAL} />}
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Rotate Modal ─────────────────────────────────────────────────────────────

function RotateModal({ visible, onClose, onRotated }: { visible: boolean; onClose: () => void; onRotated: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  const handleRotate = async () => {
    try {
      setSubmitting(true);
      await rotateChores();
      onRotated(); onClose();
      Alert.alert('Done', 'Chores have been randomly reassigned to residents.');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unable to rotate chores.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.rotateModal}>
          <Text style={styles.rotateModalTitle}>Rotate chores now?</Text>
          <Text style={styles.rotateModalText}>This runs the admin rotation for the current week.</Text>
          <View style={styles.rotateModalFooter}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={handleRotate} disabled={submitting}>
              <Text style={styles.confirmText}>{submitting ? 'Running…' : 'Rotate'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ManageChores() {
  const [chores, setChores] = useState<ChoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showRotate, setShowRotate] = useState(false);
  const [editingChore, setEditingChore] = useState<ChoreRow | null>(null);
  const [assigningChore, setAssigningChore] = useState<ChoreRow | null>(null);

  const load = useCallback(async () => {
    const data = await listAllChores();
    setChores(data as ChoreRow[]);
  }, []);

  useEffect(() => {
    (async () => {
      try { setLoading(true); await load(); }
      catch { Alert.alert('Error', 'Could not load chores.'); }
      finally { setLoading(false); }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try { setRefreshing(true); await load(); }
    catch { Alert.alert('Error', 'Could not refresh.'); }
    finally { setRefreshing(false); }
  }, [load]);

  const confirmDelete = (chore: ChoreRow) => {
    Alert.alert('Delete chore?', `"${chore.title}" will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteChore(chore.id); await load(); }
          catch { Alert.alert('Error', 'Could not delete chore.'); }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  const pending = chores.filter((c) => !c.isCompleted).length;
  const done = chores.filter((c) => c.isCompleted).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Chores</Text>
        <Text style={styles.subtitle}>{pending} pending · {done} completed</Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.addBtn} onPress={() => { setEditingChore(null); setShowForm(true); }}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add Chore</Text>
        </Pressable>
        <Pressable style={styles.rotateBtn} onPress={() => setShowRotate(true)}>
          <Ionicons name="refresh-outline" size={16} color={TEAL} />
          <Text style={styles.rotateBtnText}>Rotate</Text>
        </Pressable>
      </View>

      <FlatList
        data={chores}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="checkmark-circle-outline" size={40} color={GRAY_BOX} />
            <Text style={styles.empty}>No chores yet. Tap Add Chore to create one.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.cardLeft}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                {!!item.description && (
                  <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
                )}
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={11} color={TEAL} />
                  <Text style={styles.meta}>{item.site ?? '—'}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={11} color={TEAL} />
                  <Text style={styles.meta}>Due {fmtDate(toDate(item.dueDate))}</Text>
                </View>
                <Pressable style={styles.assignRow} onPress={() => setAssigningChore(item)}>
                  <Ionicons
                    name={item.assignedTo ? 'person-circle-outline' : 'person-add-outline'}
                    size={13}
                    color={item.assignedTo ? '#205A30' : TEAL}
                  />
                  <Text style={[styles.assignText, item.assignedTo ? styles.assignedText : styles.unassignedText]}>
                    {item.assignedName ?? (item.assignedTo ? item.assignedTo.slice(0, 10) + '…' : 'Assign resident')}
                  </Text>
                  <Ionicons name="chevron-forward" size={11} color="#ccc" />
                </Pressable>
              </View>

              <View style={styles.cardRight}>
                <Text style={[styles.badge, item.isCompleted ? styles.badgeDone : styles.badgePending]}>
                  {item.isCompleted ? 'Done' : 'Pending'}
                </Text>
                <Pressable style={styles.iconBtn} onPress={() => { setEditingChore(item); setShowForm(true); }}>
                  <Ionicons name="pencil-outline" size={16} color={TEAL} />
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => confirmDelete(item)}>
                  <Ionicons name="trash-outline" size={16} color="#b91c1c" />
                </Pressable>
              </View>
            </View>
          </View>
        )}
      />

      <ChoreFormModal visible={showForm} onClose={() => setShowForm(false)} onSaved={load} editing={editingChore} />
      <AssignModal visible={!!assigningChore} onClose={() => setAssigningChore(null)} onAssigned={load} chore={assigningChore} />
      <RotateModal visible={showRotate} onClose={() => setShowRotate(false)} onRotated={load} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: DARK_TEAL },
  subtitle: { marginTop: 4, fontSize: 13, color: TEAL, fontWeight: '500' },

  actions: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 14 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: TEAL, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  rotateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: GRAY_BOX, paddingHorizontal: 16, paddingVertical: 11, borderRadius: 999,
  },
  rotateBtnText: { color: TEAL, fontSize: 13, fontWeight: '700' },

  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 10 },
  empty: { textAlign: 'center', color: TEAL, fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: GRAY_BOX, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardTop: { flexDirection: 'row', gap: 10 },
  cardLeft: { flex: 1, gap: 5 },
  cardRight: { alignItems: 'flex-end', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: DARK_TEAL },
  desc: { fontSize: 13, color: TEAL },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, color: '#999', fontWeight: '500' },
  assignRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  assignText: { fontSize: 12, fontWeight: '600', flex: 1 },
  assignedText: { color: '#205A30' },
  unassignedText: { color: TEAL },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  badgePending: { backgroundColor: '#F9EFD9', color: '#825102' },
  badgeDone: { backgroundColor: '#E3F2DA', color: '#205A30' },
  iconBtn: { padding: 4 },

  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.32)', padding: 20 },
  rotateModal: { width: '100%', borderRadius: 20, backgroundColor: '#fff', padding: 22, gap: 10 },
  rotateModalTitle: { fontSize: 18, fontWeight: '800', color: DARK_TEAL },
  rotateModalText: { color: TEAL, fontSize: 14 },
  rotateModalFooter: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: GRAY_BOX, borderRadius: 999, alignItems: 'center', paddingVertical: 12 },
  cancelText: { color: TEAL, fontWeight: '700' },
  confirmBtn: { flex: 1, backgroundColor: TEAL, borderRadius: 999, alignItems: 'center', paddingVertical: 12 },
  confirmText: { color: '#fff', fontWeight: '800' },
});

const modal = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: GRAY_BOX,
  },
  title: { fontSize: 20, fontWeight: '900', color: DARK_TEAL },
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  label: { fontSize: 11, fontWeight: '700', color: TEAL, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#fafafa', borderWidth: 1.5, borderColor: GRAY_BOX,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: DARK_TEAL, fontWeight: '600',
  },
  textarea: { height: 90, textAlignVertical: 'top' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: GRAY_BOX },
  saveBtn: {
    backgroundColor: TEAL, borderRadius: 999, paddingVertical: 15, alignItems: 'center',
    shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});

const assign_ = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 10 },
  empty: { textAlign: 'center', color: TEAL, fontSize: 14, fontWeight: '600' },
  unassignBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 14, marginBottom: 10, backgroundColor: '#FEF2F2',
    borderRadius: 14, borderWidth: 1, borderColor: '#FECACA',
  },
  unassignText: { color: '#b91c1c', fontWeight: '700', fontSize: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1, borderColor: GRAY_BOX, padding: 14, marginBottom: 8,
  },
  cardActive: { borderColor: '#205A30', backgroundColor: '#F0FAF2' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  name: { fontSize: 15, fontWeight: '700', color: DARK_TEAL },
  meta: { fontSize: 12, color: '#999', marginTop: 2 },
});