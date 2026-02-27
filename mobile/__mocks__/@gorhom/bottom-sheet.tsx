import { forwardRef, type ReactNode } from "react";

export const BottomSheetModal = forwardRef(function BottomSheetModal(
  { children }: { children?: ReactNode },
  _ref: unknown,
) {
  return <>{children}</>;
});

export const BottomSheetModalProvider = ({
  children,
}: {
  children?: ReactNode;
}) => <>{children}</>;

export const BottomSheetView = ({ children }: { children?: ReactNode }) => (
  <>{children}</>
);

export const BottomSheetBackdrop = () => null;

export type BottomSheetBackdropProps = Record<string, unknown>;
