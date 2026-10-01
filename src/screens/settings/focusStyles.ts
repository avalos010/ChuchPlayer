import { ViewStyle } from 'react-native';
import { Theme } from '../../theme/themes';

export function createFocusStyles(theme: Theme): Record<'button' | 'danger' | 'row', ViewStyle> {
  return {
    button: {
      borderColor: theme.focused,
      borderWidth: 2,
      transform: [],
      elevation: 6,
    },
    danger: {
      backgroundColor: theme.cardActive,
      borderColor: '#ef4444',
      borderWidth: 2,
      transform: [],
      elevation: 6,
    },
    row: {
      backgroundColor: theme.cardActive,
      borderColor: theme.focused,
      borderWidth: 1.5,
      transform: [],
      elevation: 4,
    },
  };
}
