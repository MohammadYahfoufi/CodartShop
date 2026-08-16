import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = {
  fill: "none",
  viewBox: "0 0 24 24",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function BagIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></svg>;
}
export function ArrowIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 12h14M14 7l5 5-5 5" /></svg>;
}
export function CloseIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m6 6 12 12M18 6 6 18" /></svg>;
}
export function MinusIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M5 12h14" /></svg>;
}
export function PlusIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M12 5v14M5 12h14" /></svg>;
}
export function TrashIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></svg>;
}
export function EditIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="m14 5 5 5M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4Z" /></svg>;
}
export function ImageIcon(props: IconProps) {
  return <svg {...base} {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m4 17 5-4 4 3 3-2 4 3" /></svg>;
}
export function SearchIcon(props: IconProps) {
  return <svg {...base} {...props}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
}
export function WhatsAppIcon(props: IconProps) {
  return <svg {...base} {...props}><path d="M20 11.6a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.6Z" /><path d="M9 8.5c.4 3 2 4.7 5 5.5l1-1.2c.3-.3.6-.2 1-.1l1.4.7c.4.2.4.5.3.9-.4 1.2-1.3 1.8-2.5 1.7-4-.5-7.6-3.9-8-8 0-1 .5-1.8 1.5-2.2.4-.1.7 0 .9.4l.7 1.5c.2.3.1.6-.1.9L9 8.5Z" /></svg>;
}

export function HeartIcon({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return <svg {...base} {...props} fill={filled ? "currentColor" : "none"}><path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z" /></svg>;
}
