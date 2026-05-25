import type { CSSProperties, ReactNode } from 'react';
import { useRef } from 'react';
import { useKvKeyColumnWidth } from '../hooks/useKvKeyColumnWidth';

const CHECKBOX_COL_PX = 44;
const REMOVE_COL_PX = 30;
export const KV_FORM_FIELD_TYPE_COL_PX = 100;

type KvTableWrapProps = {
  children: ReactNode;
};

export function KvTableColGroup({ withMiddleCol }: { withMiddleCol?: boolean }) {
  return (
    <colgroup>
      <col style={{ width: CHECKBOX_COL_PX }} />
      <col className="kv-col-key" />
      {withMiddleCol && <col style={{ width: KV_FORM_FIELD_TYPE_COL_PX }} />}
      <col className="kv-col-value" />
      <col style={{ width: REMOVE_COL_PX }} />
    </colgroup>
  );
}

export default function KvTableWrap({ children }: KvTableWrapProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { widthCh, startResize } = useKvKeyColumnWidth(wrapRef);

  const resizerLeft = `calc(${CHECKBOX_COL_PX}px + ${widthCh}ch)`;

  const style = {
    '--kv-key-col-width': `${widthCh}ch`,
  } as CSSProperties;

  return (
    <div ref={wrapRef} className="kv-table-wrap" style={style}>
      <div
        className="kv-table-col-resizer"
        style={{ left: resizerLeft }}
        onMouseDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize key column"
        title="Drag to resize key column"
      />
      {children}
    </div>
  );
}
