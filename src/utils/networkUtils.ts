import NetInfo from '@react-native-community/netinfo';

export const checkInternetConnection = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable === true;
  } catch (error) {
    console.error('인터넷 연결 확인 에러:', error);
    return false;
  }
};

export const subscribeToNetworkState = (callback: (isConnected: boolean) => void) => {
  return NetInfo.addEventListener(state => {
    const isConnected = state.isConnected === true && state.isInternetReachable === true;
    callback(isConnected);
  });
};
