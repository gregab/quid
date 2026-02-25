import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, type ReactNode } from "react";
import { useColorScheme } from "react-native";

interface BottomSheetProps {
  children: ReactNode;
  snapPoints?: Array<string | number>;
}

export const Sheet = forwardRef<BottomSheetModal, BottomSheetProps>(
  function Sheet({ children, snapPoints = ["50%", "90%"] }, ref) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === "dark";

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
        />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{
          backgroundColor: isDark ? "#78716c" : "#d6d3d1",
          width: 36,
        }}
        backgroundStyle={{
          backgroundColor: isDark ? "#1c1917" : "#ffffff",
        }}
      >
        <BottomSheetView className="flex-1 px-4 pt-2">
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
