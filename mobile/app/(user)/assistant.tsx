import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sendChat, type ChatTurn, type ClinicSource } from '@/services/chatService';

const TEAL = '#1a7a6e';
const DARK_TEAL = '#0f5a51';
const BG = '#F8F8F6';
const INK = '#1a1a1a';

type Message = ChatTurn & { id: string; sources?: ClinicSource[]; error?: boolean };

const SUGGESTIONS = [
  'Any free clinics coming up?',
  'Where can I get a flu shot?',
  'Do I need insurance for a clinic visit?',
];

const formatDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (t?: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, '0')}${suffix}` : `${hour}${suffix}`;
};

function ClinicCard({ clinic }: { clinic: ClinicSource }) {
  const time = [formatTime(clinic.start_time), formatTime(clinic.end_time)].filter(Boolean).join(' – ');
  return (
    <View style={styles.clinicCard}>
      <View style={styles.clinicTop}>
        <View style={styles.dateChip}>
          <Text style={styles.dateChipText}>{formatDate(clinic.clinic_date)}</Text>
        </View>
        {clinic.confirmed_by_staff === false && <Text style={styles.unconfirmed}>Not yet confirmed</Text>}
      </View>
      <Text style={styles.clinicName}>{clinic.clinic_name}</Text>
      {!!time && (
        <View style={styles.clinicRow}>
          <Ionicons name="time-outline" size={14} color="#777" />
          <Text style={styles.clinicMeta}>{time}</Text>
        </View>
      )}
      {!!clinic.location && (
        <Pressable
          style={styles.clinicRow}
          onPress={() =>
            Linking.openURL(
              Platform.select({
                ios: `http://maps.apple.com/?q=${encodeURIComponent(clinic.location!)}`,
                default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.location!)}`,
              }),
            )
          }>
          <Ionicons name="location-outline" size={14} color={TEAL} />
          <Text style={[styles.clinicMeta, { color: TEAL }]}>{clinic.location}</Text>
        </Pressable>
      )}
      {!!clinic.services?.length && (
        <Text style={styles.clinicServices} numberOfLines={2}>
          {clinic.services.join(' · ')}
        </Text>
      )}
    </View>
  );
}

function Bubble({ message }: { message: Message }) {
  const mine = message.role === 'user';
  return (
    <View style={[styles.msgRow, mine && styles.msgRowMine]}>
      {!mine && (
        <Image source={require('@/assets/images/logo.png')} style={styles.avatar} />
      )}
      <View style={[styles.msgCol, mine && { alignItems: 'flex-end' }]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, message.error && styles.bubbleError]}>
          <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{message.content}</Text>
        </View>
        {!!message.sources?.length && (
          <View style={styles.clinicList}>
            {message.sources.map((c) => (
              <ClinicCard key={String(c.id)} clinic={c} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function Typing() {
  return (
    <View style={styles.msgRow}>
      <Image source={require('@/assets/images/logo.png')} style={styles.avatar} />
      <View style={[styles.bubble, styles.bubbleTheirs, styles.typing]}>
        <ActivityIndicator size="small" color={TEAL} />
        <Text style={styles.typingText}>Looking that up…</Text>
      </View>
    </View>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, sending]);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      const userMsg: Message = { id: `u${Date.now()}`, role: 'user', content };
      const history = [...messages.filter((m) => !m.error), userMsg].map(({ role, content }) => ({ role, content }));
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setSending(true);
      const { reply, sources } = await sendChat(history);
      setMessages((prev) => [
        ...prev,
        { id: `a${Date.now()}`, role: 'assistant', content: reply, sources, error: reply.startsWith("I can't reach") },
      ]);
      setSending(false);
    },
    [messages, sending],
  );

  const empty = messages.length === 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble message={item} />}
        contentContainerStyle={[styles.list, empty && { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.welcome}>
            <Image source={require('@/assets/images/logo.png')} style={styles.welcomeLogo} />
            <Text style={styles.welcomeTitle}>How can I help?</Text>
            <Text style={styles.welcomeSub}>
              Ask me about upcoming mobile clinics near you. For anything else, you can always call 211.
            </Text>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={({ pressed }) => [styles.chip, pressed && { opacity: 0.6 }]} onPress={() => send(s)}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={sending ? <Typing /> : null}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Type your question"
          placeholderTextColor="#9a9a9a"
          multiline
          maxLength={500}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => send(input)}
        />
        <Pressable
          onPress={() => send(input)}
          disabled={!input.trim() || sending}
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnOff]}
          accessibilityLabel="Send message">
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  list: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 14 },

  // welcome
  welcome: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingBottom: 40 },
  welcomeLogo: { width: 64, height: 64, resizeMode: 'contain', marginBottom: 14 },
  welcomeTitle: { fontSize: 24, fontWeight: '800', color: DARK_TEAL },
  welcomeSub: { fontSize: 14, lineHeight: 20, color: '#666', textAlign: 'center', marginTop: 8, maxWidth: 300 },
  chips: { marginTop: 24, gap: 8, alignSelf: 'stretch' },
  chip: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d8d8d4',
  },
  chipText: { fontSize: 14, color: INK, fontWeight: '500' },

  // messages
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMine: { justifyContent: 'flex-end' },
  msgCol: { flexShrink: 1, maxWidth: '84%', gap: 8 },
  avatar: { width: 28, height: 28, resizeMode: 'contain', marginBottom: 2 },
  bubble: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 14 },
  bubbleMine: { backgroundColor: TEAL, borderBottomRightRadius: 5 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 5, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e2e2de' },
  bubbleError: { backgroundColor: '#FBEFEA', borderColor: '#f0cfc4' },
  bubbleText: { fontSize: 15, lineHeight: 21, color: INK },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingText: { fontSize: 13, color: '#777' },

  // clinic cards
  clinicList: { gap: 8 },
  clinicCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 5,
    borderLeftWidth: 4,
    borderLeftColor: TEAL,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  clinicTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateChip: { backgroundColor: '#E3F2EF', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  dateChipText: { fontSize: 11, fontWeight: '700', color: DARK_TEAL },
  unconfirmed: { fontSize: 11, color: '#825102', fontWeight: '600' },
  clinicName: { fontSize: 15, fontWeight: '700', color: INK },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clinicMeta: { fontSize: 13, color: '#555', flexShrink: 1 },
  clinicServices: { fontSize: 12, color: '#888', marginTop: 2 },

  // input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dcdcd8',
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 42,
    backgroundColor: '#fff',
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#d4d4d0',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 11 : 8,
    paddingBottom: Platform.OS === 'ios' ? 11 : 8,
    fontSize: 15,
    color: INK,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: '#b9c9c6' },
});
