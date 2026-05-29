import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { webPlayerStyles as s } from './styles';

interface TopOverlayProps {
  playlistName?: string;
  clockLabel: string;
  onSettings: () => void;
}

const TopOverlay: React.FC<TopOverlayProps> = ({ playlistName, clockLabel, onSettings }) => (
  <View style={s.topOverlay}>
    <View style={s.brandCluster}>
      <Text style={s.brandText}>ChuchPlayer</Text>
      {playlistName ? <Text style={s.playlistText} numberOfLines={1}>{playlistName}</Text> : null}
    </View>
    <View style={s.topActions}>
      <Text style={s.clockText}>{clockLabel}</Text>
      <TouchableOpacity onPress={onSettings} style={s.chromeBtn}>
        <Text style={s.chromeBtnTxt}>Settings</Text>
      </TouchableOpacity>
    </View>
  </View>
);

export default TopOverlay;
