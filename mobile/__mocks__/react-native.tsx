/**
 * Lightweight React Native mock for Vitest + happy-dom.
 *
 * Maps RN primitives → HTML elements so @testing-library/react can
 * query them with getByText, getByPlaceholderText, etc.
 */
import React, { forwardRef, type ReactNode, type ChangeEvent, type MouseEventHandler } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any> & { children?: ReactNode };

function flattenStyle(style: unknown): React.CSSProperties {
  if (!style) return {};
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.map(flattenStyle));
  }
  if (typeof style === "function") {
    return flattenStyle((style as (state: { pressed: boolean }) => unknown)({ pressed: false }));
  }
  return style as React.CSSProperties;
}

export const View = forwardRef<HTMLDivElement, Props>(
  function MockView({ children, className, testID, style, ...rest }, ref) {
    return <div data-testid={testID as string} className={className as string} style={flattenStyle(style)} ref={ref} {...rest}>{children}</div>;
  },
);

export const ScrollView = forwardRef<HTMLDivElement, Props>(
  function MockScrollView({ children, className, testID, ...rest }, ref) {
    return <div data-testid={testID as string} className={className as string} ref={ref} {...rest}>{children}</div>;
  },
);

export const FlatList = forwardRef<HTMLDivElement, Props>(
  function MockFlatList(props, ref) {
    const {
      data, renderItem, ListHeaderComponent, ListFooterComponent,
      ListEmptyComponent, keyExtractor, ...rest
    } = props;
    const items = data as Array<Record<string, unknown>> | undefined;
    const render = renderItem as ((info: { item: unknown; index: number }) => ReactNode) | undefined;
    const extractKey = keyExtractor as ((item: unknown, index: number) => string) | undefined;

    return (
      <div ref={ref} {...rest}>
        {ListHeaderComponent as ReactNode}
        {items && items.length > 0
          ? items.map((item, index) => (
              <div key={extractKey ? extractKey(item, index) : index}>
                {render?.({ item, index })}
              </div>
            ))
          : (ListEmptyComponent as ReactNode)}
        {ListFooterComponent as ReactNode}
      </div>
    );
  },
);

export const Text = forwardRef<HTMLSpanElement, Props>(
  function MockText({ children, className, testID, ...rest }, ref) {
    return <span data-testid={testID as string} className={className as string} ref={ref} {...rest}>{children}</span>;
  },
);

export const TextInput = forwardRef<HTMLInputElement, Props>(
  function MockTextInput(
    { value, onChangeText, placeholder, secureTextEntry, testID, onFocus, onBlur, ...rest },
    ref,
  ) {
    return (
      <input
        value={value as string}
        placeholder={placeholder as string}
        type={secureTextEntry ? "password" : "text"}
        data-testid={testID as string}
        ref={ref as React.Ref<HTMLInputElement>}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          if (typeof onChangeText === "function") {
            (onChangeText as (text: string) => void)(e.target.value);
          }
        }}
        onFocus={onFocus as React.FocusEventHandler<HTMLInputElement>}
        onBlur={onBlur as React.FocusEventHandler<HTMLInputElement>}
        {...rest}
      />
    );
  },
);

export const Pressable = forwardRef<HTMLButtonElement, Props>(
  function MockPressable({ onPress, children, testID, className, style, accessibilityLabel, ...rest }, ref) {
    // Resolve function-style and array style props
    const resolvedStyle = flattenStyle(style);
    return (
      <button
        onClick={onPress as MouseEventHandler}
        data-testid={testID as string}
        className={className as string}
        style={resolvedStyle}
        ref={ref}
        type="button"
        aria-label={accessibilityLabel as string | undefined}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

export const TouchableOpacity = Pressable;

export const Image = forwardRef<HTMLImageElement, Props>(
  function MockImage({ source, testID, ...rest }, ref) {
    const src = source as { uri?: string } | undefined;
    return <img src={src?.uri ?? ""} data-testid={testID as string} ref={ref} {...rest} />;
  },
);

export function ActivityIndicator({ testID }: Props) {
  return <div data-testid={(testID as string) ?? "activity-indicator"} role="progressbar" />;
}

export const Switch = forwardRef<HTMLInputElement, Props>(
  function MockSwitch({ value, onValueChange, testID, ...rest }, ref) {
    return (
      <input
        type="checkbox"
        checked={value as boolean}
        onChange={() => {
          if (typeof onValueChange === "function") {
            (onValueChange as (v: boolean) => void)(!(value as boolean));
          }
        }}
        data-testid={testID as string}
        ref={ref}
        {...rest}
      />
    );
  },
);

export const RefreshControl = () => null;

export const ImageBackground = forwardRef<HTMLDivElement, Props>(
  function MockImageBackground({ children, testID, style, imageStyle, ...rest }, ref) {
    return (
      <div data-testid={testID as string ?? "image-background"} style={flattenStyle(style)} ref={ref} {...rest}>
        {children}
      </div>
    );
  },
);

export const KeyboardAvoidingView = forwardRef<HTMLDivElement, Props>(
  function MockKAV({ children, className, testID, ...rest }, ref) {
    return <div data-testid={testID as string} className={className as string} ref={ref} {...rest}>{children}</div>;
  },
);

export const Alert = {
  alert: (
    _title: string,
    _message?: string,
    buttons?: Array<{ onPress?: () => void }>,
  ) => {
    const last = buttons?.[buttons.length - 1];
    last?.onPress?.();
  },
};

export const Share = {
  share: async () => ({ action: "sharedAction" }),
};

export const Platform = {
  OS: "ios" as const,
  select: (specifics: Record<string, unknown>) => specifics.ios,
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
  absoluteFillObject: { position: "absolute" as const, left: 0, right: 0, top: 0, bottom: 0 },
  hairlineWidth: 1,
};

export const Dimensions = {
  get: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
};

export const useColorScheme = () => "light";
export const useWindowDimensions = () => ({
  width: 375, height: 812, scale: 2, fontScale: 1,
});
export const Appearance = {
  getColorScheme: () => "light",
  setColorScheme: (_scheme: "light" | "dark" | null) => {},
  addChangeListener: () => ({ remove: () => {} }),
};
