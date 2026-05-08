import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { markChoreCompleted } from '@/services/choreService';
import { useAuth } from '@/state/auth';

const TEAL = '#1a7a6e';
const DARK_TEAL = '#0f5a51';
const GRAY_BOX = '#e8e8e8';

export default function Chores() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const handleMarkComplete = async () => {
    if (!user?.uid) {
      Alert.alert('Sign in required', 'Log in to record chore completion.');
      return;
    }
    try {
      setSubmitting(true);
      await markChoreCompleted(user.uid);
      Alert.alert('Saved', 'Chore completion was recorded for this week.');
    } catch {
      Alert.alert('Error', 'Unable to mark chore as completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Chores</Text>
      <Text style={styles.subtitle}>
        Mark your weekly chore as done when finished. Rotating the chore schedule is handled by staff in the admin app.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Mark this week complete</Text>
        <Text style={styles.cardBodyText}>
          This records completion for your account for the current week.
        </Text>
        <Pressable
          style={[styles.primaryButton, (submitting || !user) && styles.primaryButtonDisabled]}
          onPress={handleMarkComplete}
          disabled={submitting || !user}>
          <Text style={styles.primaryButtonText}>
            {submitting ? 'Saving...' : 'Mark my week complete'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff', padding: 20, paddingTop: 56, gap: 16 },
  title: { fontSize: 26, fontWeight: '900', color: DARK_TEAL },
  subtitle: { color: TEAL, lineHeight: 22, fontSize: 14, fontWeight: '500' },
  card: {
    backgroundColor: GRAY_BOX,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: DARK_TEAL },
  cardBodyText: { color: TEAL, fontSize: 14, lineHeight: 20 },
  primaryButton: {
    backgroundColor: TEAL,
    borderRadius: 999,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});