declare const process: {
  env: {
    [key: string]: string | undefined;
    EXPO_PUBLIC_E2E?: string;
    E2E_PORT?: string;
    E2E_LIVE_PORT?: string;
    CI?: string;
  };
};
