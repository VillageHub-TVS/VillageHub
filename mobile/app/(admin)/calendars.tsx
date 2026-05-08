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
  createEvent,
  createGardeningSlot,
  listEvents,
  listGardeningSlots,
  type CalendarEvent,
  type GardeningSlot,
} from '@/services/calendarService';
import { listBooking, updateBooking } from '@/services/roomBookingService';

const TEAL = '#1a7a6e';
const DARK_TEAL = '#0f5a51';
const YELLOW = '#f9e84e';
const GRAY_BOX = '#e8e8e8';

// ─── Types ────────────────────────────────────────────────────────────────────

type BookingRow = {
  id: string;
  title: string;
  description?: string;
  site?: string;
  reservedSpot?: string;
  user?: string;
  approved?: boolean;
  checkIn?: Timestamp | { seconds?: number } | Date;
  checkOut?: Timestamp | { seconds?: number } | Date;
};

type Tab = 'events' | 'bookings' | 'gardening';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(val: unknown): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return new Date((val as { seconds: number }).seconds * 1000);
  }
  return new Date(0);
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDayOfMonth(date: Date): string {
  return date.getDate().toString();
}

function getMonthAbbr(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

function parseInputDate(str: string): Date | null {
  const parts = str.trim().split('/');
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  if (isNaN(m) || isNaN(d) || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

// ─── Add Event Modal ──────────────────────────────────────────────────────────

function AddEventModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setDescription(''); setLocation(''); setStartDate(''); setEndDate(''); };

  const save = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a title.');
    const start = parseInputDate(startDate);
    const end = parseInputDate(endDate);
    if (!start) return Alert.alert('Invalid date', 'Enter start date as MM/DD/YYYY.');
    if (!end) return Alert.alert('Invalid date', 'Enter end date as MM/DD/YYYY.');
    if (end < start) return Alert.alert('Invalid date', 'End date must be after start date.');
    try {
      setSaving(true);
      await createEvent({
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        startDate: Timestamp.fromDate(start),
        endDate: Timestamp.fromDate(end),
      });
      reset(); onSaved(); onClose();
    } catch {
      Alert.alert('Error', 'Could not create event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.header}>
          <Text style={modal.title}>New Event</Text>
          <Pressable onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={DARK_TEAL} />
          </Pressable>
        </View>
        <ScrollView style={modal.body} keyboardShouldPersistTaps="handled">
          <Text style={modal.label}>Title *</Text>
          <TextInput style={modal.input} value={title} onChangeText={setTitle} placeholder="Community BBQ" placeholderTextColor="#aaa" />
          <Text style={modal.label}>Description</Text>
          <TextInput style={[modal.input, modal.textarea]} value={description} onChangeText={setDescription} placeholder="Details about the event…" placeholderTextColor="#aaa" multiline numberOfLines={3} />
          <Text style={modal.label}>Location</Text>
          <TextInput style={modal.input} value={location} onChangeText={setLocation} placeholder="Clubhouse, Pool, etc." placeholderTextColor="#aaa" />
          <Text style={modal.label}>Start Date (MM/DD/YYYY) *</Text>
          <TextInput style={modal.input} value={startDate} onChangeText={setStartDate} placeholder="06/15/2025" placeholderTextColor="#aaa" keyboardType="numbers-and-punctuation" />
          <Text style={modal.label}>End Date (MM/DD/YYYY) *</Text>
          <TextInput style={modal.input} value={endDate} onChangeText={setEndDate} placeholder="06/15/2025" placeholderTextColor="#aaa" keyboardType="numbers-and-punctuation" />
        </ScrollView>
        <View style={modal.footer}>
          <Pressable style={[modal.saveBtn, saving && modal.disabled]} onPress={save} disabled={saving}>
            <Text style={modal.saveBtnText}>{saving ? 'Saving…' : 'Create Event'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Add Gardening Modal ──────────────────────────────────────────────────────

function AddGardeningModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plot, setPlot] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => { setTitle(''); setDescription(''); setPlot(''); setDate(''); };

  const save = async () => {
    if (!title.trim()) return Alert.alert('Required', 'Please enter a title.');
    const d = parseInputDate(date);
    if (!d) return Alert.alert('Invalid date', 'Enter date as MM/DD/YYYY.');
    try {
      setSaving(true);
      await createGardeningSlot({
        title: title.trim(),
        description: description.trim(),
        plot: plot.trim(),
        date: Timestamp.fromDate(d),
      });
      reset(); onSaved(); onClose();
    } catch {
      Alert.alert('Error', 'Could not create gardening slot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modal.container}>
        <View style={modal.header}>
          <Text style={modal.title}>New Gardening Session</Text>
          <Pressable onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={DARK_TEAL} />
          </Pressable>
        </View>
        <ScrollView style={modal.body} keyboardShouldPersistTaps="handled">
          <Text style={modal.label}>Title *</Text>
          <TextInput style={modal.input} value={title} onChangeText={setTitle} placeholder="Spring Planting Day" placeholderTextColor="#aaa" />
          <Text style={modal.label}>Description</Text>
          <TextInput style={[modal.input, modal.textarea]} value={description} onChangeText={setDescription} placeholder="What's happening this session…" placeholderTextColor="#aaa" multiline numberOfLines={3} />
          <Text style={modal.label}>Plot</Text>
          <TextInput style={modal.input} value={plot} onChangeText={setPlot} placeholder="Plot A3" placeholderTextColor="#aaa" />
          <Text style={modal.label}>Date (MM/DD/YYYY) *</Text>
          <TextInput style={modal.input} value={date} onChangeText={setDate} placeholder="06/15/2025" placeholderTextColor="#aaa" keyboardType="numbers-and-punctuation" />
        </ScrollView>
        <View style={modal.footer}>
          <Pressable style={[modal.saveBtn, saving && modal.disabled]} onPress={save} disabled={saving}>
            <Text style={modal.saveBtnText}>{saving ? 'Saving…' : 'Create Session'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdminCalendars() {
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [gardeningSlots, setGardeningSlots] = useState<GardeningSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showGardeningModal, setShowGardeningModal] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [evts, bkgs, garden] = await Promise.all([
      listEvents(),
      listBooking() as Promise<BookingRow[]>,
      listGardeningSlots(),
    ]);
    setEvents(evts);
    setBookings(bkgs.sort((a, b) => toDate(a.checkIn).getTime() - toDate(b.checkIn).getTime()));
    setGardeningSlots(garden);
  }, []);

  useEffect(() => {
    (async () => {
      try { setLoading(true); await load(); }
      catch { Alert.alert('Error', 'Could not load calendar data.'); }
      finally { setLoading(false); }
    })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    try { setRefreshing(true); await load(); }
    catch { Alert.alert('Error', 'Could not refresh.'); }
    finally { setRefreshing(false); }
  }, [load]);

  const toggleApproval = (booking: BookingRow) => {
    const next = !booking.approved;
    Alert.alert(
      next ? 'Approve booking?' : 'Mark as pending?',
      next ? 'This will approve the booking.' : 'This will set the booking back to pending.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Approve' : 'Mark pending',
          style: next ? 'default' : 'destructive',
          onPress: async () => {
            try {
              setActingId(booking.id);
              await updateBooking(booking.id, { approved: next });
              await load();
            } catch {
              Alert.alert('Error', 'Could not update booking.');
            } finally {
              setActingId(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  const TABS: { key: Tab; icon: any; label: string }[] = [
    { key: 'events', icon: 'calendar-outline', label: 'Events' },
    { key: 'bookings', icon: 'bed-outline', label: 'Bookings' },
    { key: 'gardening', icon: 'leaf-outline', label: 'Garden' },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendars</Text>
        <Text style={styles.subtitle}>Manage community schedule</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={t.icon} size={15} color={tab === t.key ? '#fff' : TEAL} style={{ marginBottom: 2 }} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Events Tab */}
      {tab === 'events' && (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listCount}>{events.length} event{events.length !== 1 ? 's' : ''}</Text>
            <Pressable style={styles.addBtn} onPress={() => setShowEventModal(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="calendar-outline" size={40} color={GRAY_BOX} />
                <Text style={styles.empty}>No events yet. Tap Add to create one.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const start = toDate(item.startDate);
              const end = toDate(item.endDate);
              return (
                <View style={styles.card}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeDay}>{getDayOfMonth(start)}</Text>
                    <Text style={styles.dateBadgeMon}>{getMonthAbbr(start)}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {!!item.description && <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>}
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={11} color={TEAL} />
                      <Text style={styles.meta}>{fmtDate(start)} → {fmtDate(end)}</Text>
                    </View>
                    {!!item.location && (
                      <View style={styles.metaRow}>
                        <Ionicons name="location-outline" size={11} color={TEAL} />
                        <Text style={styles.meta}>{item.location}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
          <AddEventModal visible={showEventModal} onClose={() => setShowEventModal(false)} onSaved={load} />
        </>
      )}

      {/* Bookings Tab */}
      {tab === 'bookings' && (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listCount}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</Text>
            <Text style={styles.listNote}>Tap to approve or pend</Text>
          </View>
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="bed-outline" size={40} color={GRAY_BOX} />
                <Text style={styles.empty}>No bookings yet.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const checkIn = toDate(item.checkIn);
              const checkOut = toDate(item.checkOut);
              const busy = actingId === item.id;
              return (
                <View style={styles.card}>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeDay}>{getDayOfMonth(checkIn)}</Text>
                    <Text style={styles.dateBadgeMon}>{getMonthAbbr(checkIn)}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.rowTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.badge, item.approved ? styles.badgeOk : styles.badgeWait]}>
                        {item.approved ? 'Approved' : 'Pending'}
                      </Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={11} color={TEAL} />
                      <Text style={styles.meta}>{item.site ?? '—'} · {item.reservedSpot ?? '—'}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="time-outline" size={11} color={TEAL} />
                      <Text style={styles.meta}>{fmtDate(checkIn)} → {fmtDate(checkOut)}</Text>
                    </View>
                    {item.user && (
                      <View style={styles.metaRow}>
                        <Ionicons name="person-outline" size={11} color={TEAL} />
                        <Text style={styles.meta}>Resident: {item.user.slice(0, 8)}…</Text>
                      </View>
                    )}
                    <Pressable
                      style={[item.approved ? styles.pendingBtn : styles.approveBtn, busy && styles.btnDisabled]}
                      onPress={() => toggleApproval(item)}
                      disabled={busy}>
                      <Text style={item.approved ? styles.pendingBtnText : styles.approveBtnText}>
                        {busy ? 'Saving…' : item.approved ? 'Mark Pending' : 'Approve'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        </>
      )}

      {/* Gardening Tab */}
      {tab === 'gardening' && (
        <>
          <View style={styles.listHeader}>
            <Text style={styles.listCount}>{gardeningSlots.length} session{gardeningSlots.length !== 1 ? 's' : ''}</Text>
            <Pressable style={styles.addBtn} onPress={() => setShowGardeningModal(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>
          <FlatList
            data={gardeningSlots}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="leaf-outline" size={40} color={GRAY_BOX} />
                <Text style={styles.empty}>No sessions yet. Tap Add to create one.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const date = toDate(item.date);
              return (
                <View style={styles.card}>
                  <View style={[styles.dateBadge, styles.dateBadgeGarden]}>
                    <Text style={[styles.dateBadgeDay, styles.dateBadgeDayGarden]}>{getDayOfMonth(date)}</Text>
                    <Text style={[styles.dateBadgeMon, styles.dateBadgeMonGarden]}>{getMonthAbbr(date)}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {!!item.description && <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>}
                    <View style={styles.metaRow}>
                      <Ionicons name="calendar-outline" size={11} color={TEAL} />
                      <Text style={styles.meta}>{fmtDate(date)}</Text>
                    </View>
                    {!!item.plot && (
                      <View style={styles.metaRow}>
                        <Ionicons name="map-outline" size={11} color={TEAL} />
                        <Text style={styles.meta}>{item.plot}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            }}
          />
          <AddGardeningModal visible={showGardeningModal} onClose={() => setShowGardeningModal(false)} onSaved={load} />
        </>
      )}
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

  tabs: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 12,
    backgroundColor: GRAY_BOX, borderRadius: 999, padding: 4, gap: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  tabActive: { backgroundColor: TEAL },
  tabText: { fontSize: 12, color: TEAL, fontWeight: '700' },
  tabTextActive: { color: '#fff', fontWeight: '800' },

  listHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 10,
  },
  listCount: { fontSize: 12, color: TEAL, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  listNote: { fontSize: 12, color: '#999', fontWeight: '500' },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: TEAL, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },

  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 10 },
  empty: { textAlign: 'center', color: TEAL, fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: GRAY_BOX, padding: 14, flexDirection: 'row', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },

  // date badge — teal (events, bookings)
  dateBadge: {
    width: 46, height: 52, backgroundColor: TEAL,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateBadgeDay: { fontSize: 20, fontWeight: '900', color: '#fff', lineHeight: 22 },
  dateBadgeMon: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },

  // date badge — yellow (gardening)
  dateBadgeGarden: { backgroundColor: YELLOW },
  dateBadgeDayGarden: { color: DARK_TEAL },
  dateBadgeMonGarden: { color: TEAL },

  cardBody: { flex: 1, gap: 5 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: DARK_TEAL },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  badgeWait: { backgroundColor: '#F9EFD9', color: '#825102' },
  badgeOk: { backgroundColor: '#E3F2DA', color: '#205A30' },
  desc: { fontSize: 13, color: TEAL },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, color: '#999', fontWeight: '500' },

  approveBtn: {
    marginTop: 8, backgroundColor: TEAL, borderRadius: 999,
    paddingVertical: 9, alignItems: 'center',
    shadowColor: TEAL, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 2,
  },
  approveBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pendingBtn: {
    marginTop: 8, borderWidth: 1.5, borderColor: GRAY_BOX,
    borderRadius: 999, paddingVertical: 9, alignItems: 'center',
  },
  pendingBtnText: { color: TEAL, fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
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