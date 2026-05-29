import React from 'react';
import { View, Text } from 'react-native';
import FocusableItem from '../../components/FocusableItem';

export const SectionTitle: React.FC<{
  label: string;
  styles: any;
}> = ({ label, styles }) => <Text style={styles.sectionTitle}>{label}</Text>;

export const Card: React.FC<{
  children: React.ReactNode;
  style?: any;
  styles: any;
}> = ({ children, style, styles }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const Divider: React.FC<{
  styles: any;
}> = ({ styles }) => <View style={styles.divider} />;

export const RowBetween: React.FC<{
  children: React.ReactNode;
  styles: any;
}> = ({ children, styles }) => (
  <View style={styles.rowBetween}>{children}</View>
);

export const SettingRow: React.FC<{
  title: string;
  desc?: string;
  right: React.ReactNode;
  top?: boolean;
  onPress?: () => void;
  styles: any;
  isTv: boolean;
  focusedStyle: any;
}> = ({ title, desc, right, top, onPress, styles, isTv, focusedStyle }) => {
  const content = (
    <View style={[styles.settingRow, top && !onPress && styles.settingRowTop]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.settingTitle}>{title}</Text>
        {desc && <Text style={styles.settingDesc}>{desc}</Text>}
      </View>
      <View pointerEvents={isTv && onPress ? 'none' : 'auto'}>{right}</View>
    </View>
  );

  if (isTv && onPress) {
    return (
      <FocusableItem
        onPress={onPress}
        style={[styles.settingRowFocusWrap, top && styles.settingRowTop]}
        focusedStyle={focusedStyle}
      >
        {content}
      </FocusableItem>
    );
  }

  return content;
};
