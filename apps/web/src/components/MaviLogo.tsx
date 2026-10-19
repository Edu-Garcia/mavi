export const MAVI_LOGO_SRC = "/mavi-logo.svg";
export const MAVI_LOGO_LIGHT_SRC = "/mavi-logo-light.svg";

export interface MaviLogoProps {
  size?: number;
  className?: string;
  /** `dark` = traços claros (fundo escuro). `light` = traços navy (fundo claro). */
  variant?: "dark" | "light";
}

export function MaviLogo({
  size = 36,
  className = "",
  variant = "dark",
}: MaviLogoProps) {
  const src = variant === "light" ? MAVI_LOGO_LIGHT_SRC : MAVI_LOGO_SRC;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 object-contain ${className}`.trim()}
    />
  );
}
