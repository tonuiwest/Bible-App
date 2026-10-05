import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { useTheme } from '../context/ThemeContext';
import {
  NARRATOR_STYLES, SPEEDS, getTtsSettings, saveTtsSettings, getNarratorVoices, speakSample,
} from '../utils/tts';

/** Bottom sheet for choosing the read-aloud narrator: style, voice and speed. */
export default function VoiceSheet({ visible, onClose, onSaved }) {
  const { colors, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = useState(null);
  const [voices, setVoices] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!visible) return;
    getTtsSettings().then(setSettings);
    getNarratorVoices().then(setVoices);
    return () => Speech.stop();
  }, [visible]);

  if (!settings) return null;

  const update = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setPreviewing(true);
    speakSample(next, () => setPreviewing(false));
  };

  const done = async () => {
    Speech.stop();
    const saved = await saveTtsSettings(settings);
    onSaved && onSaved(saved);
    onClose();
  };

  const openTtsSettings = () => {
    if (Platform.OS === 'android') {
      Linking.sendIntent?.('com.android.settings.TTS_SETTINGS').catch(() => Linking.openSettings());
    } else {
      Linking.openSettings();
    }
  };

  const Label = ({ children }) => (
    <Text style={{ color: colors.gold, fontSize: 10, letterSpacing: 1.6, marginTop: 18, marginBottom: 8, fontFamily: fonts.sansBold }}>{children}</Text>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={done}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ maxHeight: '86%', backgroundColor: colors.parchment, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12 }}>
            <Ionicons name="headset" size={20} color={colors.gold} />
            <Text style={{ flex: 1, marginLeft: 8, color: colors.textPrimary, fontSize: 19, fontFamily: fonts.serifBold }}>Narrator</Text>
            {previewing ? <ActivityIndicator size="small" color={colors.gold} /> : (
              <TouchableOpacity onPress={() => { setPreviewing(true); speakSample(settings, () => setPreviewing(false)); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="play-circle-outline" size={18} color={colors.gold} />
                <Text style={{ color: colors.gold, fontFamily: fonts.sansBold, fontSize: 12 }}>Preview</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
            <Label>READING STYLE</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 }}>
              {NARRATOR_STYLES.map((st) => {
                const on = settings.styleId === st.id;
                return (
                  <TouchableOpacity key={st.id} onPress={() => update({ styleId: st.id })}
                    style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.goldLight : colors.card }}>
                    <Ionicons name={st.icon} size={16} color={colors.gold} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: fonts.sansBold }}>{st.label}</Text>
                      <Text numberOfLines={1} style={{ color: colors.textSecondary, fontSize: 10.5, fontFamily: fonts.sans }}>{st.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Label>SPEED</Label>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {SPEEDS.map((sp) => {
                const on = Math.abs((settings.speed || 1) - sp) < 0.01;
                return (
                  <TouchableOpacity key={sp} onPress={() => update({ speed: sp })}
                    style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: on ? colors.gold : colors.border, backgroundColor: on ? colors.goldLight : colors.card }}>
                    <Text style={{ color: colors.textPrimary, fontSize: 12, fontFamily: on ? fonts.sansBold : fonts.sansMedium }}>{sp}×</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Label>VOICE</Label>
            {voices === null ? (
              <ActivityIndicator color={colors.gold} style={{ marginVertical: 12 }} />
            ) : (
              <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' }}>
                {[{ id: null, label: 'Phone default', accent: 'Automatic', offline: true }, ...voices].map((v, i) => {
                  const on = (settings.voiceId || null) === v.id;
                  return (
                    <TouchableOpacity key={v.id || 'default'} onPress={() => update({ voiceId: v.id, voiceLang: v.language || null })}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: on ? colors.goldLight : 'transparent' }}>
                      <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={16} color={on ? colors.gold : colors.textSecondary} />
                      <Text style={{ flex: 1, marginLeft: 10, color: colors.textPrimary, fontSize: 13, fontFamily: on ? fonts.sansBold : fonts.sans }}>{v.label}</Text>
                      {v.enhanced ? <Text style={{ color: colors.gold, fontSize: 10, fontFamily: fonts.sansBold, marginRight: 6 }}>HD</Text> : null}
                      {!v.offline ? <Ionicons name="cloud-outline" size={14} color={colors.textSecondary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <TouchableOpacity onPress={openTtsSettings} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
              <Ionicons name="download-outline" size={14} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11.5, fontFamily: fonts.sans }}>
                Want more voices? Install free voices in your phone’s text-to-speech settings.
              </Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
            <TouchableOpacity onPress={done} style={{ paddingVertical: 13, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: fonts.sansBold, fontSize: 15 }}>Use this narrator</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
