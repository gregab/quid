import { Component, type ReactNode } from "react";
import { View, Text, Pressable } from "react-native";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-[#faf9f7] px-6 dark:bg-[#0c0a09]">
          <Text className="text-4xl">🐦</Text>
          <Text className="mt-3 text-lg font-bold text-stone-800 dark:text-stone-200">
            Something went wrong
          </Text>
          <Text className="mt-2 text-center text-sm text-stone-500 dark:text-stone-400">
            An unexpected error occurred. Please try again.
          </Text>
          {this.state.error && (
            <Text className="mt-2 text-center text-xs text-stone-400 dark:text-stone-500">
              {this.state.error.message}
            </Text>
          )}
          <Pressable
            onPress={this.handleReset}
            className="mt-6 rounded-xl bg-amber-600 px-6 py-3 dark:bg-amber-500"
          >
            <Text className="font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}
