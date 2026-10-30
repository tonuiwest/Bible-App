// Explicit re-exports only. `export * from 'react-native'` touches every
// export, including deprecated ones (ProgressBarAndroid, SafeAreaView,
// Clipboard, PushNotificationIOS), which prints deprecation warnings.
export {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  I18nManager,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  Share,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
} from 'react-native';
export {
  LocalizedText as Text,
  LocalizedTextInput as TextInput,
  LocalizedTouchableOpacity as TouchableOpacity,
} from './LocalizedText';
