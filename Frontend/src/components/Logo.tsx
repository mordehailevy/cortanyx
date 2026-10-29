export function LogoMark({ className = 'size-8' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-secondary text-white shadow-sm`}
    >
      <svg viewBox="0 0 24 24" className="size-[55%]" fill="currentColor">
        <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z" />
      </svg>
    </span>
  )
}
