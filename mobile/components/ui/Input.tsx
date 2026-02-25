import { View, Text, TextInput, type TextInputProps } from "react-native";
import { useState } from "react";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? "border-red-400 dark:border-red-500"
    : focused
      ? "border-amber-500"
      : "border-stone-300 dark:border-stone-700";

  const ringStyle = focused && !error ? "ring-2 ring-amber-500/20" : "";

  return (
    <View className="w-full">
      {label && (
        <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {label}
        </Text>
      )}
      <TextInput
        className={`w-full rounded-lg border px-3 py-2.5 text-base text-stone-900 dark:bg-stone-900 dark:text-stone-100 ${borderColor} ${ringStyle}`}
        placeholderTextColor="#a8a29e"
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <Text className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </Text>
      )}
    </View>
  );
}
