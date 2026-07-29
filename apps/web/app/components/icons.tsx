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

export const Play = (props: IconProps) => (
  <Base {...props} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5z" />
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
