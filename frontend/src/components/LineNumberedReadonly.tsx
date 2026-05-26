import { Fragment, useMemo } from 'react';
import { highlightJson } from '../utils/jsonUtils';
import { splitLogicalLines } from '../utils/lineNumbers';

type Props = {
  text: string;
  wordWrap?: boolean;
  highlightLines?: boolean;
  className?: string;
};

/**
 * Read-only viewer: one grid row per logical line. When word-wrap is on, wrapped
 * visual lines stay under the same line number (row height grows like Postman).
 */
export default function LineNumberedReadonly({
  text,
  wordWrap = false,
  highlightLines = false,
  className,
}: Props) {
  const lines = useMemo(() => splitLogicalLines(text), [text]);

  return (
    <div
      className={`line-sync-scroll${wordWrap ? ' line-sync-scroll--wrap' : ''}${
        className ? ` ${className}` : ''
      }`}
    >
      <div className="line-sync-stack">
        {lines.map((line, index) => (
          <Fragment key={index}>
            <div className="line-number-cell">{index + 1}</div>
            <div className="line-content-cell">
              {highlightLines ? (
                <code
                  className="json-highlight line-content-highlight"
                  dangerouslySetInnerHTML={{ __html: highlightJson(line) }}
                />
              ) : (
                <span className="line-content-plain">{line || '\u00a0'}</span>
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
