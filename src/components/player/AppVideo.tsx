import React, { forwardRef } from 'react';
import { Video } from 'expo-av';
import type { PlayerVideoHandle, PlayerVideoProps } from '../../types/video';

const AppVideo = forwardRef<PlayerVideoHandle, PlayerVideoProps>((props, ref) => (
  <Video ref={ref as any} {...props} />
));

AppVideo.displayName = 'AppVideo';

export default AppVideo;
