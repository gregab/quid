/**
 * Mock for lucide-react-native.
 * Returns a simple span element for any icon accessed via Proxy.
 */

const handler: ProxyHandler<Record<string, unknown>> = {
  get: (_target, name) => {
    if (typeof name === "string") {
      return (props: Record<string, unknown>) => {
        const React = require("react");
        return React.createElement("span", {
          "data-testid": `icon-${name}`,
          ...props,
        });
      };
    }
    return undefined;
  },
};

module.exports = new Proxy({}, handler);
