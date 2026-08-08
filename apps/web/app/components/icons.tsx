import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const ArrowLeft = (props: IconProps) => (
  <Base {...props}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Base>
);

export const ArrowRight = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const Check = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 6L9 17l-5-5" />
  </Base>
);

export const Eye = (props: IconProps) => (
  <Base {...props}>
    <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
    <circle cx="12" cy="12" r="2.8" />
  </Base>
);

export const EyeOff = (props: IconProps) => (
  <Base {...props}>
    <path d="M10.6 6.7A9.7 9.7 0 0112 6.6c6.4 0 10 5.4 10 5.4a17 17 0 01-3.2 3.7M6.5 8.3A16.6 16.6 0 002 12s3.6 5.4 10 5.4a10 10 0 003.6-.6" />
    <path d="M9.9 9.9a3 3 0 004.2 4.2" />
    <path d="M3 3l18 18" />
  </Base>
);

export const MoreHorizontal = (props: IconProps) => (
  <Base {...props}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Base>
);

export const Bell = (props: IconProps) => (
  <Base {...props}>
    <path d="M18 8a6 6 0 10-12 0c0 6-2 7-2 7h16s-2-1-2-7z" />
    <path d="M13.7 20a2 2 0 01-3.4 0" />
  </Base>
);

export const AlertTriangle = (props: IconProps) => (
  <Base {...props}>
    <path d="M10.3 3.9L1.8 18.3A2 2 0 003.5 21.3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);

export const Info = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Base>
);

export const X = (props: IconProps) => (
  <Base {...props}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Base>
);

export const Play = (props: IconProps) => (
  <Base {...props} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
  </Base>
);

export const Pause = (props: IconProps) => (
  <Base {...props}>
    <path d="M8 5v14M16 5v14" />
  </Base>
);

export const Volume = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 9H2v6h3l5 4V5L5 9zM15 9a4 4 0 010 6M18 6a8 8 0 010 12" />
  </Base>
);

export const Maximize = (props: IconProps) => (
  <Base {...props}>
    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
  </Base>
);

export const Minimize = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5" />
  </Base>
);

export const Rewind = (props: IconProps) => (
  <Base {...props}>
    <path d="M11 19l-8-7 8-7v14zM21 19l-8-7 8-7v14z" />
  </Base>
);

export const FastForward = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 5l8 7-8 7V5zM13 5l8 7-8 7V5z" />
  </Base>
);

export const VolumeOff = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 9H2v6h3l5 4V5L5 9zM16 9l6 6M22 9l-6 6" />
  </Base>
);

export const Settings = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21h-4v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H3v-4h.1a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 009 4.6a1.7 1.7 0 001-1.6V3h4v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.1v4H21a1.7 1.7 0 00-1.6 1z" />
  </Base>
);

export const LogOut = (props: IconProps) => (
  <Base {...props}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </Base>
);

export const BookOpen = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 7v14M12 7a5 5 0 00-5-5H3v14h4a5 5 0 015 5M12 7a5 5 0 015-5h4v14h-4a5 5 0 00-5 5" />
  </Base>
);

export const Dashboard = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Base>
);

export const Courses = (props: IconProps) => (
  <Base {...props}>
    <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" />
    <path d="M4 5.5v15A2.5 2.5 0 016.5 18M8 7h8M8 11h6" />
  </Base>
);

export const Users = (props: IconProps) => (
  <Base {...props}>
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </Base>
);

export const ExternalLink = (props: IconProps) => (
  <Base {...props}>
    <path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
  </Base>
);

export const Plus = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 5v14M5 12h14" />
  </Base>
);

export const Edit = (props: IconProps) => (
  <Base {...props}>
    <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4z" />
  </Base>
);

export const Trash = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6" />
  </Base>
);

export const ChevronUp = (props: IconProps) => (
  <Base {...props}>
    <path d="M18 15l-6-6-6 6" />
  </Base>
);

export const ChevronDown = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 9l6 6 6-6" />
  </Base>
);

/** Pegangan seret: enam titik, isian penuh karena titik bergaris tak terbaca. */
export const GripVertical = ({ size = 18, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </svg>
);

export const Search = (props: IconProps) => (
  <Base {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </Base>
);

export const Home = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 11.5L12 4l9 7.5" />
    <path d="M5.5 10v10h13V10M9.5 20v-6h5v6" />
  </Base>
);

export const MessageCircle = (props: IconProps) => (
  <Base {...props}>
    <path d="M21 11.5a8.4 8.4 0 01-9 8.5 9.5 9.5 0 01-4-.9L3 21l1.7-4.5A8.2 8.2 0 013 11.5a8.4 8.4 0 019-8.5 8.4 8.4 0 019 8.5z" />
    <path d="M8 12h.01M12 12h.01M16 12h.01" />
  </Base>
);

export const Globe = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
  </Base>
);

export const Instagram = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none" />
  </Base>
);

export const Package = (props: IconProps) => (
  <Base {...props}><path d="M21 8l-9 5-9-5M3.3 6.5L12 2l8.7 4.5v11L12 22l-8.7-4.5zM12 13v9" /></Base>
);

export const CreditCard = (props: IconProps) => (
  <Base {...props}><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h3" /></Base>
);

export const Hash = (props: IconProps) => (
  <Base {...props}><path d="M10 3L8 21M16 3l-2 18M4 9h17M3 15h17" /></Base>
);

export const BarChart = (props: IconProps) => (
  <Base {...props}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Base>
);

export const Calendar = (props: IconProps) => (
  <Base {...props}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></Base>
);

export const Megaphone = (props: IconProps) => (
  <Base {...props}><path d="M3 11v3a2 2 0 002 2h3l8 4V5L8 9H5a2 2 0 00-2 2zM8 16l1.5 5M19 9a4 4 0 010 7" /></Base>
);

export const Video = (props: IconProps) => (
  <Base {...props}><rect x="2.5" y="5" width="14" height="14" rx="2" /><path d="M16.5 10l5-3v10l-5-3z" /></Base>
);

export const FileText = (props: IconProps) => (
  <Base {...props}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2" /></Base>
);

export const ClipboardList = (props: IconProps) => (
  <Base {...props}><path d="M9 5H6a2 2 0 00-2 2v13a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-3" /><rect x="9" y="2" width="6" height="5" rx="2" /><path d="M9 12h7M9 16h7M7 12h.01M7 16h.01" /></Base>
);

export const ImageIcon = (props: IconProps) => (
  <Base {...props}><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></Base>
);
