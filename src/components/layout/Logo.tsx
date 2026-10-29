export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 26 26" aria-hidden="true">
        <rect width="26" height="26" rx="6" className="fill-primary" />
        <path
          d="M7 13.5l4 4L19.5 9"
          fill="none"
          className="stroke-brand-check"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[19px] font-semibold tracking-[-0.01em]">Task Master</span>
    </div>
  );
}
