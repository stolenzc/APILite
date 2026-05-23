/** VS Code / Postman–style panel toggle glyphs (16×16). */

type PanelIconProps = {
  active?: boolean;
};

export function PanelLeftIcon({ active = false }: PanelIconProps) {
  return (
    <svg className="panel-toggle-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="1.5"
        y="2.5"
        width="5.5"
        height="11"
        rx="1"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect
        x="9"
        y="2.5"
        width="5.5"
        height="11"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity={active ? 0.45 : 1}
      />
    </svg>
  );
}

export function PanelRightIcon({ active = false }: PanelIconProps) {
  return (
    <svg className="panel-toggle-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="1.5"
        y="2.5"
        width="5.5"
        height="11"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity={active ? 0.45 : 1}
      />
      <rect
        x="9"
        y="2.5"
        width="5.5"
        height="11"
        rx="1"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}

export function PanelBottomIcon({ active = false }: PanelIconProps) {
  return (
    <svg className="panel-toggle-icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="6.5"
        rx="1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity={active ? 0.45 : 1}
      />
      <rect
        x="1.5"
        y="10"
        width="13"
        height="3.5"
        rx="1"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.25"
      />
    </svg>
  );
}
