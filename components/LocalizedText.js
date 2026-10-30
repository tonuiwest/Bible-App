import React from 'react';
import { Text as NativeText, TextInput as NativeTextInput, TouchableOpacity as NativeTouchableOpacity } from 'react-native';
import { isRTLLocale, useLocale } from '../context/LocaleContext';

function translateChild(child, translate) {
  if (typeof child === 'string') {
    const trimmed = child.trim();
    if (!trimmed) return child;
    const translated = translate(trimmed);
    if (translated === trimmed) return child;
    const leading = child.match(/^\s*/)[0];
    const trailing = child.match(/\s*$/)[0];
    return `${leading}${translated}${trailing}`;
  }
  // React.Children.map keeps/assigns keys, so mixed text + <Text> children
  // don't trigger the "unique key" warning.
  if (Array.isArray(child)) return React.Children.map(child, (item) => translateChild(item, translate));
  if (React.isValidElement(child)) {
    return React.cloneElement(child, {
      children: translateChild(child.props.children, translate),
    });
  }
  return child;
}

export function LocalizedText({ children, accessibilityLabel, accessibilityHint, ...props }) {
  const { translate, locale } = useLocale();
  return (
    <NativeText
      {...props}
      style={[{ writingDirection: isRTLLocale(locale) ? 'rtl' : 'ltr' }, props.style]}
      accessibilityLabel={accessibilityLabel ? translate(accessibilityLabel) : accessibilityLabel}
      accessibilityHint={accessibilityHint ? translate(accessibilityHint) : accessibilityHint}
    >
      {translateChild(children, translate)}
    </NativeText>
  );
}

export function LocalizedTextInput({ placeholder, accessibilityLabel, accessibilityHint, ...props }) {
  const { translate, locale } = useLocale();
  return (
    <NativeTextInput
      {...props}
      style={[{ writingDirection: isRTLLocale(locale) ? 'rtl' : 'ltr' }, props.style]}
      placeholder={placeholder ? translate(placeholder) : placeholder}
      accessibilityLabel={accessibilityLabel ? translate(accessibilityLabel) : accessibilityLabel}
      accessibilityHint={accessibilityHint ? translate(accessibilityHint) : accessibilityHint}
    />
  );
}

export function LocalizedTouchableOpacity({ accessibilityLabel, accessibilityHint, ...props }) {
  const { translate } = useLocale();
  return (
    <NativeTouchableOpacity
      {...props}
      accessibilityLabel={accessibilityLabel ? translate(accessibilityLabel) : accessibilityLabel}
      accessibilityHint={accessibilityHint ? translate(accessibilityHint) : accessibilityHint}
    />
  );
}
