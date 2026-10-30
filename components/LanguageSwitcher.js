import React, { useState } from 'react';
import { FlatList, Modal, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { useLocale } from '../context/LocaleContext';
import { LocalizedText as Text } from './LocalizedText';

export default function LanguageSwitcher() {
  const { colors, fonts } = useTheme();
  const { locale, localeSetting, languages, setLocale, translate } = useLocale();
  const [open, setOpen] = useState(false);

  const choose = async (value) => {
    await setLocale(value);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={translate('Change language')}
        hitSlop={8}
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: colors.background2,
          borderWidth: 1,
          borderColor: colors.border,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Ionicons name="language-outline" size={17} color={colors.gold} />
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 }}>
          <View style={{ maxHeight: '85%', backgroundColor: colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.textPrimary, fontSize: 18, marginBottom: 10, fontFamily: fonts.serifBold }}>
              {translate('App language')}
            </Text>
            <FlatList
              data={[{ code: 'system', name: translate('Use device language') }, ...languages]}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const selected = item.code === 'system' ? localeSetting === 'system' : item.code === locale;
                return (
                  <TouchableOpacity
                    onPress={() => choose(item.code)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={{
                      paddingVertical: 11,
                      paddingHorizontal: 10,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text style={{ color: selected ? colors.gold : colors.textPrimary, fontFamily: selected ? fonts.sansBold : fonts.sans }}>
                      {item.name}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={18} color={colors.gold} /> : null}
                  </TouchableOpacity>
                );
              }}
            />
            <TouchableOpacity onPress={() => setOpen(false)} style={{ alignSelf: 'flex-end', padding: 10, marginTop: 6 }}>
              <Text style={{ color: colors.gold, fontFamily: fonts.sansBold }}>{translate('Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
