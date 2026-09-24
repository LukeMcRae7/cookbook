import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const ClockIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
)

export const FlameIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3c.6 3 2.2 3.8 3.6 5.4A6.8 6.8 0 0 1 17.5 13a5.5 5.5 0 0 1-11 0c0-1.7.7-3 1.6-4.1.3 1 .9 1.6 1.7 1.9-.2-2.9.6-5.6 2.2-7.8Z" />
  </Svg>
)

export const StarIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m12 3.6 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8Z" />
  </Svg>
)

export const HeartIcon = ({ filled = false, ...props }: IconProps & { filled?: boolean }) => (
  <Svg {...props} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20s-7-4.3-7-9.1A4 4 0 0 1 12 8a4 4 0 0 1 7 2.9c0 4.8-7 9.1-7 9.1Z" />
  </Svg>
)

export const CloseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
)

export const PlusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const MinusIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 12h14" />
  </Svg>
)

export const CheckIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={2.6}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
)

export const SearchIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Svg>
)

export const TrashIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7h16M10 7V5h4v2M6 7l1 12h10l1-12M10 11v5M14 11v5" />
  </Svg>
)

export const PencilIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" />
    <path d="m14.5 6.5 3 3" />
  </Svg>
)

export const PlayIcon = (props: IconProps) => (
  <Svg {...props} fill="currentColor" stroke="none">
    <path d="M8 5.5v13l11-6.5Z" />
  </Svg>
)

export const PauseIcon = (props: IconProps) => (
  <Svg {...props} fill="currentColor" stroke="none">
    <rect x="7" y="5" width="3.5" height="14" rx="1.4" />
    <rect x="13.5" y="5" width="3.5" height="14" rx="1.4" />
  </Svg>
)

export const ResetIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v4.5h-4.5" />
  </Svg>
)

export const DragIcon = (props: IconProps) => (
  <Svg {...props} strokeWidth={1.8}>
    <path d="M5 9h14M5 13h14M5 17h9" />
  </Svg>
)

export const ThermometerIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 14.8V6a2 2 0 1 0-4 0v8.8a4 4 0 1 0 4 0Z" />
    <path d="M12 12v4" />
  </Svg>
)

export const BookIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15H7.5A2.5 2.5 0 0 0 5 20.5Z" />
    <path d="M5 18.5V5.5" />
  </Svg>
)

export const SparkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9Z" />
    <path d="M18.5 3.5v3M20 5h-3" />
  </Svg>
)

export const SettingsIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
  </Svg>
)

export const LinkIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.3-2.3a4 4 0 0 0-5.7-5.7l-1.3 1.3" />
    <path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.3 2.3a4 4 0 0 0 5.7 5.7l1.3-1.3" />
  </Svg>
)

export const UploadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 16V5" />
    <path d="m8 9 4-4 4 4" />
    <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
  </Svg>
)

export const ChevronLeftIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m14 6-6 6 6 6" />
  </Svg>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Svg>
)

export const ArrowDownIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 5v14M18 13l-6 6-6-6" />
  </Svg>
)

export const AlertIcon = (props: IconProps) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.2v.3" />
  </Svg>
)

export const ImageIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <circle cx="9.5" cy="9.5" r="1.5" />
    <path d="m20 15-4.5-4.5L6 20" />
  </Svg>
)

export const TextIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M5 6h14M5 10h14M5 14h9M5 18h6" />
  </Svg>
)

export const BellIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
    <path d="M10 18a2 2 0 0 0 4 0" />
  </Svg>
)
