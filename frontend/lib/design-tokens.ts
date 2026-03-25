/**
 * 🛰️ Emerald Citadel Design Tokens
 * These tokens ensure the frontend implementation matches the Stitch designs.
 */

export const tokens = {
  colors: {
    primary: "#003527",
    primary_container: "#064e3b", // The "Emerald" anchor
    background: "#f7f9fb",
    surface: "#f7f9fb",
    surface_low: "#f2f4f6", // Use for main dashboard canvas
    surface_lowest: "#ffffff", // Use for foreground cards
    surface_container_high: "#e6e8ea", // Added for hover states
    on_surface: "#191c1e", // Deep neutral, never use #000000
    on_surface_variant: "#404944", // Secondary metadata
    error: "#ba1a1a",
    success: "#0b513d",
  },
  typography: {
    font_display: "Manrope, sans-serif",
    font_body: "Inter, sans-serif",
    uppercase_header: {
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontWeight: "900", // "Black" weight for high impact
    },
  },
  spacing: {
    card_padding: "2rem",
    section_gap: "2.75rem",
  },
  effects: {
    ambient_shadow: "0px 4px 40px rgba(25, 28, 30, 0.06)",
    ghost_border: "1px solid rgba(191, 201, 195, 0.15)",
  },
  roundness: {
    lg: "0.5rem",
    full: "9999px",
  },
};
