import React, { useEffect, useState } from 'react';
import { View, Text, Image } from 'react-native';
import { Channel } from '../../types';
import { webPlayerStyles as s } from './styles';

interface ChannelLogoProps {
  channel: Channel;
  size: number;
}

const ChannelLogo: React.FC<ChannelLogoProps> = ({ channel, size }) => {
  const [imgErr, setImgErr] = useState(false);

  useEffect(() => {
    setImgErr(false);
  }, [channel.id]);

  if (channel.logo && !imgErr) {
    return (
      <Image
        source={{ uri: channel.logo }}
        style={{ width: size, height: size, borderRadius: 10, backgroundColor: '#102033' }}
        resizeMode="contain"
        onError={() => setImgErr(true)}
      />
    );
  }

  return (
    <View style={[s.logoFallback, { width: size, height: size, borderRadius: 10 }]}>
      <Text style={s.logoFallbackTxt}>{channel.name.substring(0, 2).toUpperCase()}</Text>
    </View>
  );
};

export default ChannelLogo;
