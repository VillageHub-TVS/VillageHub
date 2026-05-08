import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { listBooking, updateBooking } from '@/services/roomBookingService';
import { subscribeToAuthState } from '@/services/authService';
import { Timestamp } from 'firebase/firestore';

const TEAL = '#1a7a6e';
const DARK_TEAL = '#0f5a51';
const GRAY_BOX = '#e8e8e8';

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
  createdAt?: Timestamp | { seconds?: number };
};

function toDate(val: BookingRow['checkIn']): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (val instanceof Timestamp) return val.toDate();
  if (typeof val === 'object' && 'seconds' in val && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000);
  }
  return new Date(val as Date);
}

type Tab = 'pending' | 'approved' | 'all';

export default function ManageBookings() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('pending');
  const [actingId, setActingId] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => setIsSignedIn(!!user));
    return unsubscribe;
  }, []);

  const load = useCallback(async () => {
    if (isSignedIn === false) return;
    const data = (await listBooking()) as BookingRow[];
    setBookings(data);
  }, [isSignedIn]);

  useEffect(() => {
    if (isSignedIn === null) return;
    if (isSignedIn === false) { setBookings([]); setLoading(false); return; }
    (async () => {
      try { setLoading(true); await load(); }
      catch { Alert.alert('Error', 'Could not load bookings.'); }
      finally { setLoading(false); }
    })();
  }, [load, isSignedIn]);

  const onRefresh = useCallback(async () => {
    if (!isSignedIn) return;
    try { setRefreshing(true); await load(); }
    catch { Alert.alert('Error', 'Could not refresh.'); }
    finally { setRefreshing(false); }
  }, [load, isSignedIn]);

  const filtered = useMemo(() => {
    if (tab === 'pending') return bookings.filter((b) => !b.approved);
    if (tab === 'approved') return bookings.filter((b) => !!b.approved);
    return bookings;
  }, [bookings, tab]);

  const approve = async (id: string) => {
    if (!isSignedIn) return;
    try {
      setActingId(id);
      await updateBooking(id, { approved: true });
      await load();
    } catch {
      Alert.alert('Error', 'Could not approve booking.');
    } finally {
      setActingId(null);
    }
  };

  const unapprove = (id: string) => {
    if (!isSignedIn) return;
    Alert.alert('Mark pending?', 'This will set the booking back to pending.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark pending', style: 'destructive',
        onPress: async () => {
          try {
            setActingId(id);
            await updateBooking(id, { approved: false });
            await load();
          } catch {
            Alert.alert('Error', 'Could not update booking.');
          } finally {
            setActingId(null);
          }
        },
      },
    ]);
  };

  if (loading || isSignedIn === null) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  const pendingCount = bookings.filter((b) => !b.approved).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Bookings</Text>
        <Text style={styles.subtitle}>{pendingCount} pending approval</Text>
      </View>

      <View style={styles.tabs}>
        {(['pending', 'approved', 'all'] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={<Text style={styles.empty}>No bookings in this view.</Text>}
        renderItem={({ item }) => {
          const busy = actingId === item.id;
          return (
            <View style={styles.card}>
              <View style={styles.rowTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={[styles.badge, item.approved ? styles.badgeOk : styles.badgeWait]}>
                  {item.approved ? 'Approved' : 'Pending'}
                </Text>
              </View>
              {!!item.description && (
                <Text style={styles.desc} numberOfLines={3}>{item.description}</Text>
              )}
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={11} color={TEAL} />
                <Text style={styles.meta}>{item.site ?? '—'} · {item.reservedSpot ?? '—'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={11} color={TEAL} />
                <Text style={styles.meta}>
                  {toDate(item.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' → '}
                  {toDate(item.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
              {item.user ? (
                <View style={styles.metaRow}>
                  <Ionicons name="person-outline" size={11} color={TEAL} />
                  <Text style={styles.meta}>Resident: {item.user.slice(0, 8)}…</Text>
                </View>
              ) : null}

              {!item.approved ? (
                <Pressable
                  style={[styles.approveBtn, busy && styles.btnDisabled]}
                  onPress={() => approve(item.id)}
                  disabled={busy}>
                  <Text style={styles.approveBtnText}>{busy ? 'Saving…' : 'Approve'}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={[styles.pendingBtn, busy && styles.btnDisabled]}
                  onPress={() => unapprove(item.id)}
                  disabled={busy}>
                  <Text style={styles.pendingBtnText}>Mark Pending</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  centered: { justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: DARK_TEAL },
  subtitle: { marginTop: 4, fontSize: 13, color: TEAL, fontWeight: '500' },

  tabs: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 14,
    backgroundColor: GRAY_BOX, borderRadius: 999, padding: 4, gap: 4,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  tabActive: { backgroundColor: TEAL },
  tabText: { fontSize: 13, color: TEAL, fontWeight: '600' },
  tabTextActive: { color: '#fff', fontWeight: '800' },

  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  empty: { textAlign: 'center', color: TEAL, marginTop: 40, fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: GRAY_BOX, padding: 14, gap: 7,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: DARK_TEAL },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, fontSize: 11, fontWeight: '700', overflow: 'hidden' },
  badgeWait: { backgroundColor: '#F9EFD9', color: '#825102' },
  badgeOk: { backgroundColor: '#E3F2DA', color: '#205A30' },
  desc: { fontSize: 13, color: TEAL },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, color: '#999', fontWeight: '500' },

  approveBtn: {
    marginTop: 6, backgroundColor: TEAL, borderRadius: 999,
    paddingVertical: 11, alignItems: 'center',
    shadowColor: TEAL, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  approveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  pendingBtn: {
    marginTop: 6, borderWidth: 1.5, borderColor: GRAY_BOX,
    borderRadius: 999, paddingVertical: 11, alignItems: 'center',
  },
  pendingBtnText: { color: TEAL, fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});