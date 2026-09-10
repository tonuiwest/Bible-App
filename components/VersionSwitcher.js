import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useVersion } from '../context/VersionContext';

/**
 * A small tappable version badge (e.g. "KJV") that opens a picker modal.
 * Mount this on any screen to let the reader switch translations right
 * there — the change applies instantly everywhere via VersionContext.
 */
export default function VersionSwitcher({ style, compact = false }) {
  const { colors, fonts } = useTheme();
  const { version, setVersion, versions } = useVersion();
  const [open, setOpen] = useState(false);
  const current = versions.find(v => v.id === version);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[{
          backgroundColor: colors.gold,
          paddingHorizontal: compact ? 8 : 12,
          paddingVertical: compact ? 4 : 6,
          borderRadius: 8,
          flexDirection: 'row',
          alignItems: 'center',
        }, style]}
      >
        <Text style={{ color: '#fff', fontSize: compact ? 10 : 11, fontWeight: '700', fontFamily: fonts.sansBold }}>
          {current ? current.short : 'KJV'}
        </Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 }}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={{ backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 1.5, marginBottom: 10, fontFamily: fonts.sansBold }}>
              CHOOSE A TRANSLATION
            </Text>
            {versions.map(v => (
              <TouchableOpacity
                key={v.id}
                onPress={async () => { await setVersion(v.id); setOpen(false); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  marginBottom: 8,
                  backgroundColor: version === v.id ? colors.goldLight : 'transparent',
                }}
              >
                <Text style={{ color: colors.gold, fontWeight: '700', width: 44, fontFamily: fonts.sansBold }}>{v.short}</Text>
                <Text style={{ color: colors.textPrimary, flex: 1, fontFamily: fonts.sans }}>{v.label}</Text>
                {version === v.id && <Text style={{ color: colors.gold, fontWeight: '700' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
