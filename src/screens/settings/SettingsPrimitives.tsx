import React from 'react';
import { Platform, Text, View } from 'react-native';
import FocusableItem from '../../components/FocusableItem';

const TV = Platform.OS === 'android';

interface SettingsPrimitivesProps {
  styles: any;
}

export const SectionTitle: React.FC<SettingsPrimitivesProps & { label: string }> = ({ styles, label }) => (
  <Text style={styles.sectionTitle}>{label}</Text>
);

export const Card: React.FC<SettingsPrimitivesProps & { children: React.ReactNode; style?: any }> = ({ styles, children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const Divider: React.FC<SettingsPrimitivesProps> = ({ styles }) => <View style={styles.divider} />;

export const RowBetween: React.FC<SettingsPrimitivesProps & { children: React.ReactNode }> = ({ styles, children }) => (
  <View style={styles.rowBetween}>{children}</View>
);

export const SettingRow: React.FC<SettingsPrimitivesProps & {
  title: string;
  desc?: string;
  right: React.ReactNode;
  top?: boolean;
  onPress?: () => void;
  rowFocusedStyle: any;
}> = ({ styles, title, desc, right, top, onPress, rowFocusedStyle }) => {
  const content = <View style={[styles.settingRow, top && !onPress && styles.settingRowTop]}>
    <View style={{ flex: 1 }}><Text style={styles.settingTitle}>{title}</Text>{desc && <Text style={styles.settingDesc}>{desc}</Text>}</View>
    <View pointerEvents={TV && onPress ? 'none' : 'auto'}>{right}</View>
  </View>;
  return TV && onPress ? <FocusableItem onPress={onPress} style={[styles.settingRowFocusWrap, top && styles.settingRowTop]} focusedStyle={rowFocusedStyle}>{content}</FocusableItem> : content;
};
