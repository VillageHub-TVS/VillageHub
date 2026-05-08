import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import {
  listEvents,
  listGardeningSlots,
  type CalendarEvent,
  type GardeningSlot,
} from '@/services/calendarService';
import { listBooking } from '@/services/roomBookingService';

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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UserCalendars() {
  const [tab, setTab] = useState<Tab>('events');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [gardeningSlots, setGardeningSlots] = useState<GardeningSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  if (loading) {
    return (
      <View style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={TEAL} size="large" />
      </View>
    );
  }

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'events', label: 'Events', icon: 'calendar-outline' },
    { key: 'bookings', label: 'Bookings', icon: 'bed-outline' },
    { key: 'gardening', label: 'Garden', icon: 'leaf-outline' },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Calendars</Text>
        <Text style={styles.subtitle}>Community schedule</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}>
            <Ionicons
              name={t.icon}
              size={15}
              color={tab === t.key ? '#fff' : TEAL}
              style={{ marginBottom: 2 }}
            />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Events */}
      {tab === 'events' && (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
          ListHeaderComponent={
            <Text style={styles.listCount}>{events.length} event{events.length !== 1 ? 's' : ''}</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="calendar-outline" size={40} color={GRAY_BOX} />
              <Text style={styles.empty}>No events yet.</Text>
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
      )}

      {/* Bookings */}
      {tab === 'bookings' && (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
          ListHeaderComponent={
            <Text style={styles.listCount}>{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="bed-outline" size={40} color={GRAY_BOX} />
              <Text style={styles.empty}>No bookings yet.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const checkIn = toDate(item.checkIn);
            const checkOut = toDate(item.checkOut);
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
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Gardening */}
      {tab === 'gardening' && (
        <FlatList
          data={gardeningSlots}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
          ListHeaderComponent={
            <Text style={styles.listCount}>{gardeningSlots.length} session{gardeningSlots.length !== 1 ? 's' : ''}</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="leaf-outline" size={40} color={GRAY_BOX} />
              <Text style={styles.empty}>No sessions yet.</Text>
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

  listCount: { fontSize: 12, color: TEAL, fontWeight: '700', paddingHorizontal: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  list: { paddingHorizontal: 20, paddingBottom: 32, gap: 10 },
  emptyWrap: { alignItems: 'center', marginTop: 60, gap: 10 },
  empty: { textAlign: 'center', color: TEAL, fontSize: 14, fontWeight: '600' },

  card: {
    backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 1, borderColor: GRAY_BOX, padding: 14, flexDirection: 'row', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },

  // date badge — default (teal)
  dateBadge: {
    width: 46, height: 52, backgroundColor: TEAL,
    borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  dateBadgeDay: { fontSize: 20, fontWeight: '900', color: '#fff', lineHeight: 22 },
  dateBadgeMon: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)', letterSpacing: 0.5 },

  // date badge — garden (yellow)
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
});