import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { recordAppIssue } from '../services/appDiagnostics';

type State = { error: Error | null };

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    void recordAppIssue('应用界面异常', error, true);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>界面暂时没有加载好</Text>
        <Text style={styles.body}>本地聊天和角色数据没有被清除。可以重新载入界面后继续。</Text>
        <TouchableOpacity style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={styles.buttonText}>重新载入</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#F7F4F5',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#241126', marginBottom: 10 },
  body: { fontSize: 15, lineHeight: 23, color: '#6F626A', textAlign: 'center' },
  button: { marginTop: 22, borderRadius: 18, paddingHorizontal: 22, paddingVertical: 12, backgroundColor: '#9A5071' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
});
