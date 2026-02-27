import { View, Text, Pressable } from "react-native";

interface ErrorStateProps {
  /** Error message to display. Defaults to a generic message. */
  message?: string;
  /** Called when the user taps "Try again". */
  onRetry?: () => void;
}

/**
 * Friendly error state card with optional retry.
 * Uses Aviary's warm stone palette with a subtle rose accent.
 */
export function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginVertical: 24,
        borderRadius: 16,
        backgroundColor: "#fef2f2", // rose-50
        borderWidth: 1,
        borderColor: "#fecdd3", // rose-200
        paddingHorizontal: 20,
        paddingVertical: 24,
        alignItems: "center",
      }}
    >
      {/* Dot accent — subtle rose indicator */}
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: "#fb7185", // rose-400
          marginBottom: 12,
        }}
      />

      <Text
        style={{
          fontSize: 14,
          fontWeight: "500",
          color: "#57534e", // stone-600
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        {message}
      </Text>

      {onRetry && (
        <Pressable
          onPress={onRetry}
          style={({ pressed }) => ({
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: pressed ? "#e7e5e4" : "#f5f5f4", // stone-200 / stone-100
            borderWidth: 1,
            borderColor: "#d6d3d1", // stone-300
          })}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: "#44403c", // stone-700
              letterSpacing: 0.2,
            }}
          >
            Try again
          </Text>
        </Pressable>
      )}
    </View>
  );
}
