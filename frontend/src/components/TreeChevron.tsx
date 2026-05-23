/** Consistent expand/collapse chevron for folder & save-request trees. */

type Props = {
  expanded: boolean;
  className?: string;
};

export default function TreeChevron({ expanded, className = 'tree-chevron' }: Props) {
  return (
    <svg className={className} width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path
        fill="currentColor"
        d={expanded ? 'M2 3.5 L5 7 L8 3.5 Z' : 'M3.5 2.5 L6.5 5 L3.5 7.5 Z'}
      />
    </svg>
  );
}
