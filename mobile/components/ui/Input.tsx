import { View, Text, TextInput, type TextInputProps } from "react-native";
import { useState } from "react";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  prefix?: string;
  multiline?: boolean;
}

export function Input({
  label,
  error,
  prefix,
  multiline,
  editable = true,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const disabled = editable === false;

  const borderColor = error
    ? "border-rose-400 dark:border-rose-500"
    : focused
      ? "border-amber-500"
      : "border-stone-300 dark:border-stone-700";

  return (
    <View className={`w-full ${disabled ? "opacity-50" : ""}`}>
      {label && (
        <Text className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {label}
        </Text>
      )}
      <View
        className={`w-full flex-row items-center rounded-lg border ${borderColor}`}
        style={focused && !error ? { elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 } : undefined}
      >
        {prefix && (
          <Text className="pl-3 text-base text-stone-400 dark:text-stone-500">
            {prefix}
          </Text>
        )}
        <TextInput
          className={`min-w-0 flex-1 text-base text-stone-900 dark:bg-stone-900 dark:text-stone-100 ${prefix ? "pl-1 pr-3 py-2.5" : "px-3 py-2.5"} ${multiline ? "min-h-[80px]" : ""}`}
          placeholderTextColor="#a8a29e"
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "auto"}
          editable={editable}
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
      </View>
      {error && (
        <Text className="mt-1.5 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </Text>
      )}
    </View>
  );
}
