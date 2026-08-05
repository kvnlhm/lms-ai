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
